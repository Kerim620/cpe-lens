from __future__ import annotations

from cpe_lens.adapters.base import DeviceAdapter
from cpe_lens.capabilities.definitions import CAPABILITIES
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
    NetworkModeOption,
    SmsMessage,
    SmsPage,
    UssdState,
    WifiSettings,
)
from cpe_lens.models.device import DeviceInfo
from cpe_lens.models.telemetry import (
    CellEntry,
    CellRadio,
    CellSnapshot,
    ClientConnectionType,
    ClientInfo,
    ClientSnapshot,
    NetworkStatus,
    RadioMetrics,
    SignalQuality,
    SignalSnapshot,
    TrafficSnapshot,
)


class FakeAdapter(DeviceAdapter):
    """Test double only; never shipped or selectable in the application."""

    adapter_name = "fake"
    source = "device"
    notice_key = None

    def __init__(self) -> None:
        self._connected = False
        self._closed = False
        self._traffic_ticks = 0
        self.signal_error: Exception | None = None
        self.unsupported_capabilities: set[str] = set()
        self.capability_status_overrides: dict[str, CapabilityStatus] = {}
        self.wifi_write_error: Exception | None = None
        self.wifi_store_ssid = True
        self.wifi = WifiSettings(ssid="Test-WiFi", hidden=False, security_mode="WPA2")
        self.apn_profiles = [
            ApnProfile(index=1, name="Default", apn="internet", auth_mode=0, ip_type=2, is_default=True)
        ]
        self.mobile = MobileSettings(
            data_enabled=True,
            roaming_enabled=False,
            network_mode="00",
            lte_band_mask="7fffffffffffffff",
            lte_bands=[],
            network_modes=[
                NetworkModeOption(code="08", label="5G only", is_5g=True),
                NetworkModeOption(code="0308", label="4G + 5G", is_5g=True),
            ],
        )
        self.messages = [
            SmsMessage(
                index=0,
                phone="+15551234567",
                content="Test message",
                received_at="2026-01-01T10:00:00Z",
            )
        ]
        self.ussd = UssdState(status="idle", response=None)
        self.advanced = AdvancedSettings(
            dhcp=DhcpSettings(
                enabled=True,
                ip_address="192.168.8.1",
                netmask="255.255.255.0",
                start_ip="192.168.8.100",
                end_ip="192.168.8.200",
                lease_seconds=86400,
                dns_enabled=True,
                primary_dns="1.1.1.1",
                secondary_dns="8.8.8.8",
            ),
            upnp_enabled=True,
            dmz_enabled=False,
            dmz_ip="",
            firewall=FirewallSettings(
                enabled=True,
                ip_filter=False,
                wan_ping_filter=True,
                url_filter=False,
                mac_filter=False,
            ),
        )
        self.reboots = 0
        self.reconnects = 0
        self.last_wifi_password: str | None = None

    async def connect(self) -> None:
        self._connected = True

    async def close(self) -> None:
        self._closed = True
        self._connected = False

    async def get_device_info(self) -> DeviceInfo:
        return DeviceInfo(
            model="Generic HiLink CPE",
            hardware_version="HW-1",
            firmware_version="FW-1.0",
            web_ui_version="WEB-1.0",
            device_name="Generic HiLink CPE",
            imei="123456789012345",
            operator="Test Operator",
            network_type="LTE",
        )

    async def probe_capabilities(self) -> list[CapabilityResult]:
        return [
            CapabilityResult(
                id=definition.id,
                category=definition.category,
                access=definition.access,
                status=self.capability_status_overrides.get(
                    definition.id,
                    CapabilityStatus.UNSUPPORTED
                    if definition.id in self.unsupported_capabilities
                    else (
                        CapabilityStatus.AVAILABLE
                        if definition.access is CapabilityAccess.READ
                        else CapabilityStatus.EXPERIMENTAL
                    ),
                ),
                reason=CapabilityReason.NO_SUPPORT
                if definition.id in self.unsupported_capabilities
                else (
                    CapabilityReason.OK
                    if definition.access is CapabilityAccess.READ
                    else CapabilityReason.WRITE_NOT_VERIFIED
                ),
                duration_ms=1,
            )
            for definition in CAPABILITIES
        ]

    async def get_network_status(self) -> NetworkStatus:
        return NetworkStatus(
            operator="Test Operator",
            network_type="LTE",
            roaming=False,
            signal_bars=4,
            wan_ip="198.51.100.23",
            connect_time_seconds=3600,
            uptime_seconds=86400,
        )

    async def get_signal(self) -> SignalSnapshot:
        if self.signal_error is not None:
            raise self.signal_error
        return SignalSnapshot(
            lte=RadioMetrics(
                rsrp_dbm=-90,
                rsrq_db=-10,
                rssi_dbm=-65,
                sinr_db=15,
                band="3",
                pci=123,
                cell_id="12345678",
                arfcn=1300,
                dl_bandwidth_mhz=20,
                ul_bandwidth_mhz=20,
                quality=SignalQuality.GOOD,
            ),
            nr=RadioMetrics(
                rsrp_dbm=-85,
                rsrq_db=-9,
                sinr_db=18,
                band="n78",
                pci=321,
                cell_id="87654321",
                arfcn=640000,
                dl_bandwidth_mhz=100,
                ul_bandwidth_mhz=100,
                quality=SignalQuality.GOOD,
            ),
        )

    async def get_cells(self) -> CellSnapshot:
        return CellSnapshot(
            cells=[
                CellEntry(radio=CellRadio.LTE, band="3", pci=123, cell_id="12345678", arfcn=1300),
                CellEntry(radio=CellRadio.NR, band="n78", pci=321, cell_id="87654321", arfcn=640000),
            ]
        )

    async def get_traffic(self) -> TrafficSnapshot:
        self._traffic_ticks += 1
        total_download = 10_000_000 + self._traffic_ticks * 2_000_000
        total_upload = 5_000_000 + self._traffic_ticks * 500_000
        return TrafficSnapshot(
            session_download_bytes=1_000_000,
            session_upload_bytes=500_000,
            month_download_bytes=50_000_000,
            month_upload_bytes=10_000_000,
            total_download_bytes=total_download,
            total_upload_bytes=total_upload,
            current_connect_seconds=3600,
            total_connect_seconds=86400,
        )

    async def get_clients(self) -> ClientSnapshot:
        return ClientSnapshot(
            clients=[
                ClientInfo(
                    hostname="Test-Laptop",
                    ip_address="192.168.8.10",
                    mac="02:00:00:00:00:01",
                    connection_type=ClientConnectionType.WIFI,
                    online_seconds=3600,
                ),
                ClientInfo(
                    hostname="Test-NAS",
                    ip_address="192.168.8.11",
                    mac="02:00:00:00:00:02",
                    connection_type=ClientConnectionType.ETHERNET,
                    online_seconds=86400,
                ),
            ],
            count=2,
        )

    async def heartbeat(self) -> None:
        if not self._connected:
            raise RuntimeError("fake adapter is not connected")

    async def get_wifi_settings(self) -> WifiSettings:
        return self.wifi

    async def update_wifi_settings(self, *, ssid: str, hidden: bool, password: str | None) -> None:
        if self.wifi_write_error is not None:
            raise self.wifi_write_error
        self.wifi = WifiSettings(
            ssid=ssid if self.wifi_store_ssid else "MISMATCH",
            hidden=hidden,
            security_mode="WPA2",
        )
        self.last_wifi_password = password

    async def get_apn_profiles(self) -> list[ApnProfile]:
        return list(self.apn_profiles)

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
        index = max((profile.index for profile in self.apn_profiles), default=0) + 1
        if is_default:
            self.apn_profiles = [profile.model_copy(update={"is_default": False}) for profile in self.apn_profiles]
        self.apn_profiles.append(
            ApnProfile(
                index=index,
                name=name,
                apn=apn,
                username=username,
                auth_mode=auth_mode,
                ip_type=ip_type,
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
        updated = []
        for profile in self.apn_profiles:
            if profile.index == index:
                role = is_default
                profile = profile.model_copy(
                    update={
                        "name": name,
                        "apn": apn,
                        "username": username,
                        "auth_mode": auth_mode,
                        "ip_type": ip_type,
                        "is_default": role,
                    }
                )
            elif is_default:
                profile = profile.model_copy(update={"is_default": False})
            updated.append(profile)
        self.apn_profiles = updated

    async def delete_apn_profile(self, index: int) -> None:
        self.apn_profiles = [profile for profile in self.apn_profiles if profile.index != index]

    async def set_default_apn_profile(self, index: int) -> None:
        self.apn_profiles = [
            profile.model_copy(update={"is_default": profile.index == index}) for profile in self.apn_profiles
        ]

    async def get_sms_page(self, page: int = 1, read_count: int = 20) -> SmsPage:
        start = (page - 1) * read_count
        messages = self.messages[start : start + read_count]
        return SmsPage(
            messages=messages, page=page, read_count=read_count, has_more=len(self.messages) > start + read_count
        )

    async def send_sms(self, *, phone: str, message: str) -> None:
        self.messages.append(
            SmsMessage(
                index=max((item.index for item in self.messages), default=-1) + 1,
                phone=phone,
                content=message,
                received_at=None,
            )
        )

    async def delete_sms(self, index: int) -> None:
        self.messages = [message for message in self.messages if message.index != index]

    async def mark_sms_read(self, index: int) -> None:
        self.messages = [
            message.model_copy(update={"is_read": True}) if message.index == index else message
            for message in self.messages
        ]

    async def get_ussd_state(self) -> UssdState:
        return self.ussd

    async def send_ussd(self, code: str) -> str | None:
        self.ussd = UssdState(status="ok", response=f"response:{code}")
        return self.ussd.response

    async def get_mobile_settings(self) -> MobileSettings:
        return self.mobile

    async def set_mobile_data(self, enabled: bool) -> None:
        self.mobile = self.mobile.model_copy(update={"data_enabled": enabled})

    async def set_roaming(self, enabled: bool) -> None:
        self.mobile = self.mobile.model_copy(update={"roaming_enabled": enabled})

    async def set_radio_mode(self, network_mode: str, lte_bands: list[int] | None) -> None:
        self.mobile = self.mobile.model_copy(update={"network_mode": network_mode, "lte_bands": lte_bands or []})

    async def reconnect(self) -> None:
        self.reconnects += 1

    async def reboot(self) -> None:
        self.reboots += 1

    async def get_advanced_settings(self) -> AdvancedSettings:
        return self.advanced

    async def set_dhcp(self, settings: DhcpSettings) -> None:
        self.advanced = self.advanced.model_copy(update={"dhcp": settings})

    async def set_upnp(self, enabled: bool) -> None:
        self.advanced = self.advanced.model_copy(update={"upnp_enabled": enabled})

    async def set_dmz(self, enabled: bool, ip_address: str) -> None:
        self.advanced = self.advanced.model_copy(update={"dmz_enabled": enabled, "dmz_ip": ip_address})

    async def set_firewall(self, settings: FirewallSettings) -> None:
        self.advanced = self.advanced.model_copy(update={"firewall": settings})


class FakeFactory:
    def __init__(self) -> None:
        self.adapter = FakeAdapter()

    def create(self, *, address: str, username: str, password: str) -> DeviceAdapter:
        return self.adapter
