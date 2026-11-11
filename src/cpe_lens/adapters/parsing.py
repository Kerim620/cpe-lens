from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from cpe_lens.models.controls import NetworkModeOption
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

_NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")


def _normalize_key(key: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def normalize_keys(data: object) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    return {_normalize_key(key): value for key, value in data.items()}


def field(data: object, *names: str) -> object | None:
    normalized = normalize_keys(data)
    for name in names:
        value = normalized.get(_normalize_key(name))
        if value is not None and value != "":
            return value
    return None


def as_text(value: object) -> str | None:
    if value is None or isinstance(value, (dict, list, tuple)):
        return None
    text = str(value).strip()
    return text or None


def text_field(data: object, *names: str) -> str | None:
    return as_text(field(data, *names))


def as_float(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = _NUMBER_RE.search(str(value))
    return float(match.group(0)) if match else None


def float_field(data: object, *names: str) -> float | None:
    return as_float(field(data, *names))


def as_int(value: object) -> int | None:
    number = as_float(value)
    return int(number) if number is not None else None


def int_field(data: object, *names: str) -> int | None:
    return as_int(field(data, *names))


def bytes_field(data: object, *names: str) -> int | None:
    value = field(data, *names)
    if value is None:
        return None
    number = as_float(value)
    if number is None:
        return None
    text = str(value).strip().lower()
    if "tb" in text:
        number *= 1024**4
    elif "gb" in text:
        number *= 1024**3
    elif "mb" in text:
        number *= 1024**2
    elif "kb" in text:
        number *= 1024
    return max(0, int(number))


def as_bool(value: object) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on", "enabled"}:
        return True
    if text in {"0", "false", "no", "off", "disabled"}:
        return False
    return None


def quality_from_rsrp(rsrp_dbm: float | None) -> SignalQuality | None:
    if rsrp_dbm is None:
        return None
    if rsrp_dbm >= -80:
        return SignalQuality.EXCELLENT
    if rsrp_dbm >= -90:
        return SignalQuality.GOOD
    if rsrp_dbm >= -100:
        return SignalQuality.FAIR
    return SignalQuality.POOR


def normalize_mac_address(value: object) -> str | None:
    text = as_text(value)
    if text is None:
        return None
    hex_chars = re.sub(r"[^0-9A-Fa-f]", "", text)
    if len(hex_chars) != 12:
        return None
    return ":".join(hex_chars[index : index + 2].lower() for index in range(0, 12, 2))


def normalize_wan_ip(value: object) -> str | None:
    text = as_text(value)
    if text is None or text in {"0.0.0.0", "::", "0:0:0:0:0:0:0:0"}:
        return None
    return text


def _nested(data: object, *names: str) -> object | None:
    value = field(data, *names)
    return value if isinstance(value, dict) else None


def _radio_from(data: object, prefix: str, nested_names: tuple[str, ...]) -> RadioMetrics | None:
    nested = _nested(data, *nested_names)
    source = nested if nested is not None else data
    if prefix == "nr":
        # Flat HiLink signal responses use unprefixed keys for LTE only. Do not
        # fall back to them for NR, or an LTE-only response would look like NR.
        unprefixed = nested is not None
        rsrp = float_field(source, "nrrsrp", "nr_rsrp") or (float_field(source, "rsrp") if unprefixed else None)
        rsrq = float_field(source, "nrrsrq", "nr_rsrq") or (float_field(source, "rsrq") if unprefixed else None)
        rssi = float_field(source, "nrrssi", "nr_rssi") or (float_field(source, "rssi") if unprefixed else None)
        sinr = float_field(source, "nrsinr", "nr_sinr") or (float_field(source, "sinr") if unprefixed else None)
        band = text_field(source, "nrband", "nr_band") or (text_field(source, "band") if unprefixed else None)
        pci = int_field(source, "nrpci", "nr_pci") or (int_field(source, "pci") if unprefixed else None)
        cell_id = text_field(source, "nrcellid", "nr_cell_id") or (
            text_field(source, "cell_id", "cellid") if unprefixed else None
        )
        arfcn = int_field(source, "nrarfcn", "nr_arfcn", "nrfreq", "nr_earfcn") or (
            int_field(source, "earfcn") if unprefixed else None
        )
        dl_bw = float_field(source, "nrdlbandwidth", "nr_dl_bandwidth") or (
            float_field(source, "dlbandwidth") if unprefixed else None
        )
        ul_bw = float_field(source, "nrulbandwidth", "nr_ul_bandwidth") or (
            float_field(source, "ulbandwidth") if unprefixed else None
        )
        cqi = int_field(source, "nrcqi", "nr_cqi") or (int_field(source, "cqi") if unprefixed else None)
        mcs = int_field(source, "nrmcs", "nr_mcs") or (int_field(source, "mcs") if unprefixed else None)
        tx_power = float_field(source, "nrtxpower", "nr_tx_power") or (
            float_field(source, "txpower") if unprefixed else None
        )
        rank = int_field(source, "nrrank", "nr_rank") or (int_field(source, "rank") if unprefixed else None)
    else:
        rsrp = float_field(source, "rsrp")
        rsrq = float_field(source, "rsrq")
        rssi = float_field(source, "rssi")
        sinr = float_field(source, "sinr")
        band = text_field(source, "band")
        pci = int_field(source, "pci")
        cell_id = text_field(source, "cell_id", "cellid")
        arfcn = int_field(source, "earfcn", "arfcn")
        dl_bw = float_field(source, "dlbandwidth", "dl_bandwidth")
        ul_bw = float_field(source, "ulbandwidth", "ul_bandwidth")
        cqi = int_field(source, "cqi")
        mcs = int_field(source, "mcs")
        tx_power = float_field(source, "txpower", "tx_power")
        rank = int_field(source, "rank")

    metrics = RadioMetrics(
        rsrp_dbm=rsrp,
        rsrq_db=rsrq,
        rssi_dbm=rssi,
        sinr_db=sinr,
        band=band,
        pci=pci,
        cell_id=cell_id,
        arfcn=arfcn,
        dl_bandwidth_mhz=dl_bw,
        ul_bandwidth_mhz=ul_bw,
        cqi=cqi,
        mcs=mcs,
        tx_power_dbm=tx_power,
        rank=rank,
        quality=quality_from_rsrp(rsrp),
    )
    if not any(
        value is not None
        for value in (
            metrics.rsrp_dbm,
            metrics.rsrq_db,
            metrics.rssi_dbm,
            metrics.sinr_db,
            metrics.band,
            metrics.pci,
            metrics.cell_id,
            metrics.arfcn,
            metrics.dl_bandwidth_mhz,
            metrics.ul_bandwidth_mhz,
            metrics.cqi,
            metrics.mcs,
            metrics.tx_power_dbm,
            metrics.rank,
        )
    ):
        return None
    return metrics


def parse_signal(data: object) -> SignalSnapshot:
    return SignalSnapshot(
        lte=_radio_from(data, "lte", ("lte", "lteinfo")),
        nr=_radio_from(data, "nr", ("nr", "nrinfo", "5g")),
    )


def _extract_list(payload: object, depth: int = 0) -> list[object]:
    if depth > 3:
        return []
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("cellinfo", "cells", "cell", "celllist"):
        value = field(payload, key)
        if value is not None:
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                return [value]
    for value in payload.values():
        if isinstance(value, (dict, list)):
            result = _extract_list(value, depth + 1)
            if result:
                return result
    return []


def parse_cells(payload: object) -> CellSnapshot:
    cells: list[CellEntry] = []
    seen: set[tuple[str, str | None, int | None, int | None]] = set()
    for item in _extract_list(payload):
        if not isinstance(item, dict):
            continue
        type_text = (text_field(item, "type", "rat", "radio", "networktype") or "").lower()
        if "nr" in type_text or "5g" in type_text:
            radio = CellRadio.NR
        elif "lte" in type_text or "4g" in type_text:
            radio = CellRadio.LTE
        elif field(item, "nrrsrp", "nrpci", "nrband") is not None:
            radio = CellRadio.NR
        else:
            radio = CellRadio.LTE

        band = text_field(item, "band", "nrband")
        pci = int_field(item, "pci", "nrpci")
        cell_id = text_field(item, "cellid", "cell_id", "nrcellid", "nr_cell_id")
        arfcn = int_field(item, "earfcn", "arfcn", "nrarfcn", "nr_arfcn", "nrfreq")
        key = (radio.value, cell_id, pci, arfcn)
        if key in seen:
            continue
        seen.add(key)
        cells.append(
            CellEntry(
                radio=radio,
                band=band,
                pci=pci,
                cell_id=cell_id,
                arfcn=arfcn,
                dl_bandwidth_mhz=float_field(item, "dlbandwidth", "dl_bandwidth", "nrdlbandwidth"),
                ul_bandwidth_mhz=float_field(item, "ulbandwidth", "ul_bandwidth", "nrulbandwidth"),
                source="cell_info",
            )
        )
    return CellSnapshot(cells=cells)


def parse_traffic(stats: object, month_stats: object = None) -> TrafficSnapshot:
    month = month_stats if isinstance(month_stats, dict) else {}
    return TrafficSnapshot(
        session_download_bytes=bytes_field(stats, "CurrentDownload", "CurrentDownloadBytes"),
        session_upload_bytes=bytes_field(stats, "CurrentUpload", "CurrentUploadBytes"),
        month_download_bytes=bytes_field(month, "CurrentMonthDownload", "MonthDownload"),
        month_upload_bytes=bytes_field(month, "CurrentMonthUpload", "MonthUpload"),
        total_download_bytes=bytes_field(stats, "TotalDownload", "TotalDownloadBytes"),
        total_upload_bytes=bytes_field(stats, "TotalUpload", "TotalUploadBytes"),
        current_connect_seconds=int_field(stats, "CurrentConnectTime", "ConnectTime"),
        total_connect_seconds=int_field(stats, "TotalConnectTime"),
    )


def _extract_hosts(payload: object) -> list[object]:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("hosts", "host", "hostlist"):
        value = field(payload, key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = field(value, "host")
            if isinstance(nested, list):
                return nested
            if isinstance(nested, dict):
                return [nested]
            if field(value, "hostname", "ipaddress", "macaddress") is not None:
                return [value]
    for value in payload.values():
        if isinstance(value, (dict, list)):
            result = _extract_hosts(value)
            if result:
                return result
    return []


def parse_online_seconds(value: object, now: datetime) -> int | None:
    if value is None:
        return None
    number = as_float(value)
    if number is not None:
        if number > 1_000_000_000:
            return max(0, int(now.timestamp() - number))
        return max(0, int(number))
    text = as_text(value)
    if text is None:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return max(0, int(now.timestamp() - parsed.timestamp()))


def parse_clients(payload: object, now: datetime) -> ClientSnapshot:
    clients: list[ClientInfo] = []
    for item in _extract_hosts(payload):
        if not isinstance(item, dict):
            continue
        connection_text = (text_field(item, "NetworkType", "InterfaceType", "ConnectMode", "AccessType") or "").lower()
        if any(token in connection_text for token in ("wifi", "wlan", "wireless", "5g", "2.4g")):
            connection_type = ClientConnectionType.WIFI
        elif any(token in connection_text for token in ("eth", "lan", "wired")):
            connection_type = ClientConnectionType.ETHERNET
        else:
            connection_type = ClientConnectionType.UNKNOWN

        hostname = text_field(item, "HostName", "hostname", "Name")
        ip_address = text_field(item, "IpAddress", "IPAddress", "Ip", "IP")
        mac = normalize_mac_address(field(item, "MacAddress", "MACAddress", "Mac"))
        if hostname is None and ip_address is None and mac is None:
            continue
        clients.append(
            ClientInfo(
                hostname=hostname,
                ip_address=ip_address,
                mac=mac,
                connection_type=connection_type,
                online_seconds=parse_online_seconds(
                    field(item, "AssociatedTime", "AssocTime", "OnlineTime", "ConnectTime"),
                    now,
                ),
            )
        )

    clients.sort(key=lambda client: ((client.hostname or "").lower(), client.ip_address or ""))
    return ClientSnapshot(clients=clients, count=len(clients))


def parse_network_status(status: object, current_plmn: object = None) -> NetworkStatus:
    operator = text_field(current_plmn, "FullName", "ShortName", "OperatorName")
    if operator is None:
        operator = text_field(status, "OperatorName", "ServiceProvider")
    return NetworkStatus(
        operator=operator,
        network_type=text_field(status, "CurrentNetworkTypeEx", "NetworkType", "CurrentNetworkType"),
        roaming=as_bool(field(status, "RoamingStatus", "Roaming")),
        signal_bars=int_field(status, "SignalIcon", "SignalBars", "SignalBar"),
        wan_ip=normalize_wan_ip(field(status, "WanIPAddress", "WanIPv6Address")),
        connect_time_seconds=int_field(status, "CurrentConnectTime", "ConnectTime"),
        uptime_seconds=int_field(status, "Uptime", "UpTime", "uptime"),
    )


def find_list(payload: object, names: tuple[str, ...], depth: int = 0) -> list[object]:
    """Recursively find a list under one of the given keys."""

    if depth > 4:
        return []
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for name in names:
        value = field(payload, name)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = find_list(value, names, depth + 1)
            if nested:
                return nested
            return [value]
    for value in payload.values():
        if isinstance(value, (dict, list)):
            result = find_list(value, names, depth + 1)
            if result:
                return result
    return []


def parse_network_modes(payload: object, current_mode: str | None = None) -> list[NetworkModeOption]:
    """Best-effort parse of firmware-specific ``net/net-mode-list``.

    The library has no 5G enum. We only expose modes the device actually
    reports, and never invent a 5G code.
    """

    items = find_list(payload, ("ModeList", "Modes", "NetModeList", "NetworkModeList", "Mode"))
    options: list[NetworkModeOption] = []
    seen: set[str] = set()

    def add(code: object, label: object = None) -> None:
        value = as_text(code)
        if value is None or value in seen:
            return
        text = as_text(label)
        normalized = f"{value} {text or ''}".lower()
        is_5g = "5g" in normalized or "nr" in normalized
        options.append(NetworkModeOption(code=value, label=text, is_5g=is_5g))
        seen.add(value)

    for item in items:
        if isinstance(item, dict):
            add(
                field(item, "NetworkMode", "Mode", "Value", "Index"),
                field(item, "Name", "ModeName", "Description", "DisplayName"),
            )
        else:
            add(item)

    if current_mode and current_mode not in seen:
        add(current_mode)
    return options


def hex_int(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip().lower().removeprefix("0x")
    try:
        return int(text, 16)
    except ValueError:
        return as_int(value)


def bands_from_mask(mask: int | None) -> list[int]:
    if mask is None or mask <= 0:
        return []
    bands = []
    for band in range(1, 101):
        if mask & (1 << (band - 1)):
            bands.append(band)
    return bands


def last_octet(ip_address: str | None) -> int | None:
    if not ip_address:
        return None
    parts = ip_address.rsplit(".", 1)
    if len(parts) != 2 or not parts[1].isdigit():
        return None
    return int(parts[1])
