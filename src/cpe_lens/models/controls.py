from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from cpe_lens.models.errors import ErrorInfo


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class VerificationStatus(StrEnum):
    NOT_ATTEMPTED = "not_attempted"
    VERIFIED = "verified"
    PARTIAL = "partial"
    UNVERIFIABLE = "unverifiable"
    FAILED = "failed"


class OperationStatus(StrEnum):
    SUCCESS = "success"
    FAILED = "failed"
    REJECTED = "rejected"
    UNSUPPORTED = "unsupported"


class WifiSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ssid: str | None = None
    hidden: bool | None = None
    security_mode: str | None = None


class ApnProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int
    name: str | None = None
    apn: str | None = None
    username: str | None = None
    auth_mode: int | None = None
    ip_type: int | None = None
    is_default: bool = False
    read_only: bool = False


class SmsMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int
    phone: str | None = None
    content: str
    received_at: str | None = None
    is_read: bool | None = None


class SmsPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[SmsMessage]
    page: int
    read_count: int
    has_more: bool = False


class NetworkModeOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    label: str | None = None
    is_5g: bool = False


class MobileSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data_enabled: bool | None = None
    roaming_enabled: bool | None = None
    network_mode: str | None = None
    lte_band_mask: str | None = None
    lte_bands: list[int] = Field(default_factory=list)
    network_modes: list[NetworkModeOption] = Field(default_factory=list)


class DhcpSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool | None = None
    ip_address: str | None = None
    netmask: str | None = None
    start_ip: str | None = None
    end_ip: str | None = None
    lease_seconds: int | None = None
    dns_enabled: bool | None = None
    primary_dns: str | None = None
    secondary_dns: str | None = None


class FirewallSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool | None = None
    ip_filter: bool | None = None
    wan_ping_filter: bool | None = None
    url_filter: bool | None = None
    mac_filter: bool | None = None


class AdvancedSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dhcp: DhcpSettings
    upnp_enabled: bool | None = None
    dmz_enabled: bool | None = None
    dmz_ip: str | None = None
    firewall: FirewallSettings


class UssdState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    response: str | None = None


class OperationPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    action: str
    title_key: str
    risk: RiskLevel
    capability_ids: list[str]
    current: dict[str, Any]
    proposed: dict[str, Any]
    warnings: list[str]
    expires_at: datetime


class OperationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation_id: int | None = None
    action: str
    status: OperationStatus
    verification: VerificationStatus = VerificationStatus.NOT_ATTEMPTED
    current: dict[str, Any] = Field(default_factory=dict)
    proposed: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    message_key: str
    error: ErrorInfo | None = None


class OperationLogEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    created_at: datetime
    action: str
    title_key: str
    risk: RiskLevel
    status: OperationStatus
    verification: VerificationStatus
    capability_ids: list[str]
    current: dict[str, Any]
    proposed: dict[str, Any]
    message_key: str
    device_model: str | None = None


class DiagnosticReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generated_at: datetime
    app_version: str
    device: dict[str, Any]
    capabilities: list[dict[str, Any]]
    live_errors: dict[str, ErrorInfo | None]
    operations: list[OperationLogEntry]
    settings: dict[str, Any]
