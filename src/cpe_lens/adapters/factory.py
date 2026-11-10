from __future__ import annotations

from typing import Protocol

from cpe_lens.adapters.base import DeviceAdapter
from cpe_lens.adapters.huawei import HuaweiAdapter


class AdapterFactory(Protocol):
    def create(
        self,
        *,
        address: str,
        username: str,
        password: str,
    ) -> DeviceAdapter: ...


class DefaultAdapterFactory:
    def __init__(self, *, device_timeout_seconds: float) -> None:
        self._device_timeout_seconds = device_timeout_seconds

    def create(
        self,
        *,
        address: str,
        username: str,
        password: str,
    ) -> DeviceAdapter:
        return HuaweiAdapter(
            address,
            username,
            password,
            timeout_seconds=self._device_timeout_seconds,
        )
