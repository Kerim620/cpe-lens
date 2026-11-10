from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime
from typing import TypeVar

from pydantic import SecretStr

from cpe_lens.adapters.base import DeviceAdapter
from cpe_lens.adapters.factory import AdapterFactory, DefaultAdapterFactory
from cpe_lens.config import Settings
from cpe_lens.models.capability import CapabilityReport, CapabilityResult, CapabilityStatus
from cpe_lens.models.controls import (
    AdvancedSettings,
    ApnProfile,
    MobileSettings,
    SmsPage,
    UssdState,
    WifiSettings,
)
from cpe_lens.models.device import ConnectionSnapshot, DeviceInfo
from cpe_lens.models.errors import (
    AuthenticationError,
    AuthExpiredError,
    DeviceTimeoutError,
    DeviceUnreachableError,
    DomainError,
    ErrorInfo,
    NotConnectedError,
)
from cpe_lens.models.telemetry import (
    CellSnapshot,
    ClientSnapshot,
    NetworkStatus,
    SignalSnapshot,
    TrafficSnapshot,
)
from cpe_lens.storage.database import CapabilityStore
from cpe_lens.utils import normalize_device_address, utc_now

_LOGGER = logging.getLogger(__name__)
T = TypeVar("T")

_MAX_AUTO_RECONNECT_AUTH_FAILURES = 3


@dataclass(frozen=True, slots=True)
class ConnectOptions:
    address: str
    username: str
    password: str


class DeviceManager:
    """Owns the single in-memory device session.

    Credentials live only in this object and are dropped on explicit disconnect
    or shutdown. They are never passed to the database or logging layer.
    """

    def __init__(
        self,
        settings: Settings,
        *,
        store: CapabilityStore | None = None,
        adapter_factory: AdapterFactory | None = None,
    ) -> None:
        self._settings = settings
        self._store = store
        self._factory: AdapterFactory = adapter_factory or DefaultAdapterFactory(
            device_timeout_seconds=settings.device_timeout_seconds,
        )
        self._lock = asyncio.Lock()
        self._adapter: DeviceAdapter | None = None
        self._address: str | None = None
        self._username: str | None = None
        self._password: SecretStr | None = None
        self._connected_at: datetime | None = None
        self._last_seen_at: datetime | None = None
        self._device: DeviceInfo | None = None
        self._report: CapabilityReport | None = None
        self._last_error: ErrorInfo | None = None
        self._reconnect_count = 0
        self._auth_failures = 0
        self._closed = False

    @property
    def settings(self) -> Settings:
        return self._settings

    def has_credentials(self) -> bool:
        return self._password is not None and self._address is not None

    def snapshot(self) -> ConnectionSnapshot:
        return ConnectionSnapshot(
            connected=self._adapter is not None,
            address=self._address,
            username=self._username,
            connected_at=self._connected_at,
            last_seen_at=self._last_seen_at,
            reconnect_count=self._reconnect_count,
            last_error=self._last_error,
            device=self._device,
            capability_report=self._report,
        )

    async def connect(self, options: ConnectOptions) -> ConnectionSnapshot:
        address = normalize_device_address(options.address)
        async with self._lock:
            self._ensure_open()
            await self._close_adapter_locked()
            self._reset_session_locked()
            self._address = address
            self._username = options.username.strip() or "admin"
            # SecretStr prevents accidental repr()/logging of the password.
            self._password = SecretStr(options.password)

            adapter: DeviceAdapter | None = None
            try:
                adapter = self._factory.create(
                    address=address,
                    username=self._username,
                    password=options.password,
                )
                await asyncio.wait_for(adapter.connect(), timeout=self._settings.connect_timeout_seconds)
            except TimeoutError as exc:
                if adapter is not None:
                    await adapter.close()
                self._last_error = DeviceTimeoutError("login timed out").to_info()
                self._clear_credentials_locked()
                raise DeviceTimeoutError("login timed out") from exc
            except DomainError as exc:
                if adapter is not None:
                    await adapter.close()
                self._last_error = exc.to_info()
                self._clear_credentials_locked()
                raise
            except asyncio.CancelledError:
                if adapter is not None:
                    with suppress(asyncio.CancelledError):
                        await adapter.close()
                self._clear_credentials_locked()
                raise

            self._adapter = adapter
            self._connected_at = utc_now()
            self._last_seen_at = self._connected_at
            self._last_error = None
            self._auth_failures = 0

            await self._refresh_device_info_locked(best_effort=True)
            try:
                await self._probe_adapter_locked(adapter)
            except DomainError as exc:
                # Login succeeded; a failed probe is a degraded state, not a
                # failed connection. The UI shows both the session and the error.
                self._last_error = exc.to_info()
                _LOGGER.warning("Initial capability probe failed: %s", exc.code)
            return self.snapshot()

    async def disconnect(self) -> ConnectionSnapshot:
        async with self._lock:
            await self._close_adapter_locked()
            self._reset_session_locked()
            self._clear_credentials_locked()
            return self.snapshot()

    async def refresh_device_info(self) -> DeviceInfo:
        async with self._lock:
            info = await self._run_with_reconnect_locked(lambda adapter: adapter.get_device_info())
            self._device = info
            self._last_seen_at = utc_now()
            self._last_error = None
            return info

    async def probe(self) -> CapabilityReport:
        async with self._lock:
            report = await self._run_with_reconnect_locked(lambda adapter: self._probe_adapter_locked(adapter))
            return report

    async def read_network_status(self) -> NetworkStatus:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_network_status())

    async def read_signal(self) -> SignalSnapshot:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_signal())

    async def read_cells(self) -> CellSnapshot:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_cells())

    async def read_traffic(self) -> TrafficSnapshot:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_traffic())

    async def read_clients(self) -> ClientSnapshot:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_clients())

    def capability(self, capability_id: str) -> CapabilityResult | None:
        report = self._report
        if report is None:
            return None
        return next((item for item in report.capabilities if item.id == capability_id), None)

    def capability_status(self, capability_id: str) -> CapabilityStatus | None:
        result = self.capability(capability_id)
        return result.status if result is not None else None

    async def read_wifi(self) -> WifiSettings:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_wifi_settings())

    async def read_apn_profiles(self) -> list[ApnProfile]:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_apn_profiles())

    async def read_sms_page(self, page: int = 1, read_count: int = 20) -> SmsPage:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_sms_page(page, read_count))

    async def read_ussd(self) -> UssdState:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_ussd_state())

    async def read_mobile(self) -> MobileSettings:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_mobile_settings())

    async def read_advanced(self) -> AdvancedSettings:
        async with self._lock:
            return await self._run_with_reconnect_locked(lambda adapter: adapter.get_advanced_settings())

    async def run_control(self, operation: Callable[[DeviceAdapter], Awaitable[T]]) -> T:
        """Run a write operation while holding the device lock.

        Writes are deliberately never retried after an auth/network error:
        retrying a non-idempotent action could send an SMS or reboot twice.
        """

        async with self._lock:
            adapter = await self._require_adapter_locked()
            result = await operation(adapter)
            self._last_seen_at = utc_now()
            self._last_error = None
            return result

    async def heartbeat(self) -> None:
        """Keep the session alive and reconnect when the device disappears."""

        async with self._lock:
            if self._closed or not self.has_credentials():
                return
            if self._adapter is None:
                await self._reconnect_locked()
                return
            try:
                await asyncio.wait_for(
                    self._adapter.heartbeat(),
                    timeout=self._settings.heartbeat_timeout_seconds,
                )
            except AuthExpiredError as exc:
                self._last_error = exc.to_info()
                await self._reconnect_locked()
            except (DeviceTimeoutError, DeviceUnreachableError) as exc:
                self._last_error = exc.to_info()
                await self._close_adapter_locked()
                _LOGGER.info("Device heartbeat failed: %s", exc.code)
            except DomainError as exc:
                self._last_error = exc.to_info()
            else:
                self._last_seen_at = utc_now()
                self._last_error = None

    async def watchdog_loop(self) -> None:
        interval = self._settings.monitor_interval_seconds
        if interval <= 0:
            return
        while True:
            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                return
            try:
                await self.heartbeat()
            except asyncio.CancelledError:
                return
            except Exception as exc:
                _LOGGER.warning("Device watchdog iteration failed: %s", type(exc).__name__)

    async def shutdown(self) -> None:
        async with self._lock:
            self._closed = True
            await self._close_adapter_locked()
            self._clear_credentials_locked()
            self._reset_session_locked()

    async def _run_with_reconnect_locked(self, operation: Callable[[DeviceAdapter], Awaitable[T]]) -> T:
        adapter = await self._require_adapter_locked()
        try:
            result = await operation(adapter)
        except AuthExpiredError:
            if not await self._reconnect_locked():
                raise
            adapter = self._require_adapter()
            result = await operation(adapter)
        self._last_seen_at = utc_now()
        self._last_error = None
        return result

    async def _probe_adapter_locked(self, adapter: DeviceAdapter) -> CapabilityReport:
        try:
            capabilities = await asyncio.wait_for(
                adapter.probe_capabilities(),
                timeout=self._settings.probe_timeout_seconds,
            )
        except TimeoutError as exc:
            raise DeviceTimeoutError("capability probe timed out") from exc
        report = CapabilityReport(
            adapter=adapter.adapter_name,
            source=adapter.source,
            device_model=self._device.model if self._device else None,
            firmware_version=self._device.firmware_version if self._device else None,
            notice_key=adapter.notice_key,
            capabilities=capabilities,
        )
        self._last_seen_at = utc_now()
        self._last_error = None
        self._report = report
        if self._store is not None:
            try:
                await asyncio.to_thread(self._store.save, report)
            except Exception as exc:
                _LOGGER.warning("Could not persist capability snapshot: %s", type(exc).__name__)
        return report

    async def _refresh_device_info_locked(self, *, best_effort: bool) -> None:
        adapter = self._require_adapter()
        try:
            self._device = await asyncio.wait_for(
                adapter.get_device_info(),
                timeout=self._settings.connect_timeout_seconds,
            )
        except DomainError as exc:
            self._last_error = exc.to_info()
            if not best_effort:
                raise
        else:
            self._last_seen_at = utc_now()
            self._last_error = None

    async def _require_adapter_locked(self) -> DeviceAdapter:
        if self._adapter is not None:
            return self._adapter
        if await self._reconnect_locked():
            return self._require_adapter()
        raise NotConnectedError("device is not connected")

    def _require_adapter(self) -> DeviceAdapter:
        if self._adapter is None:
            raise NotConnectedError("device is not connected")
        return self._adapter

    async def _reconnect_locked(self) -> bool:
        if not self.has_credentials() or self._closed:
            return False
        assert self._address is not None
        assert self._username is not None
        assert self._password is not None
        await self._close_adapter_locked()
        password = self._password.get_secret_value()
        adapter = self._factory.create(
            address=self._address,
            username=self._username,
            password=password,
        )
        try:
            await asyncio.wait_for(adapter.connect(), timeout=self._settings.connect_timeout_seconds)
        except DomainError as exc:
            await adapter.close()
            self._last_error = exc.to_info()
            if isinstance(exc, AuthenticationError):
                self._auth_failures += 1
                if self._auth_failures >= _MAX_AUTO_RECONNECT_AUTH_FAILURES:
                    _LOGGER.warning("Dropping in-memory credentials after repeated auth failures")
                    self._clear_credentials_locked()
            _LOGGER.info("Auto reconnect failed: %s", exc.code)
            return False
        except TimeoutError:
            await adapter.close()
            self._last_error = DeviceTimeoutError("reconnect timed out").to_info()
            return False
        except Exception as exc:
            await adapter.close()
            _LOGGER.warning("Unexpected auto reconnect failure: %s", type(exc).__name__)
            self._last_error = DomainError("unexpected reconnect failure").to_info()
            return False

        self._adapter = adapter
        self._reconnect_count += 1
        self._auth_failures = 0
        self._last_seen_at = utc_now()
        self._last_error = None
        _LOGGER.info("Automatically reconnected to the device")
        await self._refresh_device_info_locked(best_effort=True)
        return True

    async def _close_adapter_locked(self) -> None:
        adapter = self._adapter
        self._adapter = None
        if adapter is not None:
            try:
                await adapter.close()
            except Exception as exc:
                _LOGGER.warning("Could not close device adapter: %s", type(exc).__name__)

    def _reset_session_locked(self) -> None:
        self._device = None
        self._report = None
        self._connected_at = None
        self._last_seen_at = None
        self._last_error = None
        self._reconnect_count = 0
        self._auth_failures = 0

    def _clear_credentials_locked(self) -> None:
        self._address = None
        self._username = None
        self._password = None

    def _ensure_open(self) -> None:
        if self._closed:
            raise RuntimeError("device manager is shut down")
