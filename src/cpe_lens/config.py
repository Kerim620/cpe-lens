from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Application settings loaded from ``CPE_LENS_*`` environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="CPE_LENS_",
        env_file=_ENV_FILE if _ENV_FILE.is_file() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1, le=65535)
    log_level: str = "INFO"
    data_dir: Path = Path("data")
    frontend_dist: Path = Path("frontend/dist")
    device_timeout_seconds: float = Field(default=8.0, gt=0, le=60)
    connect_timeout_seconds: float = Field(default=25.0, gt=0, le=120)
    probe_timeout_seconds: float = Field(default=75.0, gt=0, le=300)
    heartbeat_timeout_seconds: float = Field(default=15.0, gt=0, le=60)
    monitor_interval_seconds: float = Field(default=30.0, ge=0, le=3600)
    sample_interval_seconds: float = Field(default=5.0, ge=0, le=3600)
    telemetry_section_timeout_seconds: float = Field(default=20.0, gt=0, le=120)
    history_raw_days: int = Field(default=30, ge=7, le=365)
    history_hourly_days: int = Field(default=365, ge=30, le=3650)

    @property
    def database_path(self) -> Path:
        return self.data_dir / "cpe-lens.sqlite3"

    @property
    def resolved_frontend_dist(self) -> Path:
        return self.frontend_dist.resolve()
