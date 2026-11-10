from __future__ import annotations

from fastapi.testclient import TestClient

from cpe_lens.capabilities.definitions import CAPABILITIES
from cpe_lens.config import Settings
from tests.fakes import FakeFactory


def _connect(client: TestClient, *, password: str = "api-secret-password") -> dict:
    response = client.post(
        "/api/device/connect",
        json={
            "address": "192.168.8.1",
            "username": "admin",
            "password": password,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health_reports_version_and_sample_interval(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["sample_interval_seconds"] == 0
    assert "version" in body
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_connect_probe_disconnect_flow_never_returns_secrets(client: TestClient, settings: Settings) -> None:
    password = "api-secret-password"
    snapshot = _connect(client, password=password)

    assert snapshot["connected"] is True
    assert snapshot["device"]["model"] == "Generic HiLink CPE"
    assert snapshot["capability_report"]["source"] == "device"
    assert len(snapshot["capability_report"]["capabilities"]) == len(CAPABILITIES)
    assert password not in str(snapshot)
    assert "password" not in str(snapshot).lower()

    db_bytes = settings.database_path.read_bytes()
    assert password.encode() not in db_bytes

    capabilities = client.get("/api/capabilities")
    assert capabilities.status_code == 200
    assert capabilities.json()["adapter"] == "fake"

    probe = client.post("/api/device/probe")
    assert probe.status_code == 200
    assert probe.json()["source"] == "device"

    disconnected = client.post("/api/device/disconnect")
    assert disconnected.status_code == 200
    assert disconnected.json()["connected"] is False
    assert disconnected.json()["device"] is None
    assert disconnected.json()["capability_report"] is None


def test_probe_without_connection_returns_409(client: TestClient) -> None:
    response = client.post("/api/device/probe")
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "device_not_connected"
    assert body["message_key"] == "error.device_not_connected"


def test_invalid_address_returns_400_without_echoing_password(client: TestClient) -> None:
    response = client.post(
        "/api/device/connect",
        json={
            "address": "ftp://user:secret@example.com/path",
            "username": "admin",
            "password": "should-not-appear",
        },
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_device_address"
    assert "should-not-appear" not in response.text


def test_validation_error_does_not_echo_password(client: TestClient) -> None:
    response = client.post(
        "/api/device/connect",
        json={
            "username": "admin",
            "password": "validation-secret",
        },
    )
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_request"
    assert "validation-secret" not in response.text
    assert "address" in body["detail"]


def test_capabilities_before_first_probe_returns_404(client: TestClient) -> None:
    response = client.get("/api/capabilities")
    assert response.status_code == 404
    assert response.json()["code"] == "capabilities_not_probed"


def test_refresh_device_info(client: TestClient) -> None:
    _connect(client)
    response = client.post("/api/device/refresh")
    assert response.status_code == 200
    assert response.json()["model"] == "Generic HiLink CPE"


def test_api_docs_are_available_locally(client: TestClient) -> None:
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/device/connect" in paths
    assert "/api/device/probe" in paths


def test_dashboard_refresh_and_history_are_available(client: TestClient) -> None:
    _connect(client)

    refreshed = client.post("/api/dashboard/refresh")
    assert refreshed.status_code == 200
    dashboard = refreshed.json()
    assert dashboard["connected"] is True
    assert dashboard["status"]["data"]["operator"] == "Test Operator"
    assert dashboard["signal"]["data"]["lte"]["rsrp_dbm"] == -90
    assert dashboard["traffic"]["data"]["total_download_bytes"] == 12_000_000
    assert dashboard["clients"]["data"]["count"] == 2
    assert dashboard["cells"]["data"]["cells"][0]["radio"] == "lte"

    cached = client.get("/api/dashboard")
    assert cached.status_code == 200
    assert cached.json()["sampled_at"] is not None

    history = client.get("/api/history?range=15m")
    assert history.status_code == 200
    body = history.json()
    assert body["range"] == "15m"
    assert body["bucket_seconds"] == 15
    assert len(body["points"]) >= 1
    assert body["points"][0]["lte_rsrp"] == -90
    assert body["summary"]["average"]["lte_rsrp"] == -90


def test_history_rejects_unknown_range(client: TestClient) -> None:
    response = client.get("/api/history?range=30d")
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


def test_disconnect_clears_live_dashboard(client: TestClient) -> None:
    _connect(client)
    client.post("/api/dashboard/refresh")
    client.post("/api/device/disconnect")

    dashboard = client.post("/api/dashboard/refresh").json()
    assert dashboard["connected"] is False
    assert dashboard["status"]["data"] is None
    assert dashboard["signal"]["data"] is None


def test_wifi_plan_requires_confirmation_and_reads_back(client: TestClient) -> None:
    _connect(client)
    current = client.get("/api/wifi")
    assert current.status_code == 200
    assert current.json()["ssid"] == "Test-WiFi"

    password = "new-password-123"
    plan = client.post(
        "/api/operations/plan",
        json={
            "action": "wifi.update",
            "params": {"ssid": "New-WiFi", "hidden": True, "password": password},
        },
    )
    assert plan.status_code == 200, plan.text
    body = plan.json()
    assert body["risk"] == "high"
    assert body["current"]["ssid"] == "Test-WiFi"
    assert body["proposed"]["password_changed"] is True
    assert password not in plan.text

    no_confirm = client.post("/api/operations/apply", json={"token": body["token"], "confirm": False})
    assert no_confirm.status_code == 400
    assert no_confirm.json()["code"] == "confirmation_required"

    applied = client.post("/api/operations/apply", json={"token": body["token"], "confirm": True})
    assert applied.status_code == 200, applied.text
    result = applied.json()
    assert result["status"] == "success"
    assert result["verification"] == "partial"
    assert result["operation_id"] is not None

    reused = client.post("/api/operations/apply", json={"token": body["token"], "confirm": True})
    assert reused.status_code == 400
    assert reused.json()["code"] == "invalid_operation_token"

    logs = client.get("/api/operations")
    assert logs.status_code == 200
    assert password not in logs.text
    assert client.get("/api/wifi").json()["ssid"] == "New-WiFi"


def test_mobile_toggle_and_advanced_toggle_are_verified(client: TestClient) -> None:
    _connect(client)
    plan = client.post(
        "/api/operations/plan",
        json={"action": "mobile.data", "params": {"enabled": False}},
    ).json()
    applied = client.post("/api/operations/apply", json={"token": plan["token"], "confirm": True})
    assert applied.status_code == 200
    assert applied.json()["verification"] == "verified"
    assert client.get("/api/mobile").json()["data_enabled"] is False

    upnp = client.post(
        "/api/operations/plan",
        json={"action": "advanced.upnp", "params": {"enabled": False}},
    ).json()
    result = client.post("/api/operations/apply", json={"token": upnp["token"], "confirm": True})
    assert result.status_code == 200
    assert result.json()["verification"] == "verified"
    assert client.get("/api/advanced").json()["upnp_enabled"] is False


def test_apn_and_sms_actions_never_persist_secrets(client: TestClient) -> None:
    _connect(client)
    apn_password = "apn-secret-password"
    apn_plan = client.post(
        "/api/operations/plan",
        json={
            "action": "apn.create",
            "params": {
                "name": "IoT",
                "apn": "iot.example",
                "username": "iot",
                "password": apn_password,
                "auth_mode": 1,
                "ip_type": 2,
                "is_default": False,
            },
        },
    ).json()
    assert apn_password not in str(apn_plan)
    apn_result = client.post("/api/operations/apply", json={"token": apn_plan["token"], "confirm": True})
    assert apn_result.status_code == 200
    assert apn_result.json()["verification"] == "verified"
    assert len(client.get("/api/apn").json()) == 2

    message = "private SMS body"
    sms_plan = client.post(
        "/api/operations/plan",
        json={"action": "sms.send", "params": {"phone": "+15551234567", "message": message}},
    ).json()
    assert sms_plan["proposed"]["message"] == message
    sms_result = client.post("/api/operations/apply", json={"token": sms_plan["token"], "confirm": True})
    assert sms_result.status_code == 200
    assert sms_result.json()["verification"] == "unverifiable"

    logs = client.get("/api/operations").text
    report = client.get("/api/diagnostics/report")
    assert report.status_code == 200
    assert apn_password not in logs
    assert message not in logs
    assert apn_password not in report.text
    assert message not in report.text


def test_ussd_returns_device_response_without_logging_full_code(client: TestClient) -> None:
    _connect(client)
    code = "*123*secret#"
    plan = client.post("/api/operations/plan", json={"action": "ussd.send", "params": {"code": code}}).json()
    assert code in str(plan)
    result = client.post("/api/operations/apply", json={"token": plan["token"], "confirm": True})
    assert result.status_code == 200
    assert result.json()["output"]["response"] == f"response:{code}"
    logs = client.get("/api/operations").text
    assert code not in logs


def test_plan_rejects_unsupported_capability(client: TestClient, fake_factory: FakeFactory) -> None:
    fake_factory.adapter.unsupported_capabilities.add("wifi_settings")
    _connect(client)
    response = client.post(
        "/api/operations/plan",
        json={"action": "wifi.update", "params": {"ssid": "Nope", "hidden": False}},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "operation_unavailable"


def test_write_capability_no_permission_is_rejected(client: TestClient, fake_factory: FakeFactory) -> None:
    from cpe_lens.models.capability import CapabilityStatus

    fake_factory.adapter.capability_status_overrides["wifi_settings"] = CapabilityStatus.NO_PERMISSION
    _connect(client)
    response = client.post(
        "/api/operations/plan",
        json={"action": "wifi.update", "params": {"ssid": "Nope", "hidden": False}},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "operation_unavailable"


def test_write_timeout_and_device_refusal_are_reported(client: TestClient, fake_factory: FakeFactory) -> None:
    from cpe_lens.models.errors import (
        DeviceNotSupportedError,
        DevicePermissionError,
        DeviceProtocolError,
        DeviceTimeoutError,
    )

    _connect(client)
    for error, code, expected_status in (
        (DeviceTimeoutError("timed out"), "device_timeout", "failed"),
        (DeviceProtocolError("device refused"), "device_protocol_error", "failed"),
        (DevicePermissionError("denied"), "device_permission_denied", "failed"),
        (DeviceNotSupportedError("not supported"), "device_not_supported", "unsupported"),
    ):
        fake_factory.adapter.wifi_write_error = error
        plan = client.post(
            "/api/operations/plan",
            json={"action": "wifi.update", "params": {"ssid": "WillFail", "hidden": False}},
        ).json()
        result = client.post("/api/operations/apply", json={"token": plan["token"], "confirm": True})
        assert result.status_code == 200
        body = result.json()
        assert body["status"] == expected_status
        assert body["error"]["code"] == code
        fake_factory.adapter.wifi_write_error = None


def test_readback_mismatch_fails_the_operation(client: TestClient, fake_factory: FakeFactory) -> None:
    fake_factory.adapter.wifi_store_ssid = False
    _connect(client)
    plan = client.post(
        "/api/operations/plan",
        json={"action": "wifi.update", "params": {"ssid": "Mismatch", "hidden": False}},
    ).json()
    result = client.post("/api/operations/apply", json={"token": plan["token"], "confirm": True})
    assert result.status_code == 200
    body = result.json()
    assert body["status"] == "failed"
    assert body["verification"] == "failed"
    assert body["message_key"] == "operation.verifyFailed"


def test_cross_origin_state_changing_request_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/device/disconnect",
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "invalid_origin"
