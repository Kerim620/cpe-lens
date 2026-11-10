import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { HistoryRange, HistoryResponse } from "../api/types";
import { toUiError } from "./useDevice";
import type { UiError } from "./useDevice";

interface HistoryState {
  range: HistoryRange;
  data: HistoryResponse | null;
}

export function useHistory(range: HistoryRange, enabled: boolean): {
  data: HistoryResponse | null;
  loading: boolean;
  error: UiError | null;
} {
  const [state, setState] = useState<HistoryState>({ range, data: null });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let inFlight = false;

    const load = async (silent: boolean) => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      if (!silent) {
        setLoading(true);
      }
      try {
        const data = await api.history(range);
        if (!cancelled) {
          setState({ range, data });
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(toUiError(requestError));
        }
      } finally {
        inFlight = false;
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [range, enabled]);

  return {
    data: state.range === range ? state.data : null,
    loading,
    error,
  };
}
