from __future__ import annotations

from datetime import UTC, datetime

from cpe_lens.adapters.parsing import (
    normalize_mac_address,
    normalize_wan_ip,
    parse_cells,
    parse_clients,
    parse_network_modes,
    parse_network_status,
    parse_signal,
    parse_traffic,
    quality_from_rsrp,
)
from cpe_lens.models.telemetry import CellRadio, ClientConnectionType, SignalQuality


def test_flat_lte_signal_does_not_create_nr_metrics() -> None:
    signal = parse_signal({"rsrp": "-90dBm", "rsrq": "-10dB", "sinr": "15dB", "band": "3", "pci": "123"})
    assert signal.lte is not None
    assert signal.lte.rsrp_dbm == -90
    assert signal.lte.quality is SignalQuality.GOOD
    assert signal.nr is None


def test_flat_nr_signal_parses_prefixed_fields() -> None:
    signal = parse_signal(
        {
            "rsrp": "-95dBm",
            "nrrsrp": "-80dBm",
            "nrrsrq": "-8dB",
            "nrsinr": "20dB",
            "nrband": "n78",
            "nrpci": "321",
            "nrcellid": "87654321",
            "nrarfcn": "640000",
        }
    )
    assert signal.lte is not None
    assert signal.lte.rsrp_dbm == -95
    assert signal.nr is not None
    assert signal.nr.rsrp_dbm == -80
    assert signal.nr.band == "n78"
    assert signal.nr.arfcn == 640000


def test_nested_nr_signal_parses_unprefixed_fields() -> None:
    signal = parse_signal({"nr": {"rsrp": "-82dBm", "sinr": "17dB", "band": "n41"}})
    assert signal.nr is not None
    assert signal.nr.rsrp_dbm == -82
    assert signal.nr.band == "n41"
    assert signal.lte is None


def test_signal_quality_thresholds() -> None:
    assert quality_from_rsrp(-70) is SignalQuality.EXCELLENT
    assert quality_from_rsrp(-85) is SignalQuality.GOOD
    assert quality_from_rsrp(-95) is SignalQuality.FAIR
    assert quality_from_rsrp(-110) is SignalQuality.POOR
    assert quality_from_rsrp(None) is None


def test_parse_cells_accepts_nested_single_and_multi() -> None:
    multi = parse_cells(
        {
            "cellinfo": [
                {
                    "type": "LTE",
                    "band": "3",
                    "pci": "123",
                    "cellid": "12345678",
                    "earfcn": "1300",
                    "dlbandwidth": "20MHz",
                },
                {
                    "type": "NR",
                    "band": "n78",
                    "pci": "321",
                    "cellid": "87654321",
                    "arfcn": "640000",
                },
            ]
        }
    )
    assert len(multi.cells) == 2
    assert multi.cells[0].radio is CellRadio.LTE
    assert multi.cells[0].dl_bandwidth_mhz == 20
    assert multi.cells[1].radio is CellRadio.NR

    single = parse_cells({"cellinfo": {"type": "LTE", "pci": "5", "cellid": "abc"}})
    assert len(single.cells) == 1


def test_parse_traffic_and_optional_month() -> None:
    traffic = parse_traffic(
        {
            "CurrentDownload": "1000",
            "CurrentUpload": "500",
            "TotalDownload": "1GB",
            "TotalUpload": "2MB",
            "CurrentConnectTime": "60",
        },
        {"CurrentMonthDownload": "3000", "CurrentMonthUpload": "1500"},
    )
    assert traffic.session_download_bytes == 1000
    assert traffic.total_download_bytes == 1024**3
    assert traffic.total_upload_bytes == 2 * 1024**2
    assert traffic.month_download_bytes == 3000
    assert traffic.current_connect_seconds == 60


def test_parse_clients_keeps_full_mac_and_normalizes_connection_type() -> None:
    now = datetime(2026, 11, 10, 18, 0, tzinfo=UTC)
    clients = parse_clients(
        {
            "Hosts": {
                "Host": [
                    {
                        "HostName": "Laptop",
                        "IpAddress": "192.168.8.10",
                        "MacAddress": "02:00:00:11:22:33",
                        "NetworkType": "WiFi 5GHz",
                        "AssociatedTime": "3600",
                    },
                    {
                        "HostName": "NAS",
                        "IpAddress": "192.168.8.11",
                        "MacAddress": "AA:BB:CC:DD:EE:FF",
                        "NetworkType": "Ethernet",
                        "AssociatedTime": str(int(now.timestamp()) - 60),
                    },
                ]
            }
        },
        now,
    )
    assert clients.count == 2
    laptop = clients.clients[0]
    assert laptop.mac == "02:00:00:11:22:33"
    assert laptop.connection_type is ClientConnectionType.WIFI
    assert laptop.online_seconds == 3600
    nas = clients.clients[1]
    assert nas.connection_type is ClientConnectionType.ETHERNET
    # Numeric values above 1e9 are treated as Unix timestamps.
    assert nas.online_seconds == 60


def test_parse_network_status_keeps_full_wan_ip() -> None:
    status = parse_network_status(
        {
            "CurrentNetworkTypeEx": "LTE",
            "RoamingStatus": "1",
            "SignalIcon": "4",
            "WanIPAddress": "198.51.100.23",
            "CurrentConnectTime": "120",
        },
        {"FullName": "Test Operator"},
    )
    assert status.operator == "Test Operator"
    assert status.network_type == "LTE"
    assert status.roaming is True
    assert status.signal_bars == 4
    assert status.wan_ip == "198.51.100.23"
    assert status.connect_time_seconds == 120


def test_parse_network_modes_only_exposes_reported_5g_modes() -> None:
    payload = {
        "ModeList": {
            "Mode": [
                {"Mode": "00", "Name": "Auto"},
                {"Mode": "08", "Name": "5G only"},
                {"Mode": "0308", "Name": "4G + 5G"},
            ]
        }
    }
    options = parse_network_modes(payload, current_mode="08")
    assert [item.code for item in options] == ["00", "08", "0308"]
    assert [item.is_5g for item in options] == [False, True, True]
    assert parse_network_modes({}, current_mode="0308")[0].code == "0308"


def test_identifier_normalization_helpers() -> None:
    assert normalize_mac_address("aa:bb:cc:dd:ee:ff") == "aa:bb:cc:dd:ee:ff"
    assert normalize_mac_address("not-a-mac") is None
    assert normalize_wan_ip("203.0.113.9") == "203.0.113.9"
    assert normalize_wan_ip("2001:db8:1234:5678::1") == "2001:db8:1234:5678::1"
    assert normalize_wan_ip("0.0.0.0") is None
