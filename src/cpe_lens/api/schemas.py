from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class ConnectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: str = Field(min_length=1, max_length=255)
    username: str = Field(default="admin", min_length=1, max_length=64)
    password: SecretStr = SecretStr("")

    @field_validator("address", "username")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("password")
    @classmethod
    def _limit_password(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) > 256:
            raise ValueError("must be at most 256 characters")
        return value


class HealthResponse(BaseModel):
    status: str
    version: str
    sample_interval_seconds: float


class OperationPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(min_length=1, max_length=64)
    params: dict = Field(default_factory=dict)


class OperationApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=256)
    confirm: bool = False
