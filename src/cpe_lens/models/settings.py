from __future__ import annotations

from pydantic import BaseModel, Field

from cpe_lens.config import Settings


class AppSettings(BaseModel):
    """User-editable runtime settings persisted in SQLite.

    Infrastructure settings (host, port, data directory, timeouts that are fixed
    at adapter construction) remain environment/startup concerns.
    """

    sample_interval_seconds: float = Field(ge=0, le=3600)
    monitor_interval_seconds: float = Field(ge=0, le=3600)
    telemetry_section_timeout_seconds: float = Field(gt=0, le=120)
    history_raw_days: int = Field(ge=7, le=365)
    history_hourly_days: int = Field(ge=30, le=3650)


class SettingsResponse(BaseModel):
    settings: AppSettings


def snapshot_settings(settings: Settings) -> AppSettings:
    return AppSettings(
        sample_interval_seconds=settings.sample_interval_seconds,
        monitor_interval_seconds=settings.monitor_interval_seconds,
        telemetry_section_timeout_seconds=settings.telemetry_section_timeout_seconds,
        history_raw_days=settings.history_raw_days,
        history_hourly_days=settings.history_hourly_days,
    )


def apply_app_settings(settings: Settings, values: AppSettings) -> None:
    settings.sample_interval_seconds = values.sample_interval_seconds
    settings.monitor_interval_seconds = values.monitor_interval_seconds
    settings.telemetry_section_timeout_seconds = values.telemetry_section_timeout_seconds
    settings.history_raw_days = values.history_raw_days
    settings.history_hourly_days = values.history_hourly_days
