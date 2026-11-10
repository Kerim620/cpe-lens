from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime
from typing import TypeVar

from cpe_lens.config import Settings
from cpe_lens.models.errors import DeviceTimeoutError, DomainError
from cpe_lens.models.telemetry import (
    CellSnapshot,
    ClientSnapshot,
    LiveDashboard,
    LiveSection,
    NetworkStatus,
    SignalSnapshot,
    TrafficSnapshot,
)
from cpe_lens.services.device_manager import DeviceManager
from cpe_lens.storage.history import HistorySample, HistoryStore
from cpe_lens.utils import utc_now

_LOGGER = logging.getLogger(__name__)
T = TypeVar("T")


@dataclass(slots=True)
class _TrafficBaseline:
    source: str
    download_bytes: int
    upload_bytes: int
    at: datetime


class TelemetryService:
    """Samples each dashboard section independently and keeps a latest cache.

    A failing section keeps its previous value with ``stale=True`` while other
    sections continue to update. History is recorded from the same sample.
    """

    def __init__(self, manager: DeviceManager, history: HistoryStore, settings: Settings) -> None:
        self._manager = manager
        self._history = history
        self._settings = settings
        self._status: LiveSection[NetworkStatus] = LiveSection[NetworkStatus]()
        self._signal: LiveSection[SignalSnapshot] = LiveSection[SignalSnapshot]()
        self._cells: LiveSection[CellSnapshot] = LiveSection[CellSnapshot]()
        self._traffic: LiveSection[TrafficSnapshot] = LiveSection[TrafficSnapshot]()
        self._clients: LiveSection[ClientSnapshot] = LiveSection[ClientSnapshot]()
        self._sampled_at: datetime | None = None
        self._traffic_baseline: _TrafficBaseline | None = None
        self._download_delta: int | None = None
        self._upload_delta: int | None = None
        self._sample_lock = asyncio.Lock()
        self._wake = asyncio.Event()
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        if self._settings.sample_interval_seconds > 0:
            self._tasks.append(asyncio.create_task(self._sample_loop(), name="cpe-lens-sampler"))
        self._tasks.append(asyncio.create_task(self._maintenance_loop(), name="cpe-lens-history-maintenance"))

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()

    def wake(self) -> None:
        self._wake.set()

    def snapshot(self) -> LiveDashboard:
        return LiveDashboard(
            generated_at=utc_now(),
            connected=self._manager.snapshot().connected,
            sampled_at=self._sampled_at,
            status=self._status,
            signal=self._signal,
            cells=self._cells,
            traffic=self._traffic,
            clients=self._clients,
        )

    async def sample_once(self) -> LiveDashboard:
        async with self._sample_lock:
            now = utc_now()
            manager_snapshot = self._manager.snapshot()
            if not manager_snapshot.connected and not self._manager.has_credentials():
                self._reset_sections()
                return self.snapshot()

            self._status = await self._fetch(self._manager.read_network_status, self._status, now)
            self._signal = await self._fetch(self._manager.read_signal, self._signal, now)
            self._cells = await self._fetch(self._manager.read_cells, self._cells, now)
            traffic_section = await self._fetch(self._manager.read_traffic, self._traffic, now)
            self._clients = await self._fetch(self._manager.read_clients, self._clients, now)

            self._download_delta = None
            self._upload_delta = None
            if traffic_section.data is not None:
                today = await self._today_totals(now)
                enriched, download_delta, upload_delta = self._enrich_traffic(
                    traffic_section.data,
                    now,
                    today,
                )
                self._download_delta = download_delta
                self._upload_delta = upload_delta
                traffic_section = traffic_section.model_copy(update={"data": enriched})
                self._traffic = traffic_section
            else:
                self._traffic = traffic_section

            self._sampled_at = now
            await self._record_history(now)
            return self.snapshot()

    async def _fetch(
        self,
        operation: Callable[[], Awaitable[T]],
        current: LiveSection[T],
        now: datetime,
    ) -> LiveSection[T]:
        try:
            data = await asyncio.wait_for(
                operation(),
                timeout=self._settings.telemetry_section_timeout_seconds,
            )
        except TimeoutError:
            return self._failed_section(current, DeviceTimeoutError("dashboard section timed out"))
        except DomainError as exc:
            return self._failed_section(current, exc)
        except Exception as exc:
            _LOGGER.warning("Dashboard section failed unexpectedly: %s", type(exc).__name__)
            return self._failed_section(
                current,
                DomainError(detail=type(exc).__name__),
            )
        return LiveSection[T](data=data, error=None, updated_at=now, stale=False)

    @staticmethod
    def _failed_section(current: LiveSection[T], error: DomainError) -> LiveSection[T]:
        return LiveSection[T](
            data=current.data,
            error=error.to_info(),
            updated_at=current.updated_at,
            stale=current.data is not None,
        )

    async def _today_totals(self, now: datetime) -> tuple[int | None, int | None]:
        try:
            return await asyncio.to_thread(self._history.today_totals, now)
        except Exception as exc:
            _LOGGER.warning("Could not read today's observed totals: %s", type(exc).__name__)
            return None, None

    def _enrich_traffic(
        self,
        data: TrafficSnapshot,
        now: datetime,
        today: tuple[int | None, int | None],
    ) -> tuple[TrafficSnapshot, int | None, int | None]:
        if data.total_download_bytes is not None and data.total_upload_bytes is not None:
            source = "total"
            download = data.total_download_bytes
            upload = data.total_upload_bytes
        elif data.session_download_bytes is not None and data.session_upload_bytes is not None:
            source = "session"
            download = data.session_download_bytes
            upload = data.session_upload_bytes
        else:
            return (
                data.model_copy(update={"today_download_bytes": today[0], "today_upload_bytes": today[1]}),
                None,
                None,
            )

        previous = self._traffic_baseline
        baseline = _TrafficBaseline(
            source=source,
            download_bytes=download,
            upload_bytes=upload,
            at=now,
        )

        if previous is None or previous.source != source:
            self._traffic_baseline = baseline
            return (
                data.model_copy(update={"today_download_bytes": today[0], "today_upload_bytes": today[1]}),
                None,
                None,
            )

        elapsed = (now - previous.at).total_seconds()
        interval = self._settings.sample_interval_seconds
        min_elapsed = max(0.2, min(2.5, interval * 0.5)) if interval > 0 else 0.2
        if elapsed < min_elapsed:
            # A wake-up/manual refresh can happen moments after the previous
            # sample. Keep the older baseline and wait for a meaningful window
            # instead of reporting an artificially huge instantaneous rate.
            return (
                data.model_copy(update={"today_download_bytes": today[0], "today_upload_bytes": today[1]}),
                None,
                None,
            )

        download_delta: int | None = None
        upload_delta: int | None = None
        download_bps: float | None = None
        upload_bps: float | None = None
        down_delta = download - previous.download_bytes
        up_delta = upload - previous.upload_bytes
        if down_delta >= 0 and up_delta >= 0:
            download_delta = down_delta
            upload_delta = up_delta
            # A long gap (sleep, disconnect) makes an instantaneous rate
            # meaningless, but the byte delta is still useful for totals.
            if elapsed <= max(60.0, interval * 6):
                # Counters are bytes; expose speeds as bits per second so the
                # UI can use standard Mbps labels.
                download_bps = (down_delta * 8) / elapsed
                upload_bps = (up_delta * 8) / elapsed
        # Counters reset after reboot/reconnect; start over.
        self._traffic_baseline = baseline

        today_download = today[0]
        today_upload = today[1]
        if download_delta is not None:
            today_download = (today_download or 0) + download_delta
        if upload_delta is not None:
            today_upload = (today_upload or 0) + upload_delta

        return (
            data.model_copy(
                update={
                    "download_bps": download_bps,
                    "upload_bps": upload_bps,
                    "today_download_bytes": today_download,
                    "today_upload_bytes": today_upload,
                }
            ),
            download_delta,
            upload_delta,
        )

    async def _record_history(self, now: datetime) -> None:
        # Only record sections that succeeded in this sample. A stale section
        # retains its last value for the live UI, but must not be written into
        # history as if it had just been measured.
        status = self._status.data if self._status.error is None else None
        signal = self._signal.data if self._signal.error is None else None
        traffic = self._traffic.data if self._traffic.error is None else None
        clients = self._clients.data if self._clients.error is None else None
        if status is None and signal is None and traffic is None and clients is None:
            return
        lte = signal.lte if signal is not None else None
        nr = signal.nr if signal is not None else None
        sample = HistorySample(
            sampled_at=now,
            network_type=status.network_type if status is not None else None,
            download_bps=traffic.download_bps if traffic is not None else None,
            upload_bps=traffic.upload_bps if traffic is not None else None,
            download_bytes=self._download_delta,
            upload_bytes=self._upload_delta,
            total_download_bytes=traffic.total_download_bytes if traffic is not None else None,
            total_upload_bytes=traffic.total_upload_bytes if traffic is not None else None,
            lte_rsrp=lte.rsrp_dbm if lte is not None else None,
            lte_rsrq=lte.rsrq_db if lte is not None else None,
            lte_sinr=lte.sinr_db if lte is not None else None,
            lte_rssi=lte.rssi_dbm if lte is not None else None,
            nr_rsrp=nr.rsrp_dbm if nr is not None else None,
            nr_rsrq=nr.rsrq_db if nr is not None else None,
            nr_sinr=nr.sinr_db if nr is not None else None,
            lte_band=lte.band if lte is not None else None,
            lte_pci=lte.pci if lte is not None else None,
            lte_cell_id=lte.cell_id if lte is not None else None,
            nr_band=nr.band if nr is not None else None,
            nr_pci=nr.pci if nr is not None else None,
            nr_cell_id=nr.cell_id if nr is not None else None,
            connected_clients=clients.count if clients is not None else None,
        )
        try:
            await asyncio.to_thread(self._history.record, sample)
        except Exception as exc:
            _LOGGER.warning("Could not record telemetry sample: %s", type(exc).__name__)

    async def _sample_loop(self) -> None:
        interval = self._settings.sample_interval_seconds
        while True:
            try:
                await self.sample_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                _LOGGER.warning("Telemetry sample failed: %s", type(exc).__name__)
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._wake.wait(), timeout=interval)
            self._wake.clear()

    async def _maintenance_loop(self) -> None:
        while True:
            try:
                result = await asyncio.to_thread(
                    self._history.aggregate_and_prune,
                    raw_retention_days=self._settings.history_raw_days,
                    hourly_retention_days=self._settings.history_hourly_days,
                )
                if result.deleted_raw or result.aggregated_hours:
                    _LOGGER.info(
                        "History maintenance: %s hours aggregated, %s raw rows pruned",
                        result.aggregated_hours,
                        result.deleted_raw,
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                _LOGGER.warning("History maintenance failed: %s", type(exc).__name__)
            await asyncio.sleep(3600)

    def _reset_sections(self) -> None:
        self._status = LiveSection[NetworkStatus]()
        self._signal = LiveSection[SignalSnapshot]()
        self._cells = LiveSection[CellSnapshot]()
        self._traffic = LiveSection[TrafficSnapshot]()
        self._clients = LiveSection[ClientSnapshot]()
        self._sampled_at = None
        self._traffic_baseline = None
        self._download_delta = None
        self._upload_delta = None
