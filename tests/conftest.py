from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cpe_lens.config import Settings
from cpe_lens.main import create_app
from tests.fakes import FakeFactory


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        data_dir=tmp_path / "data",
        frontend_dist=tmp_path / "dist",
        monitor_interval_seconds=0,
        device_timeout_seconds=1,
        connect_timeout_seconds=2,
        probe_timeout_seconds=3,
        heartbeat_timeout_seconds=1,
        sample_interval_seconds=0,
    )


@pytest.fixture
def fake_factory() -> FakeFactory:
    return FakeFactory()


@pytest.fixture
def client(settings: Settings, fake_factory: FakeFactory) -> Iterator[TestClient]:
    app = create_app(settings, adapter_factory=fake_factory)
    with TestClient(app) as test_client:
        yield test_client
