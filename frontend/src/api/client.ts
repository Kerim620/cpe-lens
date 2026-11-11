import type {
  AdvancedSettings,
  ApnProfile,
  CapabilityReport,
  ConnectInput,
  ConnectionSnapshot,
  DeviceInfo,
  DiagnosticReport,
  ErrorInfo,
  AppSettings,
  HealthResponse,
  HistoryRange,
  HistoryResponse,
  LiveDashboard,
  MobileSettings,
  OperationLogEntry,
  OperationPlan,
  OperationResult,
  SettingsResponse,
  SmsPage,
  UssdState,
  WifiSettings,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
export const eventsUrl = `${API_BASE}/api/events`;

export class ApiError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly detail: string | null;
  readonly status: number;
  readonly retryable: boolean;

  constructor(status: number, info: Partial<ErrorInfo> & { code?: string }) {
    const code = info.code ?? "internal_error";
    super(info.message_key ?? "error.internal");
    this.name = "ApiError";
    this.code = code;
    this.messageKey = info.message_key ?? "error.internal";
    this.detail = info.detail ?? null;
    this.status = status;
    this.retryable = info.retryable ?? status >= 500;
  }
}

function isErrorInfo(value: unknown): value is ErrorInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.message_key === "string" && typeof candidate.code === "string";
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      if (isErrorInfo(payload)) {
        throw new ApiError(response.status, payload);
      }
      throw new ApiError(response.status, {
        code: "internal_error",
        message_key: "error.internal",
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, {
        code: "request_timeout",
        message_key: "error.request_timeout",
        retryable: true,
      });
    }
    throw new ApiError(0, {
      code: "backend_unreachable",
      message_key: "error.backend_unreachable",
      retryable: true,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  health: () => request<HealthResponse>("/api/health", undefined, 5_000),
  getDevice: () => request<ConnectionSnapshot>("/api/device"),
  connect: (input: ConnectInput) =>
    request<ConnectionSnapshot>(
      "/api/device/connect",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      120_000,
    ),
  disconnect: () =>
    request<ConnectionSnapshot>("/api/device/disconnect", {
      method: "POST",
    }),
  refreshDevice: () =>
    request<DeviceInfo>("/api/device/refresh", {
      method: "POST",
    }),
  probe: () =>
    request<CapabilityReport>(
      "/api/device/probe",
      {
        method: "POST",
      },
      90_000,
    ),
  dashboard: () => request<LiveDashboard>("/api/dashboard", undefined, 10_000),
  refreshDashboard: () =>
    request<LiveDashboard>("/api/dashboard/refresh", { method: "POST" }, 120_000),
  getSettings: () => request<SettingsResponse>("/api/settings"),
  updateSettings: (settings: AppSettings) =>
    request<SettingsResponse>(
      "/api/settings",
      {
        method: "PUT",
        body: JSON.stringify(settings),
      },
      60_000,
    ),
  resetSettings: () =>
    request<SettingsResponse>("/api/settings", { method: "DELETE" }),
  history: (range: HistoryRange) =>
    request<HistoryResponse>(`/api/history?range=${encodeURIComponent(range)}`, undefined, 20_000),
  wifi: () => request<WifiSettings>("/api/wifi", undefined, 20_000),
  mobile: () => request<MobileSettings>("/api/mobile", undefined, 20_000),
  apn: () => request<ApnProfile[]>("/api/apn", undefined, 20_000),
  sms: (page = 1, readCount = 20) =>
    request<SmsPage>(`/api/sms?page=${page}&read_count=${readCount}`, undefined, 30_000),
  ussd: () => request<UssdState>("/api/ussd", undefined, 20_000),
  advanced: () => request<AdvancedSettings>("/api/advanced", undefined, 20_000),
  planOperation: (action: string, params: Record<string, unknown>) =>
    request<OperationPlan>(
      "/api/operations/plan",
      { method: "POST", body: JSON.stringify({ action, params }) },
      30_000,
    ),
  applyOperation: (token: string, confirm: boolean) =>
    request<OperationResult>(
      "/api/operations/apply",
      { method: "POST", body: JSON.stringify({ token, confirm }) },
      120_000,
    ),
  operations: (limit = 50) =>
    request<OperationLogEntry[]>(`/api/operations?limit=${limit}`, undefined, 20_000),
  diagnosticReport: () => request<DiagnosticReport>("/api/diagnostics/report", undefined, 30_000),
};
