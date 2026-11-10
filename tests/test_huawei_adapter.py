from __future__ import annotations

import logging
from typing import Any, cast

import pytest
import requests
from huawei_lte_api.Client import Client
from huawei_lte_api.exceptions import (
    ResponseErrorLoginRequiredException,
    ResponseErrorNotSupportedException,
    ResponseErrorSystemBusyException,
)

from cpe_lens.adapters.huawei import PROBE_CALLS, HuaweiAdapter
from cpe_lens.capabilities.definitions import CAPABILITIES
from cpe_lens.models.capability import CapabilityReason, CapabilityStatus
from cpe_lens.models.errors import (
    AuthExpiredError,
    DevicePermissionError,
    DeviceProtocolError,
    DeviceUnreachableError,
    DomainError,
)


class FakeDevice:
    def __init__(self, information: dict[str, Any]) -> None:
        self._information = information

    def information(self) -> dict[str, Any]:
        return self._information


class FakeMonitoring:
    def status(self) -> dict[str, Any]:
        return {"CurrentNetworkTypeEx": "LTE", "ConnectionStatus": "901"}


class FakeNet:
    def current_plmn(self) -> dict[str, Any]:
        return {"FullName": "Test Operator", "ShortName": "TEST"}


def _adapter() -> HuaweiAdapter:
    return HuaweiAdapter(
        "http://192.168.8.1/",
        "admin",
        "not-a-real-password",
        timeout_seconds=1,
    )


def _client_with_info(information: dict[str, Any]) -> Client:
    fake = type(
        "FakeClient",
        (),
        {
            "device": FakeDevice(information),
            "monitoring": FakeMonitoring(),
            "net": FakeNet(),
        },
    )()
    return cast(Client, fake)


def _set_all_probes_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    for capability_id in PROBE_CALLS:
        monkeypatch.setitem(PROBE_CALLS, capability_id, lambda _client: {"ok": "1"})


async def test_device_info_is_normalized_and_identifiers_are_masked() -> None:
    adapter = _adapter()
    raw_imei = "123456789012345"
    adapter._client = _client_with_info(
        {
            "DeviceName": "Generic HiLink CPE",
            "HardwareVersion": "HW-1",
            "SoftwareVersion": "FW-2",
            "WebUIVersion": "WEB-3",
            "Imei": raw_imei,
            "Imsi": "987654321098765",
            "Iccid": "89860000000000000000",
            "SerialNumber": "SERIAL-123",
            "MacAddress1": "00:11:22:33:44:55",
        }
    )

    info = await adapter.get_device_info()
    dumped = info.model_dump_json()

    assert info.model == "Generic HiLink CPE"
    assert info.firmware_version == "FW-2"
    assert info.web_ui_version == "WEB-3"
    assert info.operator == "Test Operator"
    assert info.network_type == "LTE"
    assert info.imei_masked == "***********2345"
    assert raw_imei not in dumped
    assert "987654321098765" not in dumped
    assert "89860000000000000000" not in dumped
    assert "SERIAL-123" not in dumped
    assert "00:11:22:33:44:55" not in dumped


async def test_successful_read_probes_are_available(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_all_probes_ok(monkeypatch)
    adapter = _adapter()
    adapter._client = cast(Client, object())

    results = await adapter.probe_capabilities()
    by_id = {result.id: result for result in results}

    assert len(results) == len(CAPABILITIES)
    assert by_id["device_info"].status is CapabilityStatus.AVAILABLE
    assert by_id["device_info"].reason is CapabilityReason.OK
    assert by_id["wifi_settings"].status is CapabilityStatus.EXPERIMENTAL
    assert by_id["wifi_settings"].reason is CapabilityReason.WRITE_NOT_VERIFIED
    assert by_id["reboot"].reason is CapabilityReason.NO_SAFE_PROBE
    assert by_id["roaming_switch"].reason is CapabilityReason.WRITE_NOT_VERIFIED
    assert by_id["reboot"].duration_ms == 0


async def test_probe_error_mapping_continues_after_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_all_probes_ok(monkeypatch)

    def unsupported(_client: object) -> object:
        raise ResponseErrorNotSupportedException("100002: No support", 100002)

    def timeout(_client: object) -> object:
        raise requests.Timeout("timed out")

    def permission(_client: object) -> object:
        raise DevicePermissionError("denied")

    def busy(_client: object) -> object:
        raise ResponseErrorSystemBusyException("100004: System busy", 100004)

    def unreachable(_client: object) -> object:
        raise DeviceUnreachableError("offline")

    monkeypatch.setitem(PROBE_CALLS, "signal_metrics", unsupported)
    monkeypatch.setitem(PROBE_CALLS, "traffic_stats", timeout)
    monkeypatch.setitem(PROBE_CALLS, "firewall", permission)
    monkeypatch.setitem(PROBE_CALLS, "diagnostics", busy)
    monkeypatch.setitem(PROBE_CALLS, "connected_clients", unreachable)

    adapter = _adapter()
    adapter._client = cast(Client, object())
    by_id = {result.id: result for result in await adapter.probe_capabilities()}

    assert by_id["signal_metrics"].status is CapabilityStatus.UNSUPPORTED
    assert by_id["signal_metrics"].reason is CapabilityReason.NO_SUPPORT
    assert by_id["traffic_stats"].status is CapabilityStatus.PROBE_FAILED
    assert by_id["traffic_stats"].reason is CapabilityReason.TIMEOUT
    assert by_id["firewall"].status is CapabilityStatus.NO_PERMISSION
    assert by_id["firewall"].reason is CapabilityReason.NO_PERMISSION
    assert by_id["diagnostics"].status is CapabilityStatus.PROBE_FAILED
    assert by_id["diagnostics"].reason is CapabilityReason.DEVICE_BUSY
    assert by_id["connected_clients"].status is CapabilityStatus.PROBE_FAILED
    assert by_id["connected_clients"].reason is CapabilityReason.CONNECTION_ERROR
    assert by_id["device_info"].status is CapabilityStatus.AVAILABLE


async def test_empty_probe_response_is_a_probe_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_all_probes_ok(monkeypatch)
    monkeypatch.setitem(PROBE_CALLS, "signal_metrics", lambda _client: {})

    adapter = _adapter()
    adapter._client = cast(Client, object())
    by_id = {result.id: result for result in await adapter.probe_capabilities()}

    assert by_id["signal_metrics"].status is CapabilityStatus.PROBE_FAILED
    assert by_id["signal_metrics"].reason is CapabilityReason.BAD_RESPONSE


async def test_login_required_probe_raises_auth_expired(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_all_probes_ok(monkeypatch)

    def login_required(_client: object) -> object:
        raise ResponseErrorLoginRequiredException("100003: No rights", 100003)

    monkeypatch.setitem(PROBE_CALLS, "signal_metrics", login_required)
    adapter = _adapter()
    adapter._client = cast(Client, object())

    with pytest.raises(AuthExpiredError):
        await adapter.probe_capabilities()


def test_every_capability_has_a_read_only_probe_or_is_a_write_without_safe_probe() -> None:
    for definition in CAPABILITIES:
        if definition.probe_endpoint is None:
            assert definition.id == "reboot"
        else:
            assert definition.id in PROBE_CALLS


class UnsupportedInfoDevice:
    def information(self) -> dict[str, Any]:
        raise ResponseErrorNotSupportedException("100002: No support", 100002)


async def test_unsupported_device_information_becomes_a_protocol_error() -> None:
    adapter = _adapter()
    fake = type(
        "FakeClient",
        (),
        {
            "device": UnsupportedInfoDevice(),
            "monitoring": FakeMonitoring(),
            "net": FakeNet(),
        },
    )()
    adapter._client = cast(Client, fake)

    with pytest.raises(DeviceProtocolError):
        await adapter.get_device_info()


async def test_password_is_not_written_to_logs_by_the_library(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    adapter = HuaweiAdapter(
        "http://127.0.0.1:1/",
        "admin",
        "never-log-this-password",
        timeout_seconds=0.25,
    )

    with pytest.raises(DomainError):
        await adapter.connect()

    assert "never-log-this-password" not in caplog.text


class FakeMonitoringDashboard:
    def status(self) -> dict[str, Any]:
        return {
            "CurrentNetworkTypeEx": "LTE",
            "RoamingStatus": "0",
            "SignalIcon": "4",
            "WanIPAddress": "198.51.100.23",
            "Uptime": "3600",
        }

    def traffic_statistics(self) -> dict[str, Any]:
        return {
            "CurrentDownload": "1000",
            "CurrentUpload": "500",
            "TotalDownload": "10000",
            "TotalUpload": "5000",
            "CurrentConnectTime": "60",
        }

    def month_statistics(self) -> dict[str, Any]:
        return {"CurrentMonthDownload": "3000", "CurrentMonthUpload": "1500"}


class FakeNetDashboard:
    def current_plmn(self) -> dict[str, Any]:
        return {"FullName": "Test Operator"}

    def cell_info(self) -> dict[str, Any]:
        return {"cellinfo": [{"type": "LTE", "band": "3", "pci": "123", "cellid": "abc"}]}


class FakeDeviceDashboard:
    def signal(self) -> dict[str, Any]:
        return {"rsrp": "-90dBm", "sinr": "15dB", "band": "3", "pci": "123"}


class FakeWlanDashboard:
    def host_list(self) -> dict[str, Any]:
        return {
            "Hosts": {
                "Host": [
                    {
                        "HostName": "laptop",
                        "IpAddress": "192.168.8.10",
                        "MacAddress": "02:00:00:00:00:01",
                        "NetworkType": "WiFi",
                        "AssociatedTime": "3600",
                    }
                ]
            }
        }


async def test_huawei_dashboard_reads_are_normalized() -> None:
    adapter = _adapter()
    fake = type(
        "FakeDashboardClient",
        (),
        {
            "monitoring": FakeMonitoringDashboard(),
            "net": FakeNetDashboard(),
            "device": FakeDeviceDashboard(),
            "wlan": FakeWlanDashboard(),
        },
    )()
    adapter._client = cast(Client, fake)

    status = await adapter.get_network_status()
    assert status.operator == "Test Operator"
    assert status.wan_ip_masked == "198.51.*.*"
    signal = await adapter.get_signal()
    assert signal.lte is not None
    assert signal.nr is None
    cells = await adapter.get_cells()
    assert cells.cells[0].radio.value == "lte"
    traffic = await adapter.get_traffic()
    assert traffic.month_download_bytes == 3000
    clients = await adapter.get_clients()
    assert clients.count == 1
    assert clients.clients[0].mac_masked == "**:**:**:00:00:01"
