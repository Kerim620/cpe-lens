import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface FullscreenContextValue {
  monitoring: boolean;
  nativeFullscreen: boolean;
  toggle: () => void;
  exit: () => void;
}

const FullscreenContext = createContext<FullscreenContextValue | null>(null);

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [monitoring, setMonitoring] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const native = document.fullscreenElement !== null;
      setNativeFullscreen(native);
      if (!native) {
        setMonitoring(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const exit = useCallback(() => {
    setMonitoring(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const toggle = useCallback(() => {
    if (monitoring) {
      exit();
      return;
    }
    setMonitoring(true);
    if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {
        // The monitoring layout still works when native fullscreen is denied.
      });
    }
  }, [exit, monitoring]);

  const value = useMemo(
    () => ({ monitoring, nativeFullscreen, toggle, exit }),
    [exit, monitoring, nativeFullscreen, toggle],
  );
  return <FullscreenContext.Provider value={value}>{children}</FullscreenContext.Provider>;
}

export function useFullscreen(): FullscreenContextValue {
  const context = useContext(FullscreenContext);
  if (!context) throw new Error("useFullscreen must be used inside FullscreenProvider");
  return context;
}
