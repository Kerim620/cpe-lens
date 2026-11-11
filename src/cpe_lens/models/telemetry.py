from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from cpe_lens.models.errors import ErrorInfo


class SignalQuality(StrEnum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class CellRadio(StrEnum):
    LTE = "lte"
    NR = "nr"


class ClientConnectionType(StrEnum):
    WIFI = "wifi"
    ETHERNET = "ethernet"
    UNKNOWN = "unknown"


class RadioMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rsrp_dbm: float | None = None
    rsrq_db: float | None = None
    rssi_dbm: float | None = None
    sinr_db: float | None = None
    band: str | None = None
    pci: int | None = None
    cell_id: str | None = None
    arfcn: int | None = None
    dl_bandwidth_mhz: float | None = None
    ul_bandwidth_mhz: float | None = None
    cqi: int | None = None
    mcs: int | None = None
    tx_power_dbm: float | None = None
    rank: int | None = None
    quality: SignalQuality | None = None


class SignalSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lte: RadioMetrics | None = None
    nr: RadioMetrics | None = None


class CellEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    radio: CellRadio
    band: str | None = None
    pci: int | None = None
    cell_id: str | None = None
    arfcn: int | None = None
    dl_bandwidth_mhz: float | None = None
    ul_bandwidth_mhz: float | None = None
    source: str = "cell_info"


class CellSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cells: list[CellEntry]


class ClientInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hostname: str | None = None
    ip_address: str | None = None
    mac: str | None = None
    connection_type: ClientConnectionType = ClientConnectionType.UNKNOWN
    online_seconds: int | None = None


class ClientSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clients: list[ClientInfo]
    count: int


class NetworkStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator: str | None = None
    network_type: str | None = None
    roaming: bool | None = None
    signal_bars: int | None = None
    wan_ip: str | None = None
    connect_time_seconds: int | None = None
    uptime_seconds: int | None = None


class TrafficSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    download_bps: float | None = None
    upload_bps: float | None = None
    session_download_bytes: int | None = None
    session_upload_bytes: int | None = None
    today_download_bytes: int | None = None
    today_upload_bytes: int | None = None
    month_download_bytes: int | None = None
    month_upload_bytes: int | None = None
    total_download_bytes: int | None = None
    total_upload_bytes: int | None = None
    current_connect_seconds: int | None = None
    total_connect_seconds: int | None = None


DataT = TypeVar("DataT")


class LiveSection(BaseModel, Generic[DataT]):
    model_config = ConfigDict(extra="forbid")

    data: DataT | None = None
    error: ErrorInfo | None = None
    updated_at: datetime | None = None
    stale: bool = False


class LiveDashboard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generated_at: datetime
    connected: bool
    sampled_at: datetime | None = None
    status: LiveSection[NetworkStatus]
    signal: LiveSection[SignalSnapshot]
    cells: LiveSection[CellSnapshot]
    traffic: LiveSection[TrafficSnapshot]
    clients: LiveSection[ClientSnapshot]
