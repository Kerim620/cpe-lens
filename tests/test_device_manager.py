from __future__ import annotations

import pytest

from cpe_lens.adapters.base import DeviceAdapter
from cpe_lens.config import Settings
from cpe_lens.models.capability import (
    CapabilityAccess,
    CapabilityCategory,
    CapabilityReason,
    CapabilityResult,
    CapabilityStatus,
)
from cpe_lens.models.device import DeviceInfo
from cpe_lens.models.errors import (
    AuthenticationError,
    AuthExpiredError,
    DeviceUnreachableError,
    NotConnectedError,
)
from cpe_lens.models.telemetry import (
    CellEntry,
    CellRadio,
    CellSnapshot,
    ClientConnectionType,
    ClientInfo,
    ClientSnapshot,
    NetworkStatus,
    RadioMetrics,
    SignalSnapshot,
    TrafficSnapshot,
)
from cpe_lens.services.device_manager import ConnectOptions, DeviceManager
from cpe_lens.storage.database import CapabilityStore, Database


class FakeAdapter(DeviceAdapter):
    adapter_name = "fake"
    source = "real_device"
    notice_key = None

    def __init__(self, *, connect_error: Exception | None = None) -> None:
        self.connect_error = connect_error
        self.heartbeat_error: Exception | None = None
        self.connected = False
        self.closed = False
        self.heartbeat_calls = 0

    async def connect(self) -> None:
        if self.connect_error is not None:
            raise self.connect_error
        self.connected = True

    async def close(self) -> None:
        self.closed = True
        self.connected = False

    async def get_device_info(self) -> DeviceInfo:
        return DeviceInfo(
            model="Generic HiLink CPE",
            firmware_version="FAKE-FW",
            web_ui_version="FAKE-WEB",
        )

    async def get_network_status(self) -> NetworkStatus:
        return NetworkStatus(operator="Test Operator", network_type="LTE")

    async def get_signal(self) -> SignalSnapshot:
        return SignalSnapshot(lte=RadioMetrics(rsrp_dbm=-90))

    async def get_cells(self) -> CellSnapshot:
        return CellSnapshot(cells=[CellEntry(radio=CellRadio.LTE, band="3", pci=123, cell_id="12345678")])

    async def get_traffic(self) -> TrafficSnapshot:
        return TrafficSnapshot(total_download_bytes=1_000, total_upload_bytes=500)

    async def get_clients(self) -> ClientSnapshot:
        return ClientSnapshot(
            clients=[
                ClientInfo(
                    hostname="test-client",
                    ip_address="192.168.8.2",
                    connection_type=ClientConnectionType.WIFI,
                )
            ],
            count=1,
        )

    async def heartbeat(self) -> None:
        self.heartbeat_calls += 1
        if self.heartbeat_error is not None:
            raise self.heartbeat_error

    async def probe_capabilities(self) -> list[CapabilityResult]:
        return [
            CapabilityResult(
                id="device_info",
                category=CapabilityCategory.DEVICE,
                access=CapabilityAccess.READ,
                status=CapabilityStatus.AVAILABLE,
                reason=CapabilityReason.OK,
                duration_ms=1,
            )
        ]


class FakeFactory:
    def __init__(self) -> None:
        self.adapters: list[FakeAdapter] = []
        self.connect_error: Exception | None = None

    def create(
        self,
        *,
        address: str,
        username: str,
        password: str,
    ) -> DeviceAdapter:
        adapter = FakeAdapter(connect_error=self.connect_error)
        self.adapters.append(adapter)
        return adapter


def _options() -> ConnectOptions:
    return ConnectOptions(
        address="http://192.168.8.1",
        username="admin",
        password="super-secret-password",
    )


def _manager(settings: Settings, *, store: CapabilityStore | None = None) -> tuple[DeviceManager, FakeFactory]:
    factory = FakeFactory()
    return DeviceManager(settings, store=store, adapter_factory=factory), factory


async def test_connect_and_disconnect_never_expose_or_persist_credentials(settings: Settings) -> None:
    database = Database(settings.database_path)
    database.initialize()
    store = CapabilityStore(database)
    manager, factory = _manager(settings, store=store)

    snapshot = await manager.connect(_options())
    assert snapshot.connected is True
    assert snapshot.device is not None
    assert snapshot.device.model == "Generic HiLink CPE"
    assert snapshot.capability_report is not None
    assert "super-secret-password" not in snapshot.model_dump_json()

    assert store.count() == 1
    assert manager.has_credentials() is True
    database_bytes = settings.database_path.read_bytes()
    assert b"super-secret-password" not in database_bytes
    assert b"192.168.8.1" not in database_bytes

    disconnected = await manager.disconnect()
    assert disconnected.connected is False
    assert disconnected.device is None
    assert disconnected.capability_report is None
    assert manager.has_credentials() is False
    assert factory.adapters[0].closed is True


async def test_connect_failure_is_reported_and_clears_credentials(settings: Settings) -> None:
    manager, factory = _manager(settings)
    factory.connect_error = AuthenticationError("bad password")

    with pytest.raises(AuthenticationError):
        await manager.connect(_options())

    snapshot = manager.snapshot()
    assert snapshot.connected is False
    assert snapshot.last_error is not None
    assert snapshot.last_error.code == "device_auth_failed"
    assert "super-secret-password" not in snapshot.model_dump_json()
    assert manager.has_credentials() is False
    assert factory.adapters[0].closed is True


async def test_auto_reconnect_after_auth_expiry(settings: Settings) -> None:
    manager, factory = _manager(settings)
    await manager.connect(_options())
    first = factory.adapters[0]
    first.heartbeat_error = AuthExpiredError("session expired")

    await manager.heartbeat()

    assert len(factory.adapters) == 2
    assert first.closed is True
    assert factory.adapters[1].connected is True
    snapshot = manager.snapshot()
    assert snapshot.connected is True
    assert snapshot.reconnect_count == 1
    assert snapshot.last_error is None


async def test_transient_network_failure_marks_offline_then_reconnects(settings: Settings) -> None:
    manager, factory = _manager(settings)
    await manager.connect(_options())
    factory.adapters[0].heartbeat_error = DeviceUnreachableError("offline")

    await manager.heartbeat()
    assert manager.snapshot().connected is False
    assert len(factory.adapters) == 1

    await manager.heartbeat()
    assert manager.snapshot().connected is True
    assert manager.snapshot().reconnect_count == 1
    assert len(factory.adapters) == 2


async def test_credentials_are_dropped_after_repeated_auth_failures(settings: Settings) -> None:
    manager, factory = _manager(settings)
    await manager.connect(_options())
    factory.adapters[0].heartbeat_error = AuthExpiredError("session expired")
    factory.connect_error = AuthenticationError("bad password")

    for _ in range(3):
        await manager.heartbeat()

    assert manager.has_credentials() is False
    snapshot = manager.snapshot()
    assert snapshot.connected is False
    assert snapshot.last_error is not None
    assert snapshot.last_error.code == "device_auth_failed"


async def test_probe_requires_a_connection(settings: Settings) -> None:
    manager, _ = _manager(settings)
    with pytest.raises(NotConnectedError):
        await manager.probe()
    with pytest.raises(NotConnectedError):
        await manager.refresh_device_info()


async def test_reconnect_handles_unexpected_adapter_errors(settings: Settings) -> None:
    manager, factory = _manager(settings)
    await manager.connect(_options())
    factory.adapters[0].heartbeat_error = AuthExpiredError("expired")
    factory.connect_error = RuntimeError("boom")

    await manager.heartbeat()

    assert manager.snapshot().connected is False
    assert manager.snapshot().last_error is not None
    assert manager.has_credentials() is True
