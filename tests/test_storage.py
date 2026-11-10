from __future__ import annotations

from pathlib import Path

from cpe_lens.models.capability import (
    CapabilityAccess,
    CapabilityCategory,
    CapabilityReason,
    CapabilityReport,
    CapabilityResult,
    CapabilityStatus,
)
from cpe_lens.storage.database import CapabilityStore, Database


def _report() -> CapabilityReport:
    return CapabilityReport(
        adapter="test",
        source="real_device",
        device_model="Generic HiLink CPE",
        firmware_version="TEST-FW",
        capabilities=[
            CapabilityResult(
                id="device_info",
                category=CapabilityCategory.DEVICE,
                access=CapabilityAccess.READ,
                status=CapabilityStatus.AVAILABLE,
                reason=CapabilityReason.OK,
            )
        ],
    )


def test_capability_store_round_trip(tmp_path: Path) -> None:
    database = Database(tmp_path / "data" / "cpe-lens.sqlite3")
    database.initialize()
    store = CapabilityStore(database)

    assert store.latest() is None
    store.save(_report())
    store.save(_report())

    assert store.count() == 2
    latest = store.latest()
    assert latest is not None
    assert latest.device_model == "Generic HiLink CPE"
    assert latest.capabilities[0].id == "device_info"
    assert database.path.is_file()
