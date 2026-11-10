import { useCallback, useEffect, useRef, useState } from "react";

import { toUiError } from "./useDevice";
import type { UiError } from "./useDevice";

export function useResource<T>(
  loader: () => Promise<T>,
  enabled = true,
  pollMs = 0,
): {
  data: T | null;
  loading: boolean;
  error: UiError | null;
  reload: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<UiError | null>(null);
  const loaderRef = useRef(loader);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (silent: boolean) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    if (!silent) {
      setLoading(true);
    }
    try {
      const next = await loaderRef.current();
      if (mounted.current) {
        setData(next);
        setError(null);
      }
    } catch (requestError) {
      if (mounted.current) {
        setError(toUiError(requestError));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const reload = useCallback(async () => {
    await load(false);
  }, [load]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load(false);
    if (pollMs <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [enabled, load, pollMs]);

  return { data, loading, error, reload };
}
