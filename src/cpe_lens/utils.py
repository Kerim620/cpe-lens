from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import urlsplit, urlunsplit

from cpe_lens.models.errors import DeviceAddressError


def utc_now() -> datetime:
    return datetime.now(UTC)


def mask_identifier(value: object, *, visible_suffix: int = 4) -> str | None:
    """Mask a subscriber or hardware identifier before it leaves the adapter."""

    if value is None:
        return None
    text = str(value).strip()
    if not text or text.upper() in {"REDACTED", "UNKNOWN", "N/A"}:
        return None
    alphanumeric = "".join(ch for ch in text if ch.isalnum())
    if len(alphanumeric) <= visible_suffix:
        return "*" * len(alphanumeric)
    return f"{'*' * (len(alphanumeric) - visible_suffix)}{alphanumeric[-visible_suffix:]}"


def normalize_device_address(raw: str) -> str:
    """Validate and normalize a HiLink management address.

    Credentials, paths, queries and fragments are rejected so they cannot be
    forwarded to the device or accidentally logged. A missing scheme defaults
    to ``http`` because HiLink devices normally serve plain HTTP on the LAN.
    """

    value = raw.strip()
    if not value:
        raise DeviceAddressError("address is empty")
    if "://" not in value:
        value = f"http://{value}"

    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"}:
        raise DeviceAddressError("only http and https addresses are supported")
    if not parsed.hostname:
        raise DeviceAddressError("address must include a host")
    if parsed.username or parsed.password:
        raise DeviceAddressError("credentials must not be embedded in the address")
    if parsed.path not in {"", "/"}:
        raise DeviceAddressError("address must point at the device root")
    if parsed.query or parsed.fragment:
        raise DeviceAddressError("query strings and fragments are not supported")

    try:
        port = parsed.port
    except ValueError as exc:
        raise DeviceAddressError("address contains an invalid port") from exc
    if port is not None and not 1 <= port <= 65535:
        raise DeviceAddressError("address contains an invalid port")

    hostname = parsed.hostname
    host = f"[{hostname}]" if ":" in hostname and not hostname.startswith("[") else hostname
    netloc = host if port is None else f"{host}:{port}"
    return urlunsplit((parsed.scheme, netloc, "/", "", ""))


def text_field(data: object, *keys: str) -> str | None:
    """Read the first non-empty textual field from a mapping."""

    if not isinstance(data, dict):
        return None
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def normalize_device_info(
    information: object,
    monitoring_status: object,
    current_plmn: object,
) -> dict[str, str | None]:
    """Normalize raw HiLink identity responses into safe display fields.

    Raw IMSI, ICCID, serial and MAC fields are deliberately dropped.
    """

    model = text_field(information, "DeviceName", "DeviceType", "productfamily")
    if model:
        model = model.strip()
    return {
        "model": model,
        "hardware_version": text_field(information, "HardwareVersion"),
        "firmware_version": text_field(information, "SoftwareVersion", "FirmwareVersion"),
        "web_ui_version": text_field(information, "WebUIVersion"),
        "device_name": text_field(information, "DeviceName"),
        "imei_masked": mask_identifier(text_field(information, "Imei")),
        "operator": text_field(current_plmn, "FullName", "ShortName", "OperatorName"),
        "network_type": text_field(
            monitoring_status,
            "CurrentNetworkTypeEx",
            "CurrentNetworkType",
            "NetworkType",
        ),
        "connection_status": text_field(monitoring_status, "ConnectionStatus"),
    }
