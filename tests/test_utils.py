from __future__ import annotations

import pytest

from cpe_lens.models.errors import DeviceAddressError
from cpe_lens.utils import mask_identifier, normalize_device_address


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("http://192.168.8.1", "http://192.168.8.1/"),
        ("192.168.8.1", "http://192.168.8.1/"),
        ("http://192.168.8.1/", "http://192.168.8.1/"),
        ("http://192.168.8.1:8080", "http://192.168.8.1:8080/"),
        ("https://cpe.local", "https://cpe.local/"),
        ("http://[fd00::1]", "http://[fd00::1]/"),
    ],
)
def test_normalize_device_address_accepts_origins(raw: str, expected: str) -> None:
    assert normalize_device_address(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "ftp://192.168.8.1",
        "http://user:pass@192.168.8.1",
        "http://192.168.8.1/admin",
        "http://192.168.8.1/?x=1",
        "http://192.168.8.1/#frag",
        "http://:80",
        "http://192.168.8.1:99999",
    ],
)
def test_normalize_device_address_rejects_unsafe_forms(raw: str) -> None:
    with pytest.raises(DeviceAddressError):
        normalize_device_address(raw)


def test_mask_identifier_keeps_only_suffix() -> None:
    assert mask_identifier("123456789012345") == "***********2345"
    assert mask_identifier("REDACTED") is None
    assert mask_identifier(None) is None
    assert mask_identifier("12") == "**"
