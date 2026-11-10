from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response as StarletteResponse

from cpe_lens import __version__
from cpe_lens.adapters.factory import AdapterFactory
from cpe_lens.api.routes import router
from cpe_lens.config import Settings
from cpe_lens.logging_config import configure_logging
from cpe_lens.models.errors import DomainError, ErrorInfo
from cpe_lens.services.controls import OperationService
from cpe_lens.services.device_manager import DeviceManager
from cpe_lens.services.telemetry import TelemetryService
from cpe_lens.storage.database import CapabilityStore, Database
from cpe_lens.storage.history import HistoryStore
from cpe_lens.storage.operations import OperationStore

_LOGGER = logging.getLogger(__name__)


def _install_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    assets = dist / "assets"
    if not index.is_file():

        @app.get("/", include_in_schema=False)
        async def backend_root() -> JSONResponse:
            return JSONResponse(
                {
                    "name": "CPE Lens",
                    "version": __version__,
                    "api": "/api/health",
                    "frontend": "not built",
                }
            )

        return

    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    resolved_root = dist.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> Response:
        if full_path == "api" or full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = (dist / full_path).resolve()
        try:
            candidate.relative_to(resolved_root)
        except ValueError:
            return FileResponse(index)
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


def create_app(settings: Settings | None = None, adapter_factory: AdapterFactory | None = None) -> FastAPI:
    resolved_settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(resolved_settings.log_level)
        database = Database(resolved_settings.database_path)
        database.initialize()
        store = CapabilityStore(database)
        manager = DeviceManager(resolved_settings, store=store, adapter_factory=adapter_factory)
        history = HistoryStore(database)
        telemetry = TelemetryService(manager, history, resolved_settings)
        operation_store = OperationStore(database)
        operations = OperationService(manager, operation_store, resolved_settings)
        app.state.manager = manager
        app.state.database = database
        app.state.history = history
        app.state.telemetry = telemetry
        app.state.operation_store = operation_store
        app.state.operations = operations
        task = asyncio.create_task(manager.watchdog_loop())
        await telemetry.start()
        try:
            yield
        finally:
            await telemetry.stop()
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            await manager.shutdown()

    app = FastAPI(
        title="CPE Lens",
        version=__version__,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.state.manager = None
    app.state.telemetry = None
    app.state.history = None
    app.state.operations = None
    app.state.operation_store = None

    @app.middleware("http")
    async def csrf_guard(
        request: Request, call_next: Callable[[Request], Awaitable[StarletteResponse]]
    ) -> StarletteResponse:
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith("/api"):
            origin = request.headers.get("origin")
            if origin:
                parsed = urlsplit(origin)
                same_host = parsed.netloc == request.headers.get("host")
                loopback = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
                if not same_host and not loopback:
                    info = ErrorInfo(
                        code="invalid_origin",
                        message_key="error.invalid_origin",
                    )
                    return JSONResponse(status_code=403, content=info.model_dump(mode="json"))
        return await call_next(request)

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[StarletteResponse]]
    ) -> StarletteResponse:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
        if exc.status_code >= 500:
            _LOGGER.warning("Request failed: %s (%s)", exc.code, exc.detail or "")
        return JSONResponse(status_code=exc.status_code, content=exc.to_info().model_dump(mode="json"))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Only field locations are exposed; inputs are never echoed because the
        # body can contain a password.
        locations = sorted(
            {".".join(str(part) for part in error.get("loc", ()) if part != "body") for error in exc.errors()}
        )
        info = ErrorInfo(
            code="invalid_request",
            message_key="error.invalid_request",
            detail=", ".join(locations) or None,
        )
        return JSONResponse(status_code=400, content=info.model_dump(mode="json"))

    @app.exception_handler(Exception)
    async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
        _LOGGER.error("Unhandled request error: %s", type(exc).__name__, exc_info=True)
        info = ErrorInfo(code="internal_error", message_key="error.internal")
        return JSONResponse(status_code=500, content=info.model_dump(mode="json"))

    app.include_router(router)
    _install_frontend(app, resolved_settings.resolved_frontend_dist)
    return app


app = create_app()
