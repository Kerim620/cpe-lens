from __future__ import annotations

from dataclasses import dataclass

from cpe_lens.models.capability import CapabilityAccess, CapabilityCategory


@dataclass(frozen=True, slots=True)
class CapabilityDefinition:
    """A feature whose availability can be probed without changing device state."""

    id: str
    category: CapabilityCategory
    access: CapabilityAccess
    probe_endpoint: str | None


CAPABILITIES: tuple[CapabilityDefinition, ...] = (
    CapabilityDefinition(
        id="device_info",
        category=CapabilityCategory.DEVICE,
        access=CapabilityAccess.READ,
        probe_endpoint="device/information",
    ),
    CapabilityDefinition(
        id="network_status",
        category=CapabilityCategory.NETWORK,
        access=CapabilityAccess.READ,
        probe_endpoint="monitoring/status",
    ),
    CapabilityDefinition(
        id="signal_metrics",
        category=CapabilityCategory.SIGNAL,
        access=CapabilityAccess.READ,
        probe_endpoint="device/signal",
    ),
    CapabilityDefinition(
        id="cell_info",
        category=CapabilityCategory.SIGNAL,
        access=CapabilityAccess.READ,
        probe_endpoint="net/cell-info",
    ),
    CapabilityDefinition(
        id="traffic_stats",
        category=CapabilityCategory.TRAFFIC,
        access=CapabilityAccess.READ,
        probe_endpoint="monitoring/traffic-statistics",
    ),
    CapabilityDefinition(
        id="connected_clients",
        category=CapabilityCategory.CLIENTS,
        access=CapabilityAccess.READ,
        probe_endpoint="wlan/host-list",
    ),
    CapabilityDefinition(
        id="wifi_settings",
        category=CapabilityCategory.WIFI,
        access=CapabilityAccess.WRITE,
        probe_endpoint="wlan/basic-settings",
    ),
    CapabilityDefinition(
        id="guest_wifi",
        category=CapabilityCategory.WIFI,
        access=CapabilityAccess.WRITE,
        probe_endpoint="wlan/multi-basic-settings",
    ),
    CapabilityDefinition(
        id="mac_filter",
        category=CapabilityCategory.WIFI,
        access=CapabilityAccess.WRITE,
        probe_endpoint="wlan/mac-filter",
    ),
    CapabilityDefinition(
        id="network_mode",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="net/net-mode",
    ),
    CapabilityDefinition(
        id="band_lock",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="net/net-mode",
    ),
    CapabilityDefinition(
        id="cell_lock",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="ntwk/celllock",
    ),
    CapabilityDefinition(
        id="apn_profiles",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="dialup/profiles",
    ),
    CapabilityDefinition(
        id="mobile_data_switch",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="dialup/mobile-dataswitch",
    ),
    CapabilityDefinition(
        id="reconnect",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="net/net-mode",
    ),
    CapabilityDefinition(
        id="roaming_switch",
        category=CapabilityCategory.MOBILE,
        access=CapabilityAccess.WRITE,
        probe_endpoint="dialup/connection",
    ),
    CapabilityDefinition(
        id="sms_inbox",
        category=CapabilityCategory.MESSAGING,
        access=CapabilityAccess.READ,
        probe_endpoint="sms/sms-count",
    ),
    CapabilityDefinition(
        id="sms_send",
        category=CapabilityCategory.MESSAGING,
        access=CapabilityAccess.WRITE,
        probe_endpoint="sms/sms-count",
    ),
    CapabilityDefinition(
        id="sms_manage",
        category=CapabilityCategory.MESSAGING,
        access=CapabilityAccess.WRITE,
        probe_endpoint="sms/sms-count",
    ),
    CapabilityDefinition(
        id="ussd",
        category=CapabilityCategory.MESSAGING,
        access=CapabilityAccess.WRITE,
        probe_endpoint="ussd/status",
    ),
    CapabilityDefinition(
        id="dhcp",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="dhcp/settings",
    ),
    CapabilityDefinition(
        id="dns",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="dhcp/settings",
    ),
    CapabilityDefinition(
        id="port_mapping",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="security/virtual-servers",
    ),
    CapabilityDefinition(
        id="dmz",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="security/dmz",
    ),
    CapabilityDefinition(
        id="nat",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="security/nat",
    ),
    CapabilityDefinition(
        id="upnp",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="security/upnp",
    ),
    CapabilityDefinition(
        id="firewall",
        category=CapabilityCategory.ADVANCED,
        access=CapabilityAccess.WRITE,
        probe_endpoint="security/firewall-switch",
    ),
    CapabilityDefinition(
        id="diagnostics",
        category=CapabilityCategory.SYSTEM,
        access=CapabilityAccess.READ,
        probe_endpoint="diagnosis/time_reboot",
    ),
    CapabilityDefinition(
        id="reboot",
        category=CapabilityCategory.SYSTEM,
        access=CapabilityAccess.WRITE,
        probe_endpoint=None,
    ),
)

CAPABILITY_BY_ID = {definition.id: definition for definition in CAPABILITIES}
