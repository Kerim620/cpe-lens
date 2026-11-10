from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request

from cpe_lens import __version__
from cpe_lens.api.schemas import (
    ConnectRequest,
    HealthResponse,
    OperationApplyRequest,
    OperationPlanRequest,
)
from cpe_lens.models.capability import CapabilityReport
from cpe_lens.models.controls import (
    AdvancedSettings,
    ApnProfile,
    DiagnosticReport,
    MobileSettings,
    OperationLogEntry,
    OperationPlan,
    OperationResult,
    SmsPage,
    UssdState,
    WifiSettings,
)
from cpe_lens.models.device import ConnectionSnapshot, DeviceInfo
from cpe_lens.models.errors import CapabilitiesNotProbedError
from cpe_lens.models.history import HistoryRange, HistoryResponse
from cpe_lens.models.telemetry import LiveDashboard
from cpe_lens.services.controls import OperationService
from cpe_lens.services.device_manager import ConnectOptions, DeviceManager
from cpe_lens.services.diagnostics import build_diagnostic_report
from cpe_lens.services.telemetry import TelemetryService
from cpe_lens.storage.history import HistoryStore
from cpe_lens.storage.operations import OperationStore

router = APIRouter(prefix="/api")


def _manager(request: Request) -> DeviceManager:
    manager = getattr(request.app.state, "manager", None)
    if not isinstance(manager, DeviceManager):
        raise RuntimeError("device manager is not initialized")
    return manager


def _telemetry(request: Request) -> TelemetryService:
    telemetry = getattr(request.app.state, "telemetry", None)
    if not isinstance(telemetry, TelemetryService):
        raise RuntimeError("telemetry service is not initialized")
    return telemetry


def _history(request: Request) -> HistoryStore:
    history = getattr(request.app.state, "history", None)
    if not isinstance(history, HistoryStore):
        raise RuntimeError("history store is not initialized")
    return history


def _operations(request: Request) -> OperationService:
    operations = getattr(request.app.state, "operations", None)
    if not isinstance(operations, OperationService):
        raise RuntimeError("operation service is not initialized")
    return operations


def _operation_store(request: Request) -> OperationStore:
    store = getattr(request.app.state, "operation_store", None)
    if not isinstance(store, OperationStore):
        raise RuntimeError("operation store is not initialized")
    return store


def _wake_telemetry(request: Request) -> None:
    telemetry = getattr(request.app.state, "telemetry", None)
    if isinstance(telemetry, TelemetryService):
        telemetry.wake()


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    manager = _manager(request)
    return HealthResponse(
        status="ok",
        version=__version__,
        sample_interval_seconds=manager.settings.sample_interval_seconds,
    )


@router.get("/device", response_model=ConnectionSnapshot)
async def get_device(request: Request) -> ConnectionSnapshot:
    return _manager(request).snapshot()


@router.post("/device/connect", response_model=ConnectionSnapshot)
async def connect_device(request: Request, payload: ConnectRequest) -> ConnectionSnapshot:
    manager = _manager(request)
    snapshot = await manager.connect(
        ConnectOptions(
            address=payload.address,
            username=payload.username,
            password=payload.password.get_secret_value(),
        )
    )
    _wake_telemetry(request)
    return snapshot


@router.post("/device/disconnect", response_model=ConnectionSnapshot)
async def disconnect_device(request: Request) -> ConnectionSnapshot:
    snapshot = await _manager(request).disconnect()
    _wake_telemetry(request)
    return snapshot


@router.post("/device/refresh", response_model=DeviceInfo)
async def refresh_device(request: Request) -> DeviceInfo:
    return await _manager(request).refresh_device_info()


@router.post("/device/probe", response_model=CapabilityReport)
async def probe_capabilities(request: Request) -> CapabilityReport:
    return await _manager(request).probe()


@router.get("/capabilities", response_model=CapabilityReport)
async def get_capabilities(request: Request) -> CapabilityReport:
    report = _manager(request).snapshot().capability_report
    if report is None:
        raise CapabilitiesNotProbedError("capabilities have not been probed yet")
    return report


@router.get("/dashboard", response_model=LiveDashboard)
async def get_dashboard(request: Request) -> LiveDashboard:
    return _telemetry(request).snapshot()


@router.post("/dashboard/refresh", response_model=LiveDashboard)
async def refresh_dashboard(request: Request) -> LiveDashboard:
    return await _telemetry(request).sample_once()


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    request: Request,
    time_range: Annotated[HistoryRange, Query(alias="range")] = HistoryRange.M15,
) -> HistoryResponse:
    return _history(request).query(time_range)


@router.get("/wifi", response_model=WifiSettings)
async def get_wifi(request: Request) -> WifiSettings:
    return await _manager(request).read_wifi()


@router.get("/mobile", response_model=MobileSettings)
async def get_mobile(request: Request) -> MobileSettings:
    return await _manager(request).read_mobile()


@router.get("/apn", response_model=list[ApnProfile])
async def get_apn(request: Request) -> list[ApnProfile]:
    return await _manager(request).read_apn_profiles()


@router.get("/sms", response_model=SmsPage)
async def get_sms(
    request: Request,
    page: int = Query(default=1, ge=1, le=100),
    read_count: int = Query(default=20, ge=1, le=50),
) -> SmsPage:
    return await _manager(request).read_sms_page(page=page, read_count=read_count)


@router.get("/ussd", response_model=UssdState)
async def get_ussd(request: Request) -> UssdState:
    return await _manager(request).read_ussd()


@router.get("/advanced", response_model=AdvancedSettings)
async def get_advanced(request: Request) -> AdvancedSettings:
    return await _manager(request).read_advanced()


@router.post("/operations/plan", response_model=OperationPlan)
async def plan_operation(request: Request, payload: OperationPlanRequest) -> OperationPlan:
    return await _operations(request).plan(payload.action, payload.params)


@router.post("/operations/apply", response_model=OperationResult)
async def apply_operation(request: Request, payload: OperationApplyRequest) -> OperationResult:
    result = await _operations(request).apply(payload.token, payload.confirm)
    _wake_telemetry(request)
    return result


@router.get("/operations", response_model=list[OperationLogEntry])
async def list_operations(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[OperationLogEntry]:
    return _operation_store(request).list_recent(limit)


@router.get("/diagnostics/report", response_model=DiagnosticReport)
async def diagnostic_report(request: Request) -> DiagnosticReport:
    manager = _manager(request)
    return build_diagnostic_report(
        manager,
        _telemetry(request),
        _operation_store(request),
        manager.settings,
    )
