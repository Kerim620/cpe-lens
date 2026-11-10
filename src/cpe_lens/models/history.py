from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class HistoryRange(StrEnum):
    M15 = "15m"
    H1 = "1h"
    H6 = "6h"
    H24 = "24h"
    D7 = "7d"


RANGE_CONFIG: dict[HistoryRange, tuple[int, int]] = {
    HistoryRange.M15: (15 * 60, 15),
    HistoryRange.H1: (60 * 60, 60),
    HistoryRange.H6: (6 * 60 * 60, 300),
    HistoryRange.H24: (24 * 60 * 60, 600),
    HistoryRange.D7: (7 * 24 * 60 * 60, 3600),
}

SUMMARY_METRICS: tuple[str, ...] = (
    "lte_rsrp",
    "lte_rsrq",
    "lte_sinr",
    "lte_rssi",
    "nr_rsrp",
    "nr_rsrq",
    "nr_sinr",
    "download_bps",
    "upload_bps",
)


class HistoryPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime
    lte_rsrp: float | None = None
    lte_rsrq: float | None = None
    lte_sinr: float | None = None
    lte_rssi: float | None = None
    nr_rsrp: float | None = None
    nr_rsrq: float | None = None
    nr_sinr: float | None = None
    download_bps: float | None = None
    upload_bps: float | None = None
    download_bytes: int | None = None
    upload_bytes: int | None = None


class HistorySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current: dict[str, float | None] = Field(default_factory=dict)
    average: dict[str, float | None] = Field(default_factory=dict)
    minimum: dict[str, float | None] = Field(default_factory=dict)
    maximum: dict[str, float | None] = Field(default_factory=dict)


class HistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    range: HistoryRange
    from_at: datetime
    to_at: datetime
    bucket_seconds: int
    points: list[HistoryPoint]
    summary: HistorySummary
