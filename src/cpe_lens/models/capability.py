from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class CapabilityStatus(StrEnum):
    AVAILABLE = "available"
    EXPERIMENTAL = "experimental"
    UNAVAILABLE = "unavailable"
    NO_PERMISSION = "no_permission"
    UNSUPPORTED = "unsupported"
    PROBE_FAILED = "probe_failed"


class CapabilityReason(StrEnum):
    OK = "ok"
    WRITE_NOT_VERIFIED = "write_not_verified"
    NO_SAFE_PROBE = "no_safe_probe"
    NO_SUPPORT = "no_support"
    LOGIN_REQUIRED = "login_required"
    NO_PERMISSION = "no_permission"
    TIMEOUT = "timeout"
    CONNECTION_ERROR = "connection_error"
    DEVICE_BUSY = "device_busy"
    BAD_RESPONSE = "bad_response"
    CONDITION_NOT_MET = "condition_not_met"
    UNKNOWN = "unknown"


class CapabilityCategory(StrEnum):
    DEVICE = "device"
    NETWORK = "network"
    SIGNAL = "signal"
    TRAFFIC = "traffic"
    CLIENTS = "clients"
    WIFI = "wifi"
    MOBILE = "mobile"
    MESSAGING = "messaging"
    ADVANCED = "advanced"
    SYSTEM = "system"


class CapabilityAccess(StrEnum):
    READ = "read"
    WRITE = "write"


class CapabilityResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    category: CapabilityCategory
    access: CapabilityAccess
    status: CapabilityStatus
    reason: CapabilityReason
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    duration_ms: int | None = Field(default=None, ge=0)
    detail: str | None = None


class CapabilityReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    probed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    adapter: str
    source: str
    device_model: str | None = None
    firmware_version: str | None = None
    notice_key: str | None = None
    capabilities: list[CapabilityResult]


def summarize_capabilities(capabilities: list[CapabilityResult]) -> dict[CapabilityStatus, int]:
    summary = {status: 0 for status in CapabilityStatus}
    for capability in capabilities:
        summary[capability.status] += 1
    return summary
