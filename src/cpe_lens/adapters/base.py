from __future__ import annotations

from abc import ABC, abstractmethod

from cpe_lens.models.capability import CapabilityResult
from cpe_lens.models.controls import (
    AdvancedSettings,
    ApnProfile,
    DhcpSettings,
    FirewallSettings,
    MobileSettings,
    SmsPage,
    UssdState,
    WifiSettings,
)
from cpe_lens.models.device import DeviceInfo
from cpe_lens.models.errors import DeviceNotSupportedError
from cpe_lens.models.telemetry import (
    CellSnapshot,
    ClientSnapshot,
    NetworkStatus,
    SignalSnapshot,
    TrafficSnapshot,
)


class DeviceAdapter(ABC):
    """Interface implemented by the HiLink adapter."""

    adapter_name: str
    source: str
    notice_key: str | None = None

    @abstractmethod
    async def connect(self) -> None:
        """Authenticate and prepare the adapter. Must raise a DomainError on failure."""

    @abstractmethod
    async def close(self) -> None:
        """Release the transport. Safe to call more than once."""

    @abstractmethod
    async def get_device_info(self) -> DeviceInfo:
        """Return a normalized device identity."""

    @abstractmethod
    async def heartbeat(self) -> None:
        """Check that the authenticated session is still usable."""

    @abstractmethod
    async def get_network_status(self) -> NetworkStatus:
        """Return current operator, radio type, roaming and WAN status."""

    @abstractmethod
    async def get_signal(self) -> SignalSnapshot:
        """Return normalized LTE and NR signal metrics."""

    @abstractmethod
    async def get_cells(self) -> CellSnapshot:
        """Return the serving and neighbour cells reported by the device."""

    @abstractmethod
    async def get_traffic(self) -> TrafficSnapshot:
        """Return traffic counters. Speeds and daily totals are derived by the service."""

    @abstractmethod
    async def get_clients(self) -> ClientSnapshot:
        """Return currently associated clients with masked MAC addresses."""

    @abstractmethod
    async def probe_capabilities(self) -> list[CapabilityResult]:
        """Probe features using read-only requests only.

        Implementations must never issue a write request while probing. Write
        capabilities are reported as experimental until the write path itself
        has been verified on the connected device.
        """

    # --- Phase 3 controls -------------------------------------------------
    # Defaults raise not-supported so adapters only need to implement features
    # they actually expose. Capability probing still gates every write.

    async def get_wifi_settings(self) -> WifiSettings:
        raise DeviceNotSupportedError("Wi-Fi settings are not supported")

    async def update_wifi_settings(self, *, ssid: str, hidden: bool, password: str | None) -> None:
        raise DeviceNotSupportedError("Wi-Fi updates are not supported")

    async def get_apn_profiles(self) -> list[ApnProfile]:
        raise DeviceNotSupportedError("APN profiles are not supported")

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
        raise DeviceNotSupportedError("APN creation is not supported")

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
        raise DeviceNotSupportedError("APN updates are not supported")

    async def delete_apn_profile(self, index: int) -> None:
        raise DeviceNotSupportedError("APN deletion is not supported")

    async def set_default_apn_profile(self, index: int) -> None:
        raise DeviceNotSupportedError("APN default selection is not supported")

    async def get_sms_page(self, page: int = 1, read_count: int = 20) -> SmsPage:
        raise DeviceNotSupportedError("SMS is not supported")

    async def send_sms(self, *, phone: str, message: str) -> None:
        raise DeviceNotSupportedError("Sending SMS is not supported")

    async def delete_sms(self, index: int) -> None:
        raise DeviceNotSupportedError("Deleting SMS is not supported")

    async def mark_sms_read(self, index: int) -> None:
        raise DeviceNotSupportedError("Marking SMS as read is not supported")

    async def get_ussd_state(self) -> UssdState:
        raise DeviceNotSupportedError("USSD is not supported")

    async def send_ussd(self, code: str) -> str | None:
        raise DeviceNotSupportedError("USSD is not supported")

    async def get_mobile_settings(self) -> MobileSettings:
        raise DeviceNotSupportedError("Mobile settings are not supported")

    async def set_mobile_data(self, enabled: bool) -> None:
        raise DeviceNotSupportedError("Mobile data control is not supported")

    async def set_roaming(self, enabled: bool) -> None:
        raise DeviceNotSupportedError("Roaming control is not supported")

    async def set_radio_mode(self, network_mode: str, lte_bands: list[int] | None) -> None:
        raise DeviceNotSupportedError("Network mode control is not supported")

    async def reconnect(self) -> None:
        raise DeviceNotSupportedError("Reconnect is not supported")

    async def reboot(self) -> None:
        raise DeviceNotSupportedError("Reboot is not supported")

    async def get_advanced_settings(self) -> AdvancedSettings:
        raise DeviceNotSupportedError("Advanced settings are not supported")

    async def set_dhcp(self, settings: DhcpSettings) -> None:
        raise DeviceNotSupportedError("DHCP updates are not supported")

    async def set_upnp(self, enabled: bool) -> None:
        raise DeviceNotSupportedError("UPnP control is not supported")

    async def set_dmz(self, enabled: bool, ip_address: str) -> None:
        raise DeviceNotSupportedError("DMZ control is not supported")

    async def set_firewall(self, settings: FirewallSettings) -> None:
        raise DeviceNotSupportedError("Firewall control is not supported")
