from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ErrorInfo(BaseModel):
    """A safe, localizable error description.

    ``detail`` must never contain credentials, cookies, tokens, raw device XML,
    SMS bodies or unmasked subscriber identifiers.
    """

    model_config = ConfigDict(extra="forbid")

    code: str
    message_key: str
    detail: str | None = None
    retryable: bool = False


class DomainError(Exception):
    """Base error that can be returned to the browser without leaking internals."""

    code = "internal_error"
    message_key = "error.internal"
    status_code = 500
    retryable = False

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.message_key)
        self.detail = detail

    def to_info(self) -> ErrorInfo:
        return ErrorInfo(
            code=self.code,
            message_key=self.message_key,
            detail=self.detail,
            retryable=self.retryable,
        )


class InvalidRequestError(DomainError):
    code = "invalid_request"
    message_key = "error.invalid_request"
    status_code = 400


class DeviceAddressError(DomainError):
    code = "invalid_device_address"
    message_key = "error.invalid_device_address"
    status_code = 400


class AuthenticationError(DomainError):
    code = "device_auth_failed"
    message_key = "error.device_auth_failed"
    status_code = 401
    retryable = True


class DevicePermissionError(DomainError):
    code = "device_permission_denied"
    message_key = "error.device_permission_denied"
    status_code = 403


class NotConnectedError(DomainError):
    code = "device_not_connected"
    message_key = "error.device_not_connected"
    status_code = 409


class DeviceBusyError(DomainError):
    code = "device_busy"
    message_key = "error.device_busy"
    status_code = 503
    retryable = True


class DeviceUnreachableError(DomainError):
    code = "device_unreachable"
    message_key = "error.device_unreachable"
    status_code = 502
    retryable = True


class DeviceTimeoutError(DomainError):
    code = "device_timeout"
    message_key = "error.device_timeout"
    status_code = 504
    retryable = True


class DeviceProtocolError(DomainError):
    code = "device_protocol_error"
    message_key = "error.device_protocol_error"
    status_code = 502
    retryable = False


class DeviceNotSupportedError(DomainError):
    code = "device_not_supported"
    message_key = "error.device_not_supported"
    status_code = 502
    retryable = False


class AuthExpiredError(DomainError):
    code = "device_session_expired"
    message_key = "error.device_session_expired"
    status_code = 401
    retryable = True


class CapabilitiesNotProbedError(DomainError):
    code = "capabilities_not_probed"
    message_key = "error.capabilities_not_probed"
    status_code = 404


class OperationUnavailableError(DomainError):
    code = "operation_unavailable"
    message_key = "error.operation_unavailable"
    status_code = 409


class ConfirmationRequiredError(DomainError):
    code = "confirmation_required"
    message_key = "error.confirmation_required"
    status_code = 400


class PlanExpiredError(DomainError):
    code = "plan_expired"
    message_key = "error.plan_expired"
    status_code = 410


class InvalidOperationTokenError(DomainError):
    code = "invalid_operation_token"
    message_key = "error.invalid_operation_token"
    status_code = 400
