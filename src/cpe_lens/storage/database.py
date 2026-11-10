from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from cpe_lens.models.capability import CapabilityReport

_SCHEMA = """
CREATE TABLE IF NOT EXISTS capability_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    probed_at TEXT NOT NULL,
    adapter TEXT NOT NULL,
    source TEXT NOT NULL,
    device_model TEXT,
    firmware_version TEXT,
    report_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capability_snapshots_probed_at
    ON capability_snapshots (probed_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sampled_at TEXT NOT NULL,
    network_type TEXT,
    download_bps REAL,
    upload_bps REAL,
    download_bytes INTEGER,
    upload_bytes INTEGER,
    total_download_bytes INTEGER,
    total_upload_bytes INTEGER,
    lte_rsrp REAL,
    lte_rsrq REAL,
    lte_sinr REAL,
    lte_rssi REAL,
    nr_rsrp REAL,
    nr_rsrq REAL,
    nr_sinr REAL,
    lte_band TEXT,
    lte_pci INTEGER,
    lte_cell_id TEXT,
    nr_band TEXT,
    nr_pci INTEGER,
    nr_cell_id TEXT,
    connected_clients INTEGER
);

CREATE INDEX IF NOT EXISTS idx_telemetry_samples_sampled_at
    ON telemetry_samples (sampled_at);

CREATE TABLE IF NOT EXISTS telemetry_hourly (
    hour_start TEXT PRIMARY KEY,
    sample_count INTEGER NOT NULL,
    download_bps_avg REAL,
    download_bps_max REAL,
    upload_bps_avg REAL,
    upload_bps_max REAL,
    download_bytes INTEGER,
    upload_bytes INTEGER,
    lte_rsrp_avg REAL,
    lte_rsrp_min REAL,
    lte_rsrp_max REAL,
    lte_rsrq_avg REAL,
    lte_rsrq_min REAL,
    lte_rsrq_max REAL,
    lte_sinr_avg REAL,
    lte_sinr_min REAL,
    lte_sinr_max REAL,
    nr_rsrp_avg REAL,
    nr_rsrp_min REAL,
    nr_rsrp_max REAL,
    nr_rsrq_avg REAL,
    nr_rsrq_min REAL,
    nr_rsrq_max REAL,
    nr_sinr_avg REAL,
    nr_sinr_min REAL,
    nr_sinr_max REAL,
    connected_clients_avg REAL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_hour_start
    ON telemetry_hourly (hour_start);

CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    action TEXT NOT NULL,
    title_key TEXT NOT NULL,
    risk TEXT NOT NULL,
    status TEXT NOT NULL,
    verification TEXT NOT NULL,
    capability_ids_json TEXT NOT NULL,
    current_json TEXT NOT NULL,
    proposed_json TEXT NOT NULL,
    message_key TEXT NOT NULL,
    device_model TEXT
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at
    ON operation_logs (created_at DESC);
"""


class Database:
    """Small SQLite wrapper.

    Credentials, cookies, tokens and SMS bodies must never be passed to this
    class. Only capability results (and later, history/settings) belong here.
    """

    def __init__(self, path: Path) -> None:
        self.path = path

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(_SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA busy_timeout = 5000")
            yield connection
            connection.commit()
        finally:
            connection.close()


class CapabilityStore:
    def __init__(self, database: Database) -> None:
        self._database = database

    def save(self, report: CapabilityReport) -> None:
        with self._database.connect() as connection:
            connection.execute(
                """
                INSERT INTO capability_snapshots
                    (probed_at, adapter, source, device_model, firmware_version, report_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    report.probed_at.isoformat(),
                    report.adapter,
                    report.source,
                    report.device_model,
                    report.firmware_version,
                    report.model_dump_json(),
                ),
            )

    def latest(self) -> CapabilityReport | None:
        with self._database.connect() as connection:
            row = connection.execute("SELECT report_json FROM capability_snapshots ORDER BY id DESC LIMIT 1").fetchone()
        if row is None:
            return None
        return CapabilityReport.model_validate_json(row["report_json"])

    def count(self) -> int:
        with self._database.connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM capability_snapshots").fetchone()
        return int(row["total"]) if row is not None else 0
