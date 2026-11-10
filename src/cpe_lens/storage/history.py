from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from cpe_lens.models.history import (
    RANGE_CONFIG,
    SUMMARY_METRICS,
    HistoryPoint,
    HistoryRange,
    HistoryResponse,
    HistorySummary,
)
from cpe_lens.storage.database import Database
from cpe_lens.utils import utc_now


@dataclass(frozen=True, slots=True)
class HistorySample:
    sampled_at: datetime
    network_type: str | None
    download_bps: float | None
    upload_bps: float | None
    download_bytes: int | None
    upload_bytes: int | None
    total_download_bytes: int | None
    total_upload_bytes: int | None
    lte_rsrp: float | None
    lte_rsrq: float | None
    lte_sinr: float | None
    lte_rssi: float | None
    nr_rsrp: float | None
    nr_rsrq: float | None
    nr_sinr: float | None
    lte_band: str | None
    lte_pci: int | None
    lte_cell_id: str | None
    nr_band: str | None
    nr_pci: int | None
    nr_cell_id: str | None
    connected_clients: int | None


@dataclass(frozen=True, slots=True)
class PruneResult:
    aggregated_hours: int
    deleted_raw: int
    deleted_hourly: int


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _float_or_none(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except ValueError:
        return None


def _int_or_none(value: object) -> int | None:
    number = _float_or_none(value)
    return int(number) if number is not None else None


class HistoryStore:
    """Raw 30-day samples plus one-year hourly aggregates."""

    def __init__(self, database: Database) -> None:
        self._database = database

    def record(self, sample: HistorySample) -> None:
        with self._database.connect() as connection:
            connection.execute(
                """
                INSERT INTO telemetry_samples (
                    sampled_at, network_type, download_bps, upload_bps,
                    download_bytes, upload_bytes, total_download_bytes, total_upload_bytes,
                    lte_rsrp, lte_rsrq, lte_sinr, lte_rssi,
                    nr_rsrp, nr_rsrq, nr_sinr,
                    lte_band, lte_pci, lte_cell_id,
                    nr_band, nr_pci, nr_cell_id,
                    connected_clients
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _iso(sample.sampled_at),
                    sample.network_type,
                    sample.download_bps,
                    sample.upload_bps,
                    sample.download_bytes,
                    sample.upload_bytes,
                    sample.total_download_bytes,
                    sample.total_upload_bytes,
                    sample.lte_rsrp,
                    sample.lte_rsrq,
                    sample.lte_sinr,
                    sample.lte_rssi,
                    sample.nr_rsrp,
                    sample.nr_rsrq,
                    sample.nr_sinr,
                    sample.lte_band,
                    sample.lte_pci,
                    sample.lte_cell_id,
                    sample.nr_band,
                    sample.nr_pci,
                    sample.nr_cell_id,
                    sample.connected_clients,
                ),
            )

    def count(self) -> int:
        with self._database.connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM telemetry_samples").fetchone()
        return int(row["total"]) if row is not None else 0

    def today_totals(self, now: datetime | None = None) -> tuple[int | None, int | None]:
        local_now = (now or utc_now()).astimezone()
        start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_utc = start_local.astimezone(UTC)
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS sample_count,
                       SUM(download_bytes) AS download_total,
                       SUM(upload_bytes) AS upload_total
                FROM telemetry_samples
                WHERE sampled_at >= ?
                """,
                (_iso(start_utc),),
            ).fetchone()
        if row is None or int(row["sample_count"]) == 0:
            return None, None
        return _int_or_none(row["download_total"]), _int_or_none(row["upload_total"])

    def query(self, time_range: HistoryRange, now: datetime | None = None) -> HistoryResponse:
        now_utc = now or utc_now()
        duration_seconds, bucket_seconds = RANGE_CONFIG[time_range]
        from_at = now_utc - timedelta(seconds=duration_seconds)
        points = self._query_points(from_at, now_utc, bucket_seconds)
        summary = self._query_summary(from_at, now_utc)
        return HistoryResponse(
            range=time_range,
            from_at=from_at,
            to_at=now_utc,
            bucket_seconds=bucket_seconds,
            points=points,
            summary=summary,
        )

    def _query_points(self, from_at: datetime, to_at: datetime, bucket_seconds: int) -> list[HistoryPoint]:
        with self._database.connect() as connection:
            rows = connection.execute(
                """
                SELECT (CAST(strftime('%s', sampled_at) AS INTEGER) / ?) * ? AS bucket_epoch,
                       AVG(lte_rsrp) AS lte_rsrp,
                       AVG(lte_rsrq) AS lte_rsrq,
                       AVG(lte_sinr) AS lte_sinr,
                       AVG(lte_rssi) AS lte_rssi,
                       AVG(nr_rsrp) AS nr_rsrp,
                       AVG(nr_rsrq) AS nr_rsrq,
                       AVG(nr_sinr) AS nr_sinr,
                       AVG(download_bps) AS download_bps,
                       AVG(upload_bps) AS upload_bps,
                       SUM(download_bytes) AS download_bytes,
                       SUM(upload_bytes) AS upload_bytes
                FROM telemetry_samples
                WHERE sampled_at >= ? AND sampled_at <= ?
                GROUP BY bucket_epoch
                ORDER BY bucket_epoch
                """,
                (bucket_seconds, bucket_seconds, _iso(from_at), _iso(to_at)),
            ).fetchall()

        points: list[HistoryPoint] = []
        for row in rows:
            points.append(
                HistoryPoint(
                    timestamp=datetime.fromtimestamp(int(row["bucket_epoch"]), UTC),
                    lte_rsrp=_float_or_none(row["lte_rsrp"]),
                    lte_rsrq=_float_or_none(row["lte_rsrq"]),
                    lte_sinr=_float_or_none(row["lte_sinr"]),
                    lte_rssi=_float_or_none(row["lte_rssi"]),
                    nr_rsrp=_float_or_none(row["nr_rsrp"]),
                    nr_rsrq=_float_or_none(row["nr_rsrq"]),
                    nr_sinr=_float_or_none(row["nr_sinr"]),
                    download_bps=_float_or_none(row["download_bps"]),
                    upload_bps=_float_or_none(row["upload_bps"]),
                    download_bytes=_int_or_none(row["download_bytes"]),
                    upload_bytes=_int_or_none(row["upload_bytes"]),
                )
            )
        return points

    def _query_summary(self, from_at: datetime, to_at: datetime) -> HistorySummary:
        aggregate_expressions = []
        for metric in SUMMARY_METRICS:
            aggregate_expressions.extend(
                [
                    f"AVG({metric}) AS {metric}_avg",
                    f"MIN({metric}) AS {metric}_min",
                    f"MAX({metric}) AS {metric}_max",
                ]
            )
        aggregate_sql = ",\n                       ".join(aggregate_expressions)
        with self._database.connect() as connection:
            aggregate = connection.execute(
                f"""
                SELECT {aggregate_sql}
                FROM telemetry_samples
                WHERE sampled_at >= ? AND sampled_at <= ?
                """,
                (_iso(from_at), _iso(to_at)),
            ).fetchone()
            latest = connection.execute(
                f"""
                SELECT {", ".join(SUMMARY_METRICS)}
                FROM telemetry_samples
                WHERE sampled_at >= ? AND sampled_at <= ?
                ORDER BY sampled_at DESC
                LIMIT 1
                """,
                (_iso(from_at), _iso(to_at)),
            ).fetchone()

        current = {metric: _float_or_none(latest[metric]) if latest is not None else None for metric in SUMMARY_METRICS}
        average = {
            metric: _float_or_none(aggregate[f"{metric}_avg"]) if aggregate is not None else None
            for metric in SUMMARY_METRICS
        }
        minimum = {
            metric: _float_or_none(aggregate[f"{metric}_min"]) if aggregate is not None else None
            for metric in SUMMARY_METRICS
        }
        maximum = {
            metric: _float_or_none(aggregate[f"{metric}_max"]) if aggregate is not None else None
            for metric in SUMMARY_METRICS
        }
        return HistorySummary(current=current, average=average, minimum=minimum, maximum=maximum)

    def aggregate_and_prune(
        self,
        *,
        raw_retention_days: int = 30,
        hourly_retention_days: int = 365,
        now: datetime | None = None,
    ) -> PruneResult:
        now_utc = now or utc_now()
        raw_cutoff = (now_utc - timedelta(days=raw_retention_days)).replace(minute=0, second=0, microsecond=0)
        hourly_cutoff = (now_utc - timedelta(days=hourly_retention_days)).replace(minute=0, second=0, microsecond=0)
        with self._database.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO telemetry_hourly (
                    hour_start, sample_count,
                    download_bps_avg, download_bps_max, upload_bps_avg, upload_bps_max,
                    download_bytes, upload_bytes,
                    lte_rsrp_avg, lte_rsrp_min, lte_rsrp_max,
                    lte_rsrq_avg, lte_rsrq_min, lte_rsrq_max,
                    lte_sinr_avg, lte_sinr_min, lte_sinr_max,
                    nr_rsrp_avg, nr_rsrp_min, nr_rsrp_max,
                    nr_rsrq_avg, nr_rsrq_min, nr_rsrq_max,
                    nr_sinr_avg, nr_sinr_min, nr_sinr_max,
                    connected_clients_avg
                )
                SELECT strftime('%Y-%m-%dT%H:00:00Z', sampled_at), COUNT(*),
                       AVG(download_bps), MAX(download_bps), AVG(upload_bps), MAX(upload_bps),
                       SUM(download_bytes), SUM(upload_bytes),
                       AVG(lte_rsrp), MIN(lte_rsrp), MAX(lte_rsrp),
                       AVG(lte_rsrq), MIN(lte_rsrq), MAX(lte_rsrq),
                       AVG(lte_sinr), MIN(lte_sinr), MAX(lte_sinr),
                       AVG(nr_rsrp), MIN(nr_rsrp), MAX(nr_rsrp),
                       AVG(nr_rsrq), MIN(nr_rsrq), MAX(nr_rsrq),
                       AVG(nr_sinr), MIN(nr_sinr), MAX(nr_sinr),
                       AVG(connected_clients)
                FROM telemetry_samples
                WHERE sampled_at < ?
                GROUP BY strftime('%Y-%m-%dT%H:00:00Z', sampled_at)
                ON CONFLICT(hour_start) DO UPDATE SET
                    sample_count = excluded.sample_count,
                    download_bps_avg = excluded.download_bps_avg,
                    download_bps_max = excluded.download_bps_max,
                    upload_bps_avg = excluded.upload_bps_avg,
                    upload_bps_max = excluded.upload_bps_max,
                    download_bytes = excluded.download_bytes,
                    upload_bytes = excluded.upload_bytes,
                    lte_rsrp_avg = excluded.lte_rsrp_avg,
                    lte_rsrp_min = excluded.lte_rsrp_min,
                    lte_rsrp_max = excluded.lte_rsrp_max,
                    lte_rsrq_avg = excluded.lte_rsrq_avg,
                    lte_rsrq_min = excluded.lte_rsrq_min,
                    lte_rsrq_max = excluded.lte_rsrq_max,
                    lte_sinr_avg = excluded.lte_sinr_avg,
                    lte_sinr_min = excluded.lte_sinr_min,
                    lte_sinr_max = excluded.lte_sinr_max,
                    nr_rsrp_avg = excluded.nr_rsrp_avg,
                    nr_rsrp_min = excluded.nr_rsrp_min,
                    nr_rsrp_max = excluded.nr_rsrp_max,
                    nr_rsrq_avg = excluded.nr_rsrq_avg,
                    nr_rsrq_min = excluded.nr_rsrq_min,
                    nr_rsrq_max = excluded.nr_rsrq_max,
                    nr_sinr_avg = excluded.nr_sinr_avg,
                    nr_sinr_min = excluded.nr_sinr_min,
                    nr_sinr_max = excluded.nr_sinr_max,
                    connected_clients_avg = excluded.connected_clients_avg
                """,
                (_iso(raw_cutoff),),
            )
            aggregated_hours = cursor.rowcount
            deleted_raw = connection.execute(
                "DELETE FROM telemetry_samples WHERE sampled_at < ?",
                (_iso(raw_cutoff),),
            ).rowcount
            deleted_hourly = connection.execute(
                "DELETE FROM telemetry_hourly WHERE hour_start < ?",
                (_iso(hourly_cutoff),),
            ).rowcount
        return PruneResult(
            aggregated_hours=max(0, aggregated_hours),
            deleted_raw=max(0, deleted_raw),
            deleted_hourly=max(0, deleted_hourly),
        )

    def hourly_count(self) -> int:
        with self._database.connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM telemetry_hourly").fetchone()
        return int(row["total"]) if row is not None else 0
