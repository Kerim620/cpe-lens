import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, api } from "../api/client";
import type { ConnectInput, ConnectionSnapshot, ErrorInfo } from "../api/types";
import { isTranslationKey } from "../i18n/translations";
import type { TranslationKey } from "../i18n/translations";

export interface UiError {
  code: string;
  messageKey: TranslationKey;
  detail: string | null;
  retryable: boolean;
}

interface DeviceContextValue {
  snapshot: ConnectionSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  connecting: boolean;
  probing: boolean;
  error: UiError | null;
  refresh: () => Promise<void>;
  refreshDevice: () => Promise<boolean>;
  connect: (input: ConnectInput) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  probe: () => Promise<boolean>;
  clearError: () => void;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

export function errorInfoToUi(info: ErrorInfo): UiError {
  return {
    code: info.code,
    messageKey: isTranslationKey(info.message_key) ? info.message_key : "error.unknown",
    detail: info.detail,
    retryable: info.retryable,
  };
}

export function toUiError(error: unknown): UiError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      messageKey: isTranslationKey(error.messageKey) ? error.messageKey : "error.unknown",
      detail: error.detail,
      retryable: error.retryable,
    };
  }
  return {
    code: "unknown",
    messageKey: "error.unknown",
    detail: error instanceof Error ? error.name : null,
    retryable: false,
  };
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshSnapshot = useCallback(async (silent: boolean) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    if (!silent) {
      setRefreshing(true);
    }
    try {
      const next = await api.getDevice();
      if (mountedRef.current) {
        setSnapshot(next);
        setError(null);
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
      }
    } finally {
      if (!silent && mountedRef.current) {
        setRefreshing(false);
      }
      busyRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    await refreshSnapshot(false);
  }, [refreshSnapshot]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const device = await api.getDevice();
        if (cancelled) {
          return;
        }
        setSnapshot(device);
      } catch (requestError) {
        if (!cancelled) {
          setError(toUiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshSnapshot(true);
      }
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshSnapshot]);

  const refreshDevice = useCallback(async () => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const info = await api.refreshDevice();
      if (mountedRef.current) {
        setSnapshot((current) => (current ? { ...current, device: info } : current));
      }
      return true;
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
      }
      return false;
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const connect = useCallback(async (input: ConnectInput) => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setConnecting(true);
    setError(null);
    try {
      const next = await api.connect(input);
      if (mountedRef.current) {
        setSnapshot(next);
      }
      return true;
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
        try {
          setSnapshot(await api.getDevice());
        } catch {
          // The connection error is already displayed.
        }
      }
      return false;
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setConnecting(false);
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setError(null);
    try {
      const next = await api.disconnect();
      if (mountedRef.current) {
        setSnapshot(next);
      }
      return true;
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
      }
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const probe = useCallback(async () => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setProbing(true);
    setError(null);
    try {
      const report = await api.probe();
      if (mountedRef.current) {
        setSnapshot((current) => (current ? { ...current, capability_report: report, last_error: null } : current));
      }
      return true;
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
      }
      return false;
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setProbing(false);
      }
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      snapshot,
      loading,
      refreshing,
      connecting,
      probing,
      error,
      refresh,
      refreshDevice,
      connect,
      disconnect,
      probe,
      clearError,
    }),
    [
      snapshot,
      loading,
      refreshing,
      connecting,
      probing,
      error,
      refresh,
      refreshDevice,
      connect,
      disconnect,
      probe,
      clearError,
    ],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceContextValue {
  const context = useContext(DeviceContext);
  if (context === null) {
    throw new Error("useDevice must be used inside DeviceProvider");
  }
  return context;
}
