from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Final, TypeVar

import requests
from huawei_lte_api.Client import Client
from huawei_lte_api.Connection import Connection
from huawei_lte_api.enums.device import ControlModeEnum
from huawei_lte_api.enums.dialup import AuthModeEnum, IpType
from huawei_lte_api.enums.net import LTEBandEnum, NetworkBandEnum
from huawei_lte_api.enums.sms import BoxTypeEnum
from huawei_lte_api.exceptions import (
    LoginErrorAlreadyLoginException,
    LoginErrorInvalidCredentialsException,
    LoginErrorUsernamePasswordOverrunException,
    ResponseErrorException,
    ResponseErrorLoginCsrfException,
    ResponseErrorLoginRequiredException,
    ResponseErrorNotSupportedException,
    ResponseErrorSystemBusyException,
    ResponseErrorWrongSessionToken,
)

from cpe_lens.adapters.base import DeviceAdapter
from cpe_lens.adapters.parsing import (
    as_bool,
    as_int,
    bands_from_mask,
    field,
    find_list,
    hex_int,
    last_octet,
    mask_phone,
    parse_cells,
    parse_clients,
    parse_network_status,
    parse_signal,
    parse_traffic,
    text_field,
)
from cpe_lens.capabilities.definitions import CAPABILITIES, CapabilityDefinition
from cpe_lens.models.capability import (
    CapabilityAccess,
    CapabilityReason,
    CapabilityResult,
    CapabilityStatus,
)
from cpe_lens.models.controls import (
    AdvancedSettings,
    ApnProfile,
    DhcpSettings,
    FirewallSettings,
    MobileSettings,
    SmsMessage,
    SmsPage,
    UssdState,
    WifiSettings,
)
from cpe_lens.models.device import DeviceInfo
from cpe_lens.models.errors import (
    AuthenticationError,
    AuthExpiredError,
    DeviceBusyError,
    DeviceNotSupportedError,
    DevicePermissionError,
    DeviceProtocolError,
    DeviceTimeoutError,
    DeviceUnreachableError,
)
from cpe_lens.models.telemetry import (
    CellSnapshot,
    ClientSnapshot,
    NetworkStatus,
    SignalSnapshot,
    TrafficSnapshot,
)
from cpe_lens.utils import normalize_device_info, utc_now

_LOGGER = logging.getLogger(__name__)
_LIBRARY_LOGGER = logging.getLogger("huawei_lte_api")

T = TypeVar("T")


class _EmptyResponseError(Exception):
    pass


def _probe_device_info(client: Client) -> object:
    return client.device.information()


def _probe_network_status(client: Client) -> object:
    return client.monitoring.status()


def _probe_signal_metrics(client: Client) -> object:
    return client.device.signal()


def _probe_cell_info(client: Client) -> object:
    return client.net.cell_info()


def _probe_traffic_stats(client: Client) -> object:
    return client.monitoring.traffic_statistics()


def _probe_connected_clients(client: Client) -> object:
    return client.wlan.host_list()


def _probe_wifi_settings(client: Client) -> object:
    return client.wlan.basic_settings()


def _probe_guest_wifi(client: Client) -> object:
    return client.wlan.multi_basic_settings()


def _probe_mac_filter(client: Client) -> object:
    return client.wlan.mac_filter()


def _probe_network_mode(client: Client) -> object:
    return client.net.net_mode()


def _probe_cell_lock(client: Client) -> object:
    return client.ntwk.celllock()


def _probe_apn_profiles(client: Client) -> object:
    return client.dial_up.profiles()


def _probe_mobile_data_switch(client: Client) -> object:
    return client.dial_up.mobile_dataswitch()


def _probe_sms_count(client: Client) -> object:
    return client.sms.sms_count()


def _probe_connection(client: Client) -> object:
    return client.dial_up.connection()


def _probe_ussd(client: Client) -> object:
    return client.ussd.status()


def _probe_dhcp(client: Client) -> object:
    return client.dhcp.settings()


def _probe_port_mapping(client: Client) -> object:
    return client.security.virtual_servers()


def _probe_dmz(client: Client) -> object:
    return client.security.dmz()


def _probe_nat(client: Client) -> object:
    return client.security.nat()


def _probe_upnp(client: Client) -> object:
    return client.security.upnp()


def _probe_firewall(client: Client) -> object:
    return client.security.get_firewall_switch()


def _probe_diagnostics(client: Client) -> object:
    return client.diagnosis.time_reboot()


# Every capability with a probe endpoint must have a read-only call here.
PROBE_CALLS: Final[dict[str, Callable[[Client], object]]] = {
    "device_info": _probe_device_info,
    "network_status": _probe_network_status,
    "signal_metrics": _probe_signal_metrics,
    "cell_info": _probe_cell_info,
    "traffic_stats": _probe_traffic_stats,
    "connected_clients": _probe_connected_clients,
    "wifi_settings": _probe_wifi_settings,
    "guest_wifi": _probe_guest_wifi,
    "mac_filter": _probe_mac_filter,
    "network_mode": _probe_network_mode,
    "band_lock": _probe_network_mode,
    "cell_lock": _probe_cell_lock,
    "apn_profiles": _probe_apn_profiles,
    "mobile_data_switch": _probe_mobile_data_switch,
    "reconnect": _probe_network_mode,
    "roaming_switch": _probe_connection,
    "sms_inbox": _probe_sms_count,
    "sms_send": _probe_sms_count,
    "sms_manage": _probe_sms_count,
    "ussd": _probe_ussd,
    "dhcp": _probe_dhcp,
    "dns": _probe_dhcp,
    "port_mapping": _probe_port_mapping,
    "dmz": _probe_dmz,
    "nat": _probe_nat,
    "upnp": _probe_upnp,
    "firewall": _probe_firewall,
    "diagnostics": _probe_diagnostics,
}

_MISSING_PROBES = {
    definition.id
    for definition in CAPABILITIES
    if definition.probe_endpoint is not None and definition.id not in PROBE_CALLS
}
if _MISSING_PROBES:  # pragma: no cover - import-time guard
    msg = f"Missing read-only probes: {sorted(_MISSING_PROBES)}"
    raise RuntimeError(msg)


def _classify_probe_error(exc: Exception) -> tuple[CapabilityStatus, CapabilityReason, str]:
    if isinstance(exc, DeviceTimeoutError):
        return CapabilityStatus.PROBE_FAILED, CapabilityReason.TIMEOUT, "timeout"
    if isinstance(exc, DeviceUnreachableError):
        return CapabilityStatus.PROBE_FAILED, CapabilityReason.CONNECTION_ERROR, "connection error"
    if isinstance(exc, DevicePermissionError):
        return CapabilityStatus.NO_PERMISSION, CapabilityReason.NO_PERMISSION, "permission denied"
    if isinstance(exc, ResponseErrorNotSupportedException):
        return CapabilityStatus.UNSUPPORTED, CapabilityReason.NO_SUPPORT, "endpoint not supported"
    if isinstance(exc, ResponseErrorSystemBusyException):
        return CapabilityStatus.PROBE_FAILED, CapabilityReason.DEVICE_BUSY, "device busy"
    if isinstance(exc, ResponseErrorException):
        return (
            CapabilityStatus.PROBE_FAILED,
            CapabilityReason.UNKNOWN,
            f"device error {exc.code}",
        )
    if isinstance(exc, _EmptyResponseError):
        return CapabilityStatus.PROBE_FAILED, CapabilityReason.BAD_RESPONSE, "empty response"
    if isinstance(exc, DeviceProtocolError):
        return CapabilityStatus.PROBE_FAILED, CapabilityReason.BAD_RESPONSE, "bad response"
    return CapabilityStatus.PROBE_FAILED, CapabilityReason.UNKNOWN, type(exc).__name__


class HuaweiAdapter(DeviceAdapter):
    """Adapter around ``huawei-lte-api``.

    The adapter owns the session. Credentials are only kept long enough to open
    the connection; the connection manager keeps the in-memory copy needed for
    reconnects.
    """

    adapter_name = "huawei-lte-api"
    source = "real_device"
    notice_key = None

    def __init__(
        self,
        address: str,
        username: str,
        password: str,
        *,
        timeout_seconds: float,
    ) -> None:
        self._address = address
        self._username = username
        self._password: str | None = password
        self._timeout_seconds = timeout_seconds
        self._connection: Connection | None = None
        self._client: Client | None = None

    async def connect(self) -> None:
        # huawei-lte-api logs the password at DEBUG in Connection.__init__.
        # Force its logger above DEBUG as a second line of defence.
        _LIBRARY_LOGGER.setLevel(logging.WARNING)
        password = self._password
        if password is None:
            raise DeviceProtocolError("adapter password was already released")
        try:
            self._connection = await asyncio.to_thread(
                Connection,
                self._address,
                self._username,
                password,
                timeout=self._timeout_seconds,
            )
            self._client = Client(self._connection)
        except requests.Timeout as exc:
            raise DeviceTimeoutError("login timed out") from exc
        except requests.ConnectionError as exc:
            raise DeviceUnreachableError("could not reach device") from exc
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status == 401:
                raise AuthExpiredError("device rejected the session") from exc
            if status == 403:
                raise DevicePermissionError("device denied the login request") from exc
            raise DeviceProtocolError(f"device returned HTTP {status}") from exc
        except LoginErrorInvalidCredentialsException as exc:
            raise AuthenticationError("device rejected the username or password") from exc
        except LoginErrorUsernamePasswordOverrunException as exc:
            raise AuthenticationError("too many login attempts; wait before retrying") from exc
        except LoginErrorAlreadyLoginException as exc:
            raise AuthenticationError("another management session is already active") from exc
        except ResponseErrorSystemBusyException as exc:
            raise DeviceBusyError("device is busy") from exc
        except ResponseErrorNotSupportedException as exc:
            raise DeviceProtocolError("device does not expose the login API") from exc
        except ResponseErrorException as exc:
            raise DeviceProtocolError(f"device login failed with code {exc.code}") from exc
        except (ValueError, KeyError) as exc:
            raise DeviceProtocolError("device login response could not be parsed") from exc
        finally:
            self._password = None

    async def close(self) -> None:
        connection = self._connection
        self._connection = None
        self._client = None
        if connection is None:
            return
        try:
            await asyncio.to_thread(connection.close)
        except Exception as exc:
            _LOGGER.warning("Closing Huawei session failed: %s", type(exc).__name__)

    def _require_client(self) -> Client:
        if self._client is None:
            raise DeviceProtocolError("device is not connected")
        return self._client

    async def _call(self, fn: Callable[[], T]) -> T:
        try:
            return await asyncio.to_thread(fn)
        except requests.Timeout as exc:
            raise DeviceTimeoutError("device request timed out") from exc
        except requests.ConnectionError as exc:
            raise DeviceUnreachableError("device connection failed") from exc
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status == 401:
                raise AuthExpiredError("device session expired") from exc
            if status == 403:
                raise DevicePermissionError("device denied the request") from exc
            raise DeviceProtocolError(f"device returned HTTP {status}") from exc
        except (
            ResponseErrorLoginRequiredException,
            ResponseErrorWrongSessionToken,
            ResponseErrorLoginCsrfException,
        ) as exc:
            raise AuthExpiredError("device session expired") from exc

    async def get_device_info(self) -> DeviceInfo:
        client = self._require_client()
        try:
            information = await self._call(client.device.information)
        except ResponseErrorNotSupportedException as exc:
            raise DeviceProtocolError("device information endpoint is not supported") from exc
        except ResponseErrorSystemBusyException as exc:
            raise DeviceBusyError("device is busy") from exc
        except ResponseErrorException as exc:
            raise DeviceProtocolError(f"device information failed with code {exc.code}") from exc
        if not isinstance(information, dict) or not information:
            raise DeviceProtocolError("device information response was empty")

        monitoring_status: object = {}
        try:
            monitoring_status = await self._call(client.monitoring.status)
        except AuthExpiredError:
            raise
        except Exception as exc:
            _LOGGER.debug("Monitoring status unavailable during info refresh: %s", type(exc).__name__)

        current_plmn: object = {}
        try:
            current_plmn = await self._call(client.net.current_plmn)
        except AuthExpiredError:
            raise
        except Exception as exc:
            _LOGGER.debug("Operator information unavailable during info refresh: %s", type(exc).__name__)

        normalized = normalize_device_info(information, monitoring_status, current_plmn)
        if normalized["model"] is None:
            raise DeviceProtocolError("device did not report a model")
        # A numeric network type is still useful, but leave interpretation to the UI.
        if normalized["network_type"] is None:
            normalized["network_type"] = text_field(monitoring_status, "CurrentNetworkType")
        return DeviceInfo(**normalized)

    async def _call_read(self, fn: Callable[[], T]) -> T:
        """Run a dashboard read and translate HiLink errors into DomainErrors."""

        try:
            return await self._call(fn)
        except ResponseErrorNotSupportedException as exc:
            raise DeviceNotSupportedError("device endpoint is not supported") from exc
        except ResponseErrorSystemBusyException as exc:
            raise DeviceBusyError("device is busy") from exc
        except ResponseErrorException as exc:
            raise DeviceProtocolError(f"device read failed with code {exc.code}") from exc

    async def _call_write(self, fn: Callable[[], T]) -> T:
        try:
            return await self._call(fn)
        except ResponseErrorNotSupportedException as exc:
            raise DeviceNotSupportedError("device does not support this write") from exc
        except ResponseErrorSystemBusyException as exc:
            raise DeviceBusyError("device is busy") from exc
        except ResponseErrorException as exc:
            raise DeviceProtocolError(f"device write failed with code {exc.code}") from exc

    async def get_wifi_settings(self) -> WifiSettings:
        client = self._require_client()
        basic = await self._call_read(client.wlan.basic_settings)
        security: object = {}
        try:
            security = await self._call_read(client.wlan.security_settings)
        except AuthExpiredError:
            raise
        except Exception:
            security = {}
        return WifiSettings(
            ssid=text_field(basic, "WifiSsid"),
            hidden=as_bool(field(basic, "WifiHide")),
            security_mode=text_field(security, "WifiAuthmode"),
        )

    async def update_wifi_settings(self, *, ssid: str, hidden: bool, password: str | None) -> None:
        client = self._require_client()
        if password:
            await self._call_write(lambda: client.wlan.set_security_settings(wpa_psk=password, wifi_restart=False))
        await self._call_write(lambda: client.wlan.set_basic_settings(ssid, hide=hidden, wifi_restart=True))

    async def get_apn_profiles(self) -> list[ApnProfile]:
        client = self._require_client()
        payload = await self._call_read(client.dial_up.profiles)
        profiles: list[ApnProfile] = []
        for item in find_list(payload, ("profile", "profiles")):
            if not isinstance(item, dict):
                continue
            index = as_int(field(item, "Index", "index"))
            if index is None:
                continue
            profiles.append(
                ApnProfile(
                    index=index,
                    name=text_field(item, "Name", "name"),
                    apn=text_field(item, "ApnName", "apn"),
                    username=text_field(item, "Username", "username"),
                    auth_mode=as_int(field(item, "AuthMode", "authmode")),
                    ip_type=as_int(field(item, "iptype", "IpType")),
                    is_default=as_bool(field(item, "Default", "IsDefault", "isdefault")) or False,
                    read_only=as_bool(field(item, "ReadOnly", "readonly")) or False,
                )
            )
        profiles.sort(key=lambda profile: profile.index)
        return profiles

    async def create_apn_profile(
        self,
        *,
        name: str,
        apn: str,
        username: str | None,
        password: str | None,
        auth_mode: int,
        ip_type: int,
        is_default: bool,
    ) -> None:
        client = self._require_client()
        await self._call_write(
            lambda: client.dial_up.create_profile(
                name=name,
                username=username,
                password=password,
                apn=apn,
                auth_mode=AuthModeEnum(auth_mode),
                ip_type=IpType(ip_type),
                is_default=is_default,
            )
        )

    async def update_apn_profile(
        self,
        *,
        index: int,
        name: str,
        apn: str,
        username: str | None,
        password: str | None,
        auth_mode: int,
        ip_type: int,
        is_default: bool,
    ) -> None:
        client = self._require_client()
        await self._call_write(
            lambda: client.dial_up.update_profile(
                index=index,
                name=name,
                username=username,
                password=password,
                apn=apn,
                auth_mode=AuthModeEnum(auth_mode),
                ip_type=IpType(ip_type),
                is_default=is_default,
            )
        )

    async def delete_apn_profile(self, index: int) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.dial_up.delete_profile(index))

    async def set_default_apn_profile(self, index: int) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.dial_up.set_default_profile(index))

    async def get_sms_page(self, page: int = 1, read_count: int = 20) -> SmsPage:
        client = self._require_client()
        payload = await self._call_read(
            lambda: client.sms.get_sms_list(
                page=page,
                box_type=BoxTypeEnum.LOCAL_INBOX,
                read_count=read_count,
            )
        )
        messages: list[SmsMessage] = []
        for item in find_list(payload, ("message", "messages", "sms")):
            if not isinstance(item, dict):
                continue
            index = as_int(field(item, "Index", "index"))
            if index is None:
                continue
            content = text_field(item, "Content", "content") or ""
            messages.append(
                SmsMessage(
                    index=index,
                    phone_masked=mask_phone(field(item, "Phone", "phone")),
                    content=content,
                    received_at=text_field(item, "Date", "date"),
                )
            )
        return SmsPage(messages=messages, page=page, read_count=read_count, has_more=len(messages) >= read_count)

    async def send_sms(self, *, phone: str, message: str) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.sms.send_sms([phone], message))

    async def delete_sms(self, index: int) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.sms.delete_sms(index))

    async def mark_sms_read(self, index: int) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.sms.set_read(index))

    async def get_ussd_state(self) -> UssdState:
        client = self._require_client()
        status = await self._call_read(client.ussd.status)
        response = ""
        try:
            response_payload = await self._call_read(client.ussd.get)
            response = text_field(response_payload, "content", "response", "result") or ""
        except AuthExpiredError:
            raise
        except Exception:
            pass
        return UssdState(status=text_field(status, "State", "Status", "status"), response=response or None)

    async def send_ussd(self, code: str) -> str | None:
        client = self._require_client()
        payload = await self._call_write(lambda: client.ussd.send(code))
        return text_field(payload, "content", "response", "result")

    async def get_mobile_settings(self) -> MobileSettings:
        client = self._require_client()
        data_payload = await self._call_read(client.dial_up.mobile_dataswitch)
        connection_payload: object = {}
        try:
            connection_payload = await self._call_read(client.dial_up.connection)
        except AuthExpiredError:
            raise
        except Exception:
            pass
        mode_payload: object = {}
        try:
            mode_payload = await self._call_read(client.net.net_mode)
        except AuthExpiredError:
            raise
        except Exception:
            pass
        mask = hex_int(field(mode_payload, "LTEBand", "lteband"))
        return MobileSettings(
            data_enabled=as_bool(field(data_payload, "dataswitch", "DataSwitch", "dataSwitch")),
            roaming_enabled=as_bool(field(connection_payload, "RoamAutoConnectEnable", "roam_auto_connect_enable")),
            network_mode=text_field(mode_payload, "NetworkMode", "networkmode"),
            lte_band_mask=text_field(mode_payload, "LTEBand", "lteband"),
            lte_bands=bands_from_mask(mask),
        )

    async def set_mobile_data(self, enabled: bool) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.dial_up.set_mobile_dataswitch(1 if enabled else 0))

    async def set_roaming(self, enabled: bool) -> None:
        client = self._require_client()
        current = await self._call_read(client.dial_up.connection)
        await self._call_write(
            lambda: client.dial_up.set_connection_settings(
                roam_auto_connect_enable=enabled,
                max_idle_time=as_int(field(current, "MaxIdelTime", "MaxIdleTime")) or 0,
                connect_mode=as_int(field(current, "ConnectMode")) or 0,
                mtu=as_int(field(current, "MTU")) or 1500,
                auto_dial_switch=as_bool(field(current, "auto_dial_switch")) is not False,
                pdp_always_on=as_bool(field(current, "pdp_always_on")) is not False,
            )
        )

    async def set_radio_mode(self, network_mode: str, lte_bands: list[int] | None) -> None:
        client = self._require_client()
        lte_mask = LTEBandEnum.ALL.value if not lte_bands else sum(1 << (band - 1) for band in lte_bands)
        await self._call_write(
            lambda: client.net.set_net_mode(
                lteband=lte_mask,
                networkband=NetworkBandEnum.ALL.value,
                networkmode=network_mode,
            )
        )

    async def reconnect(self) -> None:
        client = self._require_client()
        await self._call_write(client.net.reconnect)

    async def reboot(self) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.device.set_control(ControlModeEnum.REBOOT))

    async def get_advanced_settings(self) -> AdvancedSettings:
        client = self._require_client()
        dhcp_payload = await self._call_read(client.dhcp.settings)
        upnp_payload = await self._call_read(client.security.upnp)
        dmz_payload = await self._call_read(client.security.dmz)
        firewall_payload = await self._call_read(client.security.get_firewall_switch)
        return AdvancedSettings(
            dhcp=DhcpSettings(
                enabled=as_bool(field(dhcp_payload, "DhcpStatus")),
                ip_address=text_field(dhcp_payload, "DhcpIPAddress"),
                netmask=text_field(dhcp_payload, "DhcpLanNetmask"),
                start_ip=text_field(dhcp_payload, "DhcpStartIPAddress"),
                end_ip=text_field(dhcp_payload, "DhcpEndIPAddress"),
                lease_seconds=as_int(field(dhcp_payload, "DhcpLeaseTime")),
                dns_enabled=as_bool(field(dhcp_payload, "DnsStatus")),
                primary_dns=text_field(dhcp_payload, "PrimaryDns"),
                secondary_dns=text_field(dhcp_payload, "SecondaryDns"),
            ),
            upnp_enabled=as_bool(field(upnp_payload, "UpnpStatus", "UpnpEnabled")),
            dmz_enabled=as_bool(field(dmz_payload, "DmzStatus")),
            dmz_ip=text_field(dmz_payload, "DmzIPAddress"),
            firewall=FirewallSettings(
                enabled=as_bool(field(firewall_payload, "FirewallMainSwitch")),
                ip_filter=as_bool(field(firewall_payload, "FirewallIPFilterSwitch")),
                wan_ping_filter=as_bool(field(firewall_payload, "FirewallWanPortPingSwitch")),
                url_filter=as_bool(field(firewall_payload, "firewallurlfilterswitch")),
                mac_filter=as_bool(field(firewall_payload, "firewallmacfilterswitch")),
            ),
        )

    async def set_dhcp(self, settings: DhcpSettings) -> None:
        client = self._require_client()
        start = last_octet(settings.start_ip)
        end = last_octet(settings.end_ip)
        if settings.ip_address is None or settings.netmask is None or start is None or end is None:
            raise DeviceProtocolError("DHCP settings are incomplete")
        await self._call_write(
            lambda: client.dhcp.set_settings(
                dhcp_ip_address=settings.ip_address or "",
                dhcp_lan_netmask=settings.netmask or "",
                dhcp_status=settings.enabled is not False,
                dhcp_start_ip_range=start,
                dhcp_end_ip_range=end,
                dhcp_lease_time=settings.lease_seconds or 86400,
                dns_status=settings.dns_enabled is not False,
                primary_dns=settings.primary_dns,
                secondary_dns=settings.secondary_dns,
                show_dns_setting=True,
            )
        )

    async def set_upnp(self, enabled: bool) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.security.set_upnp(enabled))

    async def set_dmz(self, enabled: bool, ip_address: str) -> None:
        client = self._require_client()
        await self._call_write(lambda: client.security.set_dmz(enabled, ip_address))

    async def set_firewall(self, settings: FirewallSettings) -> None:
        client = self._require_client()
        await self._call_write(
            lambda: client.security.set_firewall_switch(
                firewall=settings.enabled is not False,
                ip_filter=settings.ip_filter is True,
                wan_ping_filter=settings.wan_ping_filter is not False,
                url_filter=settings.url_filter is True,
                mac_filter=settings.mac_filter is True,
            )
        )

    async def get_network_status(self) -> NetworkStatus:
        client = self._require_client()
        status = await self._call_read(client.monitoring.status)
        current_plmn: object = {}
        try:
            current_plmn = await self._call(client.net.current_plmn)
        except AuthExpiredError:
            raise
        except Exception as exc:
            _LOGGER.debug("Operator lookup failed: %s", type(exc).__name__)
        return parse_network_status(status, current_plmn)

    async def get_signal(self) -> SignalSnapshot:
        client = self._require_client()
        signal = await self._call_read(client.device.signal)
        return parse_signal(signal)

    async def get_cells(self) -> CellSnapshot:
        client = self._require_client()
        payload = await self._call_read(client.net.cell_info)
        return parse_cells(payload)

    async def get_traffic(self) -> TrafficSnapshot:
        client = self._require_client()
        statistics = await self._call_read(client.monitoring.traffic_statistics)
        month_statistics: object = {}
        try:
            month_statistics = await self._call(client.monitoring.month_statistics)
        except AuthExpiredError:
            raise
        except Exception as exc:
            _LOGGER.debug("Month statistics unavailable: %s", type(exc).__name__)
        return parse_traffic(statistics, month_statistics)

    async def get_clients(self) -> ClientSnapshot:
        client = self._require_client()
        payload = await self._call_read(client.wlan.host_list)
        return parse_clients(payload, utc_now())

    async def heartbeat(self) -> None:
        client = self._require_client()
        try:
            await self._call(client.monitoring.status)
        except ResponseErrorNotSupportedException as exc:
            raise DeviceProtocolError("heartbeat endpoint is not supported") from exc
        except ResponseErrorSystemBusyException as exc:
            raise DeviceBusyError("device is busy") from exc
        except ResponseErrorException as exc:
            raise DeviceProtocolError(f"heartbeat failed with code {exc.code}") from exc

    async def probe_capabilities(self) -> list[CapabilityResult]:
        client = self._require_client()
        results: list[CapabilityResult] = []
        for definition in CAPABILITIES:
            results.append(await self._probe_one(client, definition))
        return results

    async def _probe_one(self, client: Client, definition: CapabilityDefinition) -> CapabilityResult:
        started = time.perf_counter()
        if definition.probe_endpoint is None:
            return CapabilityResult(
                id=definition.id,
                category=definition.category,
                access=definition.access,
                status=CapabilityStatus.EXPERIMENTAL,
                reason=CapabilityReason.NO_SAFE_PROBE,
                duration_ms=0,
            )

        try:
            payload = await self._call(lambda: PROBE_CALLS[definition.id](client))
            if payload is None or payload == {} or payload == []:
                raise _EmptyResponseError
            if definition.access is CapabilityAccess.WRITE:
                status, reason = CapabilityStatus.EXPERIMENTAL, CapabilityReason.WRITE_NOT_VERIFIED
            else:
                status, reason = CapabilityStatus.AVAILABLE, CapabilityReason.OK
            detail = None
        except AuthExpiredError:
            raise
        except Exception as exc:
            status, reason, detail = _classify_probe_error(exc)
            if isinstance(exc, (ResponseErrorLoginRequiredException, ResponseErrorWrongSessionToken)):
                raise AuthExpiredError("device session expired") from exc

        duration_ms = max(0, int((time.perf_counter() - started) * 1000))
        return CapabilityResult(
            id=definition.id,
            category=definition.category,
            access=definition.access,
            status=status,
            reason=reason,
            duration_ms=duration_ms,
            detail=detail,
        )
