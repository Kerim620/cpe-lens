from __future__ import annotations

import asyncio
from pathlib import Path

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
from cpe_lens.models.errors import DeviceUnreachableError
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
from cpe_lens.services.telemetry import TelemetryService
from cpe_lens.storage.database import Database
from cpe_lens.storage.history import HistoryStore


class TelemetryFakeAdapter(DeviceAdapter):
    adapter_name = "fake"
    source = "real_device"
    notice_key = None

    def __init__(self) -> None:
        self.total_download = 1_000
        self.total_upload = 500
        self.signal_error: Exception | None = None
        self.closed = False

    async def connect(self) -> None:
        pass

    async def close(self) -> None:
        self.closed = True

    async def get_device_info(self) -> DeviceInfo:
        return DeviceInfo(model="Generic HiLink CPE", firmware_version="TEST-FW")

    async def heartbeat(self) -> None:
        pass

    async def probe_capabilities(self) -> list[CapabilityResult]:
        return [
            CapabilityResult(
                id="device_info",
                category=CapabilityCategory.DEVICE,
                access=CapabilityAccess.READ,
                status=CapabilityStatus.AVAILABLE,
                reason=CapabilityReason.OK,
            )
        ]

    async def get_network_status(self) -> NetworkStatus:
        return NetworkStatus(operator="Test Operator", network_type="LTE")

    async def get_signal(self) -> SignalSnapshot:
        if self.signal_error is not None:
            raise self.signal_error
        return SignalSnapshot(lte=RadioMetrics(rsrp_dbm=-91, sinr_db=13, band="3", pci=123, cell_id="abc"))

    async def get_cells(self) -> CellSnapshot:
        return CellSnapshot(cells=[CellEntry(radio=CellRadio.LTE, band="3", pci=123, cell_id="abc")])

    async def get_traffic(self) -> TrafficSnapshot:
        return TrafficSnapshot(
            total_download_bytes=self.total_download,
            total_upload_bytes=self.total_upload,
            session_download_bytes=100,
            session_upload_bytes=50,
        )

    async def get_clients(self) -> ClientSnapshot:
        return ClientSnapshot(
            clients=[
                ClientInfo(
                    hostname="test-laptop",
                    ip_address="192.168.8.10",
                    connection_type=ClientConnectionType.WIFI,
                )
            ],
            count=1,
        )


class SingleFactory:
    def __init__(self, adapter: TelemetryFakeAdapter) -> None:
        self.adapter = adapter

    def create(self, *, address: str, username: str, password: str) -> DeviceAdapter:
        return self.adapter


def _manager(settings: Settings, adapter: TelemetryFakeAdapter) -> DeviceManager:
    return DeviceManager(settings, adapter_factory=SingleFactory(adapter))


async def _connect(manager: DeviceManager) -> None:
    await manager.connect(
        ConnectOptions(
            address="http://192.168.8.1",
            username="admin",
            password="secret",
        )
    )


async def test_sample_updates_sections_and_records_history(settings: Settings, tmp_path: Path) -> None:
    adapter = TelemetryFakeAdapter()
    manager = _manager(settings, adapter)
    await _connect(manager)
    database = Database(settings.database_path)
    database.initialize()
    history = HistoryStore(database)
    telemetry = TelemetryService(manager, history, settings)

    first = await telemetry.sample_once()
    assert first.connected is True
    assert first.status.data is not None
    assert first.status.data.operator == "Test Operator"
    assert first.signal.data is not None
    assert first.signal.data.lte is not None
    assert first.traffic.data is not None
    assert first.traffic.data.download_bps is None
    assert first.clients.data is not None
    assert first.clients.data.count == 1
    assert history.count() == 1

    adapter.total_download = 2_500
    adapter.total_upload = 800
    await asyncio.sleep(0.25)
    second = await telemetry.sample_once()

    assert second.traffic.data is not None
    assert second.traffic.data.download_bps is not None
    assert second.traffic.data.download_bps > 0
    assert second.traffic.data.today_download_bytes == 1_500
    assert history.count() == 2


async def test_failed_section_keeps_previous_data_and_does_not_break_others(settings: Settings, tmp_path: Path) -> None:
    adapter = TelemetryFakeAdapter()
    manager = _manager(settings, adapter)
    await _connect(manager)
    database = Database(settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), settings)

    first = await telemetry.sample_once()
    assert first.signal.data is not None

    adapter.signal_error = DeviceUnreachableError("offline")
    adapter.total_download = 3_000
    second = await telemetry.sample_once()

    assert second.signal.error is not None
    assert second.signal.error.code == "device_unreachable"
    assert second.signal.stale is True
    assert second.signal.data is not None
    assert second.signal.data.lte is not None
    assert second.status.error is None
    assert second.traffic.data is not None
    assert second.traffic.data.total_download_bytes == 3_000

    with database.connect() as connection:
        row = connection.execute(
            "SELECT lte_rsrp, total_download_bytes FROM telemetry_samples ORDER BY id DESC LIMIT 1"
        ).fetchone()
    assert row is not None
    assert row["lte_rsrp"] is None
    assert row["total_download_bytes"] == 3_000


async def test_disconnect_resets_live_sections(settings: Settings, tmp_path: Path) -> None:
    adapter = TelemetryFakeAdapter()
    manager = _manager(settings, adapter)
    await _connect(manager)
    database = Database(settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), settings)
    await telemetry.sample_once()

    await manager.disconnect()
    snapshot = await telemetry.sample_once()

    assert snapshot.connected is False
    assert snapshot.status.data is None
    assert snapshot.signal.data is None
    assert snapshot.traffic.data is None


async def test_sampling_uses_the_expected_section_error_type(settings: Settings, tmp_path: Path) -> None:
    adapter = TelemetryFakeAdapter()
    manager = _manager(settings, adapter)
    await _connect(manager)
    database = Database(settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), settings)

    adapter.signal_error = TimeoutError()
    snapshot = await telemetry.sample_once()

    assert snapshot.signal.error is not None
    assert snapshot.signal.error.code == "device_timeout"


@pytest.mark.parametrize("interval", [0, 5])
def test_telemetry_start_does_not_require_a_connection(settings: Settings, interval: int) -> None:
    settings = settings.model_copy(update={"sample_interval_seconds": interval})
    adapter = TelemetryFakeAdapter()
    manager = _manager(settings, adapter)
    database = Database(settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), settings)

    async def run() -> None:
        await telemetry.start()
        await telemetry.stop()

    asyncio.run(run())


async def test_too_soon_sample_does_not_create_a_speed_spike(settings: Settings, tmp_path: Path) -> None:
    fast_settings = settings.model_copy(update={"sample_interval_seconds": 1})
    adapter = TelemetryFakeAdapter()
    manager = _manager(fast_settings, adapter)
    await _connect(manager)
    database = Database(fast_settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), fast_settings)

    first = await telemetry.sample_once()
    assert first.traffic.data is not None
    adapter.total_download += 1_000_000
    adapter.total_upload += 500_000
    too_soon = await telemetry.sample_once()

    assert too_soon.traffic.data is not None
    assert too_soon.traffic.data.download_bps is None
    assert too_soon.traffic.data.today_download_bytes is None

    await asyncio.sleep(0.55)
    after_window = await telemetry.sample_once()
    assert after_window.traffic.data is not None
    assert after_window.traffic.data.download_bps is not None
    assert after_window.traffic.data.download_bps > 0
    assert after_window.traffic.data.today_download_bytes == 1_000_000


async def test_stream_publishes_new_dashboard_after_sample(settings: Settings, tmp_path: Path) -> None:
    adapter = TelemetryFakeAdapter()
    manager = _manager(settings, adapter)
    await _connect(manager)
    database = Database(settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), settings)

    stream = telemetry.stream()
    initial = await anext(stream)
    assert initial is not None

    adapter.total_download = 2_000
    adapter.total_upload = 700
    await asyncio.sleep(0.25)
    await telemetry.sample_once()

    update = await asyncio.wait_for(anext(stream), timeout=1)
    assert update is not None
    assert update.traffic.data is not None
    assert update.traffic.data.total_download_bytes == 2_000
    await stream.aclose()


async def test_sample_loop_uses_configured_interval(
    settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    interval_settings = settings.model_copy(update={"sample_interval_seconds": 0.2})
    adapter = TelemetryFakeAdapter()
    manager = _manager(interval_settings, adapter)
    database = Database(interval_settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), interval_settings)
    calls: list[float] = []

    async def fake_sample_once() -> None:
        calls.append(asyncio.get_running_loop().time())

    monkeypatch.setattr(telemetry, "sample_once", fake_sample_once)
    await telemetry.start()
    await asyncio.sleep(0.55)
    await telemetry.stop()
    assert 2 <= len(calls) <= 4
    assert calls[1] - calls[0] >= 0.15


async def test_too_soon_repeat_keeps_last_visible_rate(settings: Settings, tmp_path: Path) -> None:
    fast_settings = settings.model_copy(update={"sample_interval_seconds": 1})
    adapter = TelemetryFakeAdapter()
    manager = _manager(fast_settings, adapter)
    await _connect(manager)
    database = Database(fast_settings.database_path)
    database.initialize()
    telemetry = TelemetryService(manager, HistoryStore(database), fast_settings)

    await telemetry.sample_once()
    adapter.total_download += 1_000_000
    adapter.total_upload += 500_000
    await asyncio.sleep(1.1)
    measured = await telemetry.sample_once()
    assert measured.traffic.data is not None
    assert measured.traffic.data.download_bps is not None

    immediate = await telemetry.sample_once()
    assert immediate.traffic.data is not None
    assert immediate.traffic.data.download_bps == measured.traffic.data.download_bps
