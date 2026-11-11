from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from cpe_lens.models.capability import CapabilityReport
from cpe_lens.models.errors import ErrorInfo


class DeviceInfo(BaseModel):
    """Normalized device identity.

    Raw HiLink fields remain absent. The IMEI is exposed in full per the product
    requirement; login passwords and session secrets are never part of this model.
    """

    model_config = ConfigDict(extra="forbid")

    model: str | None = None
    hardware_version: str | None = None
    firmware_version: str | None = None
    web_ui_version: str | None = None
    device_name: str | None = None
    imei: str | None = None
    operator: str | None = None
    network_type: str | None = None
    connection_status: str | None = None


class ConnectionSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connected: bool = False
    address: str | None = None
    username: str | None = None
    connected_at: datetime | None = None
    last_seen_at: datetime | None = None
    reconnect_count: int = 0
    last_error: ErrorInfo | None = None
    device: DeviceInfo | None = None
    capability_report: CapabilityReport | None = None
