import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../api/client";
import type { LiveDashboard } from "../api/types";
import { toUiError } from "./useDevice";
import type { UiError } from "./useDevice";

interface LiveDashboardContextValue {
  dashboard: LiveDashboard | null;
  loading: boolean;
  refreshing: boolean;
  error: UiError | null;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const LiveDashboardContext = createContext<LiveDashboardContextValue | null>(null);

export function LiveDashboardProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<LiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const poll = useCallback(async (silent: boolean) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    if (!silent) {
      setRefreshing(true);
    }
    try {
      const next = await api.dashboard();
      if (mountedRef.current) {
        setDashboard(next);
        setError(null);
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void poll(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void poll(true);
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [poll]);

  const refresh = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const next = await api.refreshDashboard();
      if (mountedRef.current) {
        setDashboard(next);
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setError(toUiError(requestError));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ dashboard, loading, refreshing, error, refresh, clearError }),
    [dashboard, loading, refreshing, error, refresh, clearError],
  );
  return <LiveDashboardContext.Provider value={value}>{children}</LiveDashboardContext.Provider>;
}

export function useLiveDashboard(): LiveDashboardContextValue {
  const context = useContext(LiveDashboardContext);
  if (context === null) {
    throw new Error("useLiveDashboard must be used inside LiveDashboardProvider");
  }
  return context;
}
