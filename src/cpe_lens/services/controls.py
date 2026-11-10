from __future__ import annotations

import asyncio
import secrets
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from cpe_lens.adapters.parsing import mask_phone
from cpe_lens.config import Settings
from cpe_lens.models.capability import CapabilityStatus
from cpe_lens.models.controls import (
    DhcpSettings,
    FirewallSettings,
    OperationLogEntry,
    OperationPlan,
    OperationResult,
    OperationStatus,
    RiskLevel,
    VerificationStatus,
)
from cpe_lens.models.errors import (
    ConfirmationRequiredError,
    DeviceNotSupportedError,
    DomainError,
    InvalidOperationTokenError,
    OperationUnavailableError,
    PlanExpiredError,
)
from cpe_lens.services.device_manager import DeviceManager
from cpe_lens.storage.operations import OperationStore
from cpe_lens.utils import utc_now

_PLAN_TTL = timedelta(minutes=2)
_PLAN_EXPIRED_ERROR = "plan expired"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WifiParams(StrictModel):
    ssid: str = Field(min_length=1, max_length=32)
    hidden: bool = False
    password: str | None = Field(default=None, min_length=8, max_length=63)


class ToggleParams(StrictModel):
    enabled: bool


class NoParams(StrictModel):
    pass


class RadioParams(StrictModel):
    network_mode: str
    lte_bands: list[int] | None = None

    @field_validator("network_mode")
    @classmethod
    def _valid_mode(cls, value: str) -> str:
        allowed = {"00", "01", "02", "0201", "03", "0301", "0302"}
        if value not in allowed:
            raise ValueError("unsupported network mode")
        return value

    @field_validator("lte_bands")
    @classmethod
    def _valid_bands(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        if any(band < 1 or band > 100 for band in value):
            raise ValueError("LTE band out of range")
        return sorted(set(value))


class ApnCreateParams(StrictModel):
    name: str = Field(min_length=1, max_length=64)
    apn: str = Field(min_length=1, max_length=128)
    username: str | None = None
    password: str | None = None
    auth_mode: int = 0
    ip_type: int = 2
    is_default: bool = False


class ApnUpdateParams(ApnCreateParams):
    index: int = Field(ge=0)


class ApnIndexParams(StrictModel):
    index: int = Field(ge=0)


class SmsSendParams(StrictModel):
    phone: str = Field(min_length=1, max_length=32)
    message: str = Field(min_length=1, max_length=1600)


class SmsIndexParams(StrictModel):
    index: int = Field(ge=0)


class UssdParams(StrictModel):
    code: str = Field(min_length=1, max_length=128)


class DhcpParams(StrictModel):
    enabled: bool | None = None
    ip_address: str | None = None
    netmask: str | None = None
    start_ip: str | None = None
    end_ip: str | None = None
    lease_seconds: int | None = Field(default=None, ge=60)
    dns_enabled: bool | None = None
    primary_dns: str | None = None
    secondary_dns: str | None = None


class DmzParams(StrictModel):
    enabled: bool
    ip_address: str = ""


class FirewallParams(StrictModel):
    enabled: bool
    ip_filter: bool = False
    wan_ping_filter: bool = True
    url_filter: bool = False
    mac_filter: bool = False


@dataclass
class PlanData:
    current: dict[str, Any]
    proposed: dict[str, Any]
    warnings: list[str]
    log_current: dict[str, Any] = field(default_factory=dict)
    log_proposed: dict[str, Any] = field(default_factory=dict)


@dataclass
class VerifyData:
    status: VerificationStatus
    actual: dict[str, Any] = field(default_factory=dict)


ParamT = BaseModel


class Action:
    id: str
    title_key: str
    risk: RiskLevel
    capabilities: tuple[str, ...]
    params_model: type[StrictModel]

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        raise NotImplementedError

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        raise NotImplementedError

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        raise NotImplementedError


class ToggleAction(Action):
    def __init__(
        self,
        *,
        id: str,
        title_key: str,
        risk: RiskLevel,
        capability: str,
        read: Callable[[DeviceManager], Awaitable[dict[str, Any]]],
        write: Callable[[DeviceManager, bool], Awaitable[None]],
        warning_on: str | None = None,
        warning_off: str | None = None,
    ) -> None:
        self.id = id
        self.title_key = title_key
        self.risk = risk
        self.capabilities = (capability,)
        self.params_model = ToggleParams
        self._read = read
        self._write = write
        self._warning_on = warning_on
        self._warning_off = warning_off

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, ToggleParams)
        current = await self._read(manager)
        proposed = {"enabled": params.enabled}
        warnings = []
        warning = self._warning_on if params.enabled else self._warning_off
        if warning:
            warnings.append(warning)
        return PlanData(
            current=current, proposed=proposed, warnings=warnings, log_current=current, log_proposed=proposed
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, ToggleParams)
        await self._write(manager, params.enabled)
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, ToggleParams)
        try:
            current = await self._read(manager)
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE, actual={})
        actual = {"enabled": current.get("enabled")}
        status = VerificationStatus.VERIFIED if actual["enabled"] is params.enabled else VerificationStatus.FAILED
        return VerifyData(status=status, actual=actual)


class WifiAction(Action):
    id = "wifi.update"
    title_key = "control.wifiUpdate.title"
    risk = RiskLevel.HIGH
    capabilities = ("wifi_settings",)
    params_model = WifiParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, WifiParams)
        current = (await manager.read_wifi()).model_dump()
        proposed = {
            "ssid": params.ssid,
            "hidden": params.hidden,
            "password_changed": bool(params.password),
        }
        warnings = ["control.wifiUpdate.disconnectWarning"]
        if params.password:
            warnings.append("control.wifiUpdate.passwordUnverifiable")
        return PlanData(
            current=current, proposed=proposed, warnings=warnings, log_current=current, log_proposed=proposed
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, WifiParams)
        await manager.run_control(
            lambda adapter: adapter.update_wifi_settings(
                ssid=params.ssid,
                hidden=params.hidden,
                password=params.password,
            )
        )
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, WifiParams)
        await asyncio.sleep(2)
        try:
            current = await manager.read_wifi()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        actual = current.model_dump()
        if current.ssid != params.ssid or current.hidden is not params.hidden:
            return VerifyData(status=VerificationStatus.FAILED, actual=actual)
        if params.password:
            return VerifyData(status=VerificationStatus.PARTIAL, actual=actual)
        return VerifyData(status=VerificationStatus.VERIFIED, actual=actual)


class RadioAction(Action):
    id = "radio.update"
    title_key = "control.radioUpdate.title"
    risk = RiskLevel.HIGH
    capabilities = ("network_mode", "band_lock")
    params_model = RadioParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, RadioParams)
        current = (await manager.read_mobile()).model_dump()
        proposed = {"network_mode": params.network_mode, "lte_bands": params.lte_bands}
        return PlanData(
            current=current,
            proposed=proposed,
            warnings=["control.radioUpdate.disconnectWarning", "control.radioUpdate.delayWarning"],
            log_current=current,
            log_proposed=proposed,
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, RadioParams)
        await manager.run_control(lambda adapter: adapter.set_radio_mode(params.network_mode, params.lte_bands))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, RadioParams)
        await asyncio.sleep(2)
        try:
            current = await manager.read_mobile()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        actual = current.model_dump()
        mode_ok = current.network_mode == params.network_mode
        bands_ok = params.lte_bands is None or current.lte_bands == params.lte_bands
        return VerifyData(
            status=VerificationStatus.VERIFIED if mode_ok and bands_ok else VerificationStatus.PARTIAL,
            actual=actual,
        )


class ReconnectAction(Action):
    id = "mobile.reconnect"
    title_key = "control.reconnect.title"
    risk = RiskLevel.HIGH
    capabilities = ("reconnect",)
    params_model = NoParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        return PlanData(
            current={},
            proposed={"reconnect": True},
            warnings=["control.reconnect.disconnectWarning"],
            log_current={},
            log_proposed={"reconnect": True},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        await manager.run_control(lambda adapter: adapter.reconnect())
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        return VerifyData(status=VerificationStatus.UNVERIFIABLE)


class RebootAction(Action):
    id = "device.reboot"
    title_key = "control.reboot.title"
    risk = RiskLevel.HIGH
    capabilities = ("reboot",)
    params_model = NoParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        return PlanData(
            current={},
            proposed={"reboot": True},
            warnings=["control.reboot.disconnectWarning", "control.reboot.longWarning"],
            log_current={},
            log_proposed={"reboot": True},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        await manager.run_control(lambda adapter: adapter.reboot())
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        return VerifyData(status=VerificationStatus.UNVERIFIABLE)


class ApnCreateAction(Action):
    id = "apn.create"
    title_key = "control.apnCreate.title"
    risk = RiskLevel.MEDIUM
    capabilities = ("apn_profiles",)
    params_model = ApnCreateParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, ApnCreateParams)
        profiles = await manager.read_apn_profiles()
        return PlanData(
            current={"profiles": [profile.model_dump() for profile in profiles]},
            proposed={"name": params.name, "apn": params.apn, "is_default": params.is_default},
            warnings=["control.apnCreate.warning"] if params.is_default else [],
            log_current={"count": len(profiles)},
            log_proposed={"name": params.name, "apn": params.apn, "is_default": params.is_default},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, ApnCreateParams)
        await manager.run_control(
            lambda adapter: adapter.create_apn_profile(
                name=params.name,
                apn=params.apn,
                username=params.username,
                password=params.password,
                auth_mode=params.auth_mode,
                ip_type=params.ip_type,
                is_default=params.is_default,
            )
        )
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, ApnCreateParams)
        try:
            profiles = await manager.read_apn_profiles()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        found = any(profile.apn == params.apn and profile.name == params.name for profile in profiles)
        return VerifyData(
            status=VerificationStatus.VERIFIED if found else VerificationStatus.FAILED,
            actual={"count": len(profiles)},
        )


class ApnUpdateAction(ApnCreateAction):
    id = "apn.update"
    title_key = "control.apnUpdate.title"
    params_model = ApnUpdateParams  # type: ignore[assignment]

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, ApnUpdateParams)
        profiles = await manager.read_apn_profiles()
        current = next((profile for profile in profiles if profile.index == params.index), None)
        if current is None:
            raise OperationUnavailableError("APN profile not found")
        return PlanData(
            current=current.model_dump(),
            proposed={"name": params.name, "apn": params.apn, "is_default": params.is_default},
            warnings=["control.apnUpdate.warning"] if params.is_default else [],
            log_current={"index": current.index, "name": current.name, "apn": current.apn},
            log_proposed={"index": params.index, "name": params.name, "apn": params.apn},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, ApnUpdateParams)
        await manager.run_control(
            lambda adapter: adapter.update_apn_profile(
                index=params.index,
                name=params.name,
                apn=params.apn,
                username=params.username,
                password=params.password,
                auth_mode=params.auth_mode,
                ip_type=params.ip_type,
                is_default=params.is_default,
            )
        )
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, ApnUpdateParams)
        try:
            profiles = await manager.read_apn_profiles()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        found = next((profile for profile in profiles if profile.index == params.index), None)
        ok = found is not None and found.name == params.name and found.apn == params.apn
        return VerifyData(
            status=VerificationStatus.VERIFIED if ok else VerificationStatus.FAILED,
            actual=found.model_dump() if found else {},
        )


class ApnDeleteAction(Action):
    id = "apn.delete"
    title_key = "control.apnDelete.title"
    risk = RiskLevel.HIGH
    capabilities = ("apn_profiles",)
    params_model = ApnIndexParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, ApnIndexParams)
        profiles = await manager.read_apn_profiles()
        current = next((profile for profile in profiles if profile.index == params.index), None)
        if current is None:
            raise OperationUnavailableError("APN profile not found")
        return PlanData(
            current=current.model_dump(),
            proposed={"deleted": True, "index": params.index},
            warnings=["control.apnDelete.warning"],
            log_current={"index": current.index, "name": current.name, "apn": current.apn},
            log_proposed={"deleted": True, "index": params.index},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, ApnIndexParams)
        await manager.run_control(lambda adapter: adapter.delete_apn_profile(params.index))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, ApnIndexParams)
        try:
            profiles = await manager.read_apn_profiles()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        found = any(profile.index == params.index for profile in profiles)
        return VerifyData(
            status=VerificationStatus.FAILED if found else VerificationStatus.VERIFIED,
            actual={"count": len(profiles)},
        )


class ApnDefaultAction(ApnDeleteAction):
    id = "apn.default"
    title_key = "control.apnDefault.title"
    params_model = ApnIndexParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, ApnIndexParams)
        profiles = await manager.read_apn_profiles()
        current = next((profile for profile in profiles if profile.index == params.index), None)
        if current is None:
            raise OperationUnavailableError("APN profile not found")
        return PlanData(
            current={"profiles": [profile.model_dump() for profile in profiles]},
            proposed={"index": params.index, "name": current.name, "apn": current.apn},
            warnings=["control.apnDefault.warning"],
            log_current={"count": len(profiles)},
            log_proposed={"index": params.index, "name": current.name, "apn": current.apn},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, ApnIndexParams)
        await manager.run_control(lambda adapter: adapter.set_default_apn_profile(params.index))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, ApnIndexParams)
        try:
            profiles = await manager.read_apn_profiles()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        current = next((profile for profile in profiles if profile.index == params.index), None)
        return VerifyData(
            status=VerificationStatus.VERIFIED if current and current.is_default else VerificationStatus.FAILED,
            actual={"count": len(profiles)},
        )


class SmsSendAction(Action):
    id = "sms.send"
    title_key = "control.smsSend.title"
    risk = RiskLevel.MEDIUM
    capabilities = ("sms_send",)
    params_model = SmsSendParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, SmsSendParams)
        masked = mask_phone(params.phone)
        return PlanData(
            current={},
            proposed={"phone_masked": masked, "message": params.message, "message_length": len(params.message)},
            warnings=["control.smsSend.warning"],
            log_current={},
            log_proposed={"phone_masked": masked, "message_length": len(params.message)},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, SmsSendParams)
        await manager.run_control(lambda adapter: adapter.send_sms(phone=params.phone, message=params.message))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        return VerifyData(status=VerificationStatus.UNVERIFIABLE)


class SmsDeleteAction(Action):
    id = "sms.delete"
    title_key = "control.smsDelete.title"
    risk = RiskLevel.MEDIUM
    capabilities = ("sms_manage",)
    params_model = SmsIndexParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, SmsIndexParams)
        page = await manager.read_sms_page(page=1, read_count=20)
        current = next((message for message in page.messages if message.index == params.index), None)
        if current is None:
            raise OperationUnavailableError("SMS not found")
        return PlanData(
            current={"index": current.index, "phone_masked": current.phone_masked, "received_at": current.received_at},
            proposed={"deleted": True, "index": params.index},
            warnings=["control.smsDelete.warning"],
            log_current={"index": current.index, "phone_masked": current.phone_masked},
            log_proposed={"deleted": True, "index": params.index},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, SmsIndexParams)
        await manager.run_control(lambda adapter: adapter.delete_sms(params.index))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, SmsIndexParams)
        try:
            page = await manager.read_sms_page(page=1, read_count=20)
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        found = any(message.index == params.index for message in page.messages)
        return VerifyData(
            status=VerificationStatus.FAILED if found else VerificationStatus.VERIFIED,
            actual={"index": params.index},
        )


class SmsReadAction(SmsDeleteAction):
    id = "sms.mark_read"
    title_key = "control.smsRead.title"
    risk = RiskLevel.LOW
    capabilities = ("sms_manage",)

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, SmsIndexParams)
        data = await super().plan(manager, params)
        data.proposed = {"index": params.index, "read": True}
        data.warnings = []
        data.log_proposed = {"index": params.index, "read": True}
        return data

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, SmsIndexParams)
        await manager.run_control(lambda adapter: adapter.mark_sms_read(params.index))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        return VerifyData(status=VerificationStatus.UNVERIFIABLE)


class UssdAction(Action):
    id = "ussd.send"
    title_key = "control.ussdSend.title"
    risk = RiskLevel.MEDIUM
    capabilities = ("ussd",)
    params_model = UssdParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, UssdParams)
        state = await manager.read_ussd()
        return PlanData(
            current=state.model_dump(),
            proposed={"code": params.code},
            warnings=["control.ussdSend.warning"],
            log_current={},
            log_proposed={"code_length": len(params.code), "prefix": params.code[:2] + "***"},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, UssdParams)
        response = await manager.run_control(lambda adapter: adapter.send_ussd(params.code))
        return {"response": response} if response else {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        return VerifyData(status=VerificationStatus.UNVERIFIABLE)


class DhcpAction(Action):
    id = "advanced.dhcp"
    title_key = "control.dhcp.title"
    risk = RiskLevel.HIGH
    capabilities = ("dhcp",)
    params_model = DhcpParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, DhcpParams)
        current = (await manager.read_advanced()).dhcp
        merged = _merge_dhcp(current, params)
        return PlanData(
            current=current.model_dump(),
            proposed=merged.model_dump(),
            warnings=["control.dhcp.disconnectWarning"],
            log_current={"ip_address": current.ip_address, "start_ip": current.start_ip, "end_ip": current.end_ip},
            log_proposed={"ip_address": merged.ip_address, "start_ip": merged.start_ip, "end_ip": merged.end_ip},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, DhcpParams)
        current = (await manager.read_advanced()).dhcp
        merged = _merge_dhcp(current, params)
        await manager.run_control(lambda adapter: adapter.set_dhcp(merged))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, DhcpParams)
        try:
            current = (await manager.read_advanced()).dhcp
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        expected = plan.proposed
        ok = all(
            getattr(current, key) == expected.get(key)
            for key in ("enabled", "ip_address", "netmask", "start_ip", "end_ip", "dns_enabled")
        )
        return VerifyData(
            status=VerificationStatus.VERIFIED if ok else VerificationStatus.PARTIAL,
            actual=current.model_dump(),
        )


class DmzAction(Action):
    id = "advanced.dmz"
    title_key = "control.dmz.title"
    risk = RiskLevel.MEDIUM
    capabilities = ("dmz",)
    params_model = DmzParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, DmzParams)
        current = await manager.read_advanced()
        return PlanData(
            current={"enabled": current.dmz_enabled, "ip_address": current.dmz_ip},
            proposed={"enabled": params.enabled, "ip_address": params.ip_address},
            warnings=["control.dmz.warning"] if params.enabled else [],
            log_current={"enabled": current.dmz_enabled, "ip_address": current.dmz_ip},
            log_proposed={"enabled": params.enabled, "ip_address": params.ip_address},
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, DmzParams)
        await manager.run_control(lambda adapter: adapter.set_dmz(params.enabled, params.ip_address))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, DmzParams)
        try:
            current = await manager.read_advanced()
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        ok = current.dmz_enabled is params.enabled and (not params.enabled or current.dmz_ip == params.ip_address)
        return VerifyData(
            status=VerificationStatus.VERIFIED if ok else VerificationStatus.FAILED,
            actual={"enabled": current.dmz_enabled, "ip_address": current.dmz_ip},
        )


class FirewallAction(Action):
    id = "advanced.firewall"
    title_key = "control.firewall.title"
    risk = RiskLevel.MEDIUM
    capabilities = ("firewall",)
    params_model = FirewallParams

    async def plan(self, manager: DeviceManager, params: BaseModel) -> PlanData:
        assert isinstance(params, FirewallParams)
        current = (await manager.read_advanced()).firewall
        proposed = params.model_dump()
        return PlanData(
            current=current.model_dump(),
            proposed=proposed,
            warnings=["control.firewall.warning"],
            log_current=current.model_dump(),
            log_proposed=proposed,
        )

    async def apply(self, manager: DeviceManager, params: BaseModel) -> dict[str, Any]:
        assert isinstance(params, FirewallParams)
        await manager.run_control(lambda adapter: adapter.set_firewall(FirewallSettings(**params.model_dump())))
        return {}

    async def verify(self, manager: DeviceManager, params: BaseModel, plan: PlanData) -> VerifyData:
        assert isinstance(params, FirewallParams)
        try:
            current = (await manager.read_advanced()).firewall
        except DomainError:
            return VerifyData(status=VerificationStatus.UNVERIFIABLE)
        expected = params.model_dump()
        ok = all(getattr(current, key) == value for key, value in expected.items())
        return VerifyData(
            status=VerificationStatus.VERIFIED if ok else VerificationStatus.PARTIAL,
            actual=current.model_dump(),
        )


def _merge_dhcp(current: DhcpSettings, params: DhcpParams) -> DhcpSettings:
    data = current.model_dump()
    for key, value in params.model_dump(exclude_none=True).items():
        data[key] = value
    return DhcpSettings(**data)


class UpnpToggleAction(ToggleAction):
    def __init__(self) -> None:
        async def read(manager: DeviceManager) -> dict[str, Any]:
            settings = await manager.read_advanced()
            return {"enabled": settings.upnp_enabled}

        async def write(manager: DeviceManager, enabled: bool) -> None:
            await manager.run_control(lambda adapter: adapter.set_upnp(enabled))

        super().__init__(
            id="advanced.upnp",
            title_key="control.upnp.title",
            risk=RiskLevel.MEDIUM,
            capability="upnp",
            read=read,
            write=write,
            warning_on="control.upnp.warning",
        )


class MobileDataAction(ToggleAction):
    def __init__(self) -> None:
        async def read(manager: DeviceManager) -> dict[str, Any]:
            settings = await manager.read_mobile()
            return {"enabled": settings.data_enabled}

        async def write(manager: DeviceManager, enabled: bool) -> None:
            await manager.run_control(lambda adapter: adapter.set_mobile_data(enabled))

        super().__init__(
            id="mobile.data",
            title_key="control.mobileData.title",
            risk=RiskLevel.HIGH,
            capability="mobile_data_switch",
            read=read,
            write=write,
            warning_off="control.mobileData.disconnectWarning",
        )


class RoamingAction(ToggleAction):
    def __init__(self) -> None:
        async def read(manager: DeviceManager) -> dict[str, Any]:
            settings = await manager.read_mobile()
            return {"enabled": settings.roaming_enabled}

        async def write(manager: DeviceManager, enabled: bool) -> None:
            await manager.run_control(lambda adapter: adapter.set_roaming(enabled))

        super().__init__(
            id="mobile.roaming",
            title_key="control.roaming.title",
            risk=RiskLevel.MEDIUM,
            capability="roaming_switch",
            read=read,
            write=write,
            warning_on="control.roaming.costWarning",
        )


ACTIONS: dict[str, Action] = {
    action.id: action
    for action in (
        WifiAction(),
        MobileDataAction(),
        RoamingAction(),
        ReconnectAction(),
        RebootAction(),
        RadioAction(),
        ApnCreateAction(),
        ApnUpdateAction(),
        ApnDeleteAction(),
        ApnDefaultAction(),
        SmsSendAction(),
        SmsDeleteAction(),
        SmsReadAction(),
        UssdAction(),
        DhcpAction(),
        UpnpToggleAction(),
        DmzAction(),
        FirewallAction(),
    )
}


@dataclass
class _Pending:
    action: Action
    params: BaseModel
    plan: PlanData
    expires_at: datetime
    session_key: str | None


class OperationService:
    def __init__(self, manager: DeviceManager, store: OperationStore, settings: Settings) -> None:
        self._manager = manager
        self._store = store
        self._settings = settings
        self._pending: dict[str, _Pending] = {}
        self._lock = asyncio.Lock()

    def _check_capabilities(self, action: Action) -> None:
        snapshot = self._manager.snapshot()
        if not snapshot.connected:
            from cpe_lens.models.errors import NotConnectedError

            raise NotConnectedError("device is not connected")
        if snapshot.capability_report is None:
            from cpe_lens.models.errors import CapabilitiesNotProbedError

            raise CapabilitiesNotProbedError("capabilities have not been probed")
        for capability_id in action.capabilities:
            result = self._manager.capability(capability_id)
            if result is None:
                raise OperationUnavailableError(f"capability {capability_id} has not been probed")
            if result.status in {
                CapabilityStatus.UNSUPPORTED,
                CapabilityStatus.NO_PERMISSION,
                CapabilityStatus.UNAVAILABLE,
                CapabilityStatus.PROBE_FAILED,
            }:
                raise OperationUnavailableError(f"capability {capability_id} is not currently available")

    async def plan(self, action_id: str, params: dict[str, Any]) -> OperationPlan:
        action = ACTIONS.get(action_id)
        if action is None:
            raise OperationUnavailableError("unknown operation")
        try:
            validated = action.params_model.model_validate(params)
        except ValidationError as exc:
            fields = sorted({".".join(str(part) for part in error["loc"]) for error in exc.errors()})
            from cpe_lens.models.errors import InvalidRequestError

            raise InvalidRequestError(", ".join(fields) or None) from exc
        self._check_capabilities(action)
        plan = await action.plan(self._manager, validated)
        now = utc_now()
        expired = [key for key, pending in self._pending.items() if pending.expires_at < now]
        for key in expired:
            self._pending.pop(key, None)
        token = secrets.token_urlsafe(24)
        expires_at = now + _PLAN_TTL
        snapshot = self._manager.snapshot()
        session_key = f"{snapshot.address}|{snapshot.connected_at.isoformat() if snapshot.connected_at else ''}"
        self._pending[token] = _Pending(
            action=action,
            params=validated,
            plan=plan,
            expires_at=expires_at,
            session_key=session_key,
        )
        return OperationPlan(
            token=token,
            action=action.id,
            title_key=action.title_key,
            risk=action.risk,
            capability_ids=list(action.capabilities),
            current=plan.current,
            proposed=plan.proposed,
            warnings=plan.warnings,
            expires_at=expires_at,
        )

    async def apply(self, token: str, confirm: bool) -> OperationResult:
        if not confirm:
            raise ConfirmationRequiredError("confirmation is required")
        async with self._lock:
            pending = self._pending.pop(token, None)
            if pending is None:
                raise InvalidOperationTokenError("operation token is invalid or already used")
            if utc_now() > pending.expires_at:
                raise PlanExpiredError(_PLAN_EXPIRED_ERROR)
            snapshot = self._manager.snapshot()
            session_key = f"{snapshot.address}|{snapshot.connected_at.isoformat() if snapshot.connected_at else ''}"
            if session_key != pending.session_key:
                raise InvalidOperationTokenError("device session changed")
            action = pending.action
            self._check_capabilities(action)
            status = OperationStatus.SUCCESS
            verification = VerificationStatus.NOT_ATTEMPTED
            output: dict[str, Any] = {}
            error = None
            message_key = "operation.success"
            try:
                output = await action.apply(self._manager, pending.params)
                verified = await action.verify(self._manager, pending.params, pending.plan)
                verification = verified.status
                if verification is VerificationStatus.VERIFIED:
                    message_key = "operation.verified"
                elif verification is VerificationStatus.PARTIAL:
                    message_key = "operation.partial"
                elif verification is VerificationStatus.UNVERIFIABLE:
                    message_key = "operation.unverifiable"
                elif verification is VerificationStatus.FAILED:
                    status = OperationStatus.FAILED
                    message_key = "operation.verifyFailed"
            except DomainError as exc:
                status = (
                    OperationStatus.UNSUPPORTED if isinstance(exc, DeviceNotSupportedError) else OperationStatus.FAILED
                )
                error = exc.to_info()
                message_key = exc.message_key
                output = {}
            device = self._manager.snapshot().device
            device_model = device.model if device is not None else None
            operation_id = self._store.record(
                action=action.id,
                title_key=action.title_key,
                risk=action.risk,
                status=status,
                verification=verification,
                capability_ids=list(action.capabilities),
                current=pending.plan.log_current,
                proposed=pending.plan.log_proposed,
                message_key=message_key,
                device_model=device_model,
            )
            return OperationResult(
                operation_id=operation_id,
                action=action.id,
                status=status,
                verification=verification,
                current=pending.plan.current,
                proposed=pending.plan.proposed,
                output=output,
                message_key=message_key,
                error=error,
            )

    def list_logs(self, limit: int = 50) -> list[OperationLogEntry]:
        return self._store.list_recent(limit)
