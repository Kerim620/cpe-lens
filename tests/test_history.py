from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from cpe_lens.models.history import HistoryRange
from cpe_lens.storage.database import Database
from cpe_lens.storage.history import HistorySample, HistoryStore


def _sample(
    sampled_at: datetime,
    *,
    rsrp: float = -90,
    download_bps: float = 1_000_000,
    download_bytes: int = 500,
) -> HistorySample:
    return HistorySample(
        sampled_at=sampled_at,
        network_type="LTE",
        download_bps=download_bps,
        upload_bps=100_000,
        download_bytes=download_bytes,
        upload_bytes=100,
        total_download_bytes=10_000,
        total_upload_bytes=5_000,
        lte_rsrp=rsrp,
        lte_rsrq=-10,
        lte_sinr=15,
        lte_rssi=-65,
        nr_rsrp=-85,
        nr_rsrq=-9,
        nr_sinr=18,
        lte_band="3",
        lte_pci=123,
        lte_cell_id="12345678",
        nr_band="n78",
        nr_pci=321,
        nr_cell_id="87654321",
        connected_clients=3,
    )


def _store(tmp_path: Path) -> HistoryStore:
    database = Database(tmp_path / "data" / "cpe-lens.sqlite3")
    database.initialize()
    return HistoryStore(database)


def test_history_query_returns_buckets_and_summary(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 11, 10, 18, 0, tzinfo=UTC)
    store.record(_sample(now - timedelta(minutes=4), rsrp=-90))
    store.record(_sample(now - timedelta(minutes=2), rsrp=-80))
    store.record(_sample(now - timedelta(seconds=5), rsrp=-85))

    response = store.query(HistoryRange.M15, now=now)

    assert response.range is HistoryRange.M15
    assert response.bucket_seconds == 15
    assert len(response.points) == 3
    assert response.points[-1].lte_rsrp == -85
    assert response.summary.average["lte_rsrp"] == -85
    assert response.summary.minimum["lte_rsrp"] == -90
    assert response.summary.maximum["lte_rsrp"] == -80
    assert response.summary.current["lte_rsrp"] == -85
    assert response.summary.average["download_bps"] == 1_000_000


def test_history_query_groups_samples_in_same_bucket(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 11, 10, 18, 0, tzinfo=UTC)
    start = now - timedelta(minutes=10)
    store.record(_sample(start, rsrp=-90, download_bytes=100))
    store.record(_sample(start + timedelta(seconds=2), rsrp=-80, download_bytes=200))

    response = store.query(HistoryRange.M15, now=now)

    assert len(response.points) == 1
    point = response.points[0]
    assert point.lte_rsrp == -85
    assert point.download_bytes == 300


def test_today_totals_sum_recorded_deltas(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime.now(UTC)
    store.record(_sample(now - timedelta(seconds=5), download_bytes=100))
    store.record(_sample(now, download_bytes=250))

    download, upload = store.today_totals(now=now)

    assert download == 350
    assert upload == 200


def test_retention_aggregates_hourly_and_prunes_raw(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 11, 10, 18, 0, tzinfo=UTC)
    old = now - timedelta(days=40)
    too_old = now - timedelta(days=400)
    store.record(_sample(old, rsrp=-90))
    store.record(_sample(old + timedelta(minutes=5), rsrp=-80))
    store.record(_sample(too_old, rsrp=-100))
    store.record(_sample(now - timedelta(hours=1), rsrp=-85))

    result = store.aggregate_and_prune(raw_retention_days=30, hourly_retention_days=365, now=now)

    assert result.deleted_raw == 3
    assert result.aggregated_hours >= 1
    assert store.count() == 1
    assert store.hourly_count() >= 1
