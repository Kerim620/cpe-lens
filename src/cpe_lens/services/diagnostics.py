from __future__ import annotations

from cpe_lens import __version__
from cpe_lens.config import Settings
from cpe_lens.models.controls import DiagnosticReport
from cpe_lens.services.device_manager import DeviceManager
from cpe_lens.services.telemetry import TelemetryService
from cpe_lens.storage.operations import OperationStore
from cpe_lens.utils import utc_now


def build_diagnostic_report(
    manager: DeviceManager,
    telemetry: TelemetryService,
    operations: OperationStore,
    settings: Settings,
) -> DiagnosticReport:
    snapshot = manager.snapshot()
    dashboard = telemetry.snapshot()
    device = snapshot.device.model_dump() if snapshot.device is not None else {}
    device["connected"] = snapshot.connected
    device["reconnect_count"] = snapshot.reconnect_count
    capabilities = []
    if snapshot.capability_report is not None:
        for item in snapshot.capability_report.capabilities:
            capabilities.append(
                {
                    "id": item.id,
                    "category": item.category.value,
                    "access": item.access.value,
                    "status": item.status.value,
                    "reason": item.reason.value,
                    "detail": item.detail,
                }
            )
    live_errors = {
        "status": dashboard.status.error,
        "signal": dashboard.signal.error,
        "cells": dashboard.cells.error,
        "traffic": dashboard.traffic.error,
        "clients": dashboard.clients.error,
    }
    return DiagnosticReport(
        generated_at=utc_now(),
        app_version=__version__,
        device=device,
        capabilities=capabilities,
        live_errors=live_errors,
        operations=operations.list_recent(50),
        settings={
            "sample_interval_seconds": settings.sample_interval_seconds,
            "monitor_interval_seconds": settings.monitor_interval_seconds,
            "device_timeout_seconds": settings.device_timeout_seconds,
            "telemetry_section_timeout_seconds": settings.telemetry_section_timeout_seconds,
            "history_raw_days": settings.history_raw_days,
            "history_hourly_days": settings.history_hourly_days,
        },
    )
