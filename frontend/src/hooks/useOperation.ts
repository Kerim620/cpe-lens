import { useCallback, useRef, useState } from "react";

import { api } from "../api/client";
import type { OperationPlan, OperationResult } from "../api/types";
import { toUiError } from "./useDevice";
import type { UiError } from "./useDevice";

export interface OperationController {
  plan: OperationPlan | null;
  result: OperationResult | null;
  error: UiError | null;
  planning: boolean;
  applying: boolean;
  start: (action: string, params: Record<string, unknown>) => Promise<void>;
  confirm: () => Promise<void>;
  reset: () => void;
}

export function useOperation(onSuccess?: (result: OperationResult) => void): OperationController {
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const successRef = useRef(onSuccess);
  const requestRef = useRef(0);
  successRef.current = onSuccess;

  const reset = useCallback(() => {
    requestRef.current += 1;
    setPlan(null);
    setResult(null);
    setError(null);
    setPlanning(false);
    setApplying(false);
  }, []);

  const start = useCallback(async (action: string, params: Record<string, unknown>) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setPlanning(true);
    setError(null);
    setResult(null);
    setPlan(null);
    try {
      const next = await api.planOperation(action, params);
      if (requestRef.current === requestId) {
        setPlan(next);
      }
    } catch (requestError) {
      if (requestRef.current === requestId) {
        setError(toUiError(requestError));
      }
    } finally {
      if (requestRef.current === requestId) {
        setPlanning(false);
      }
    }
  }, []);

  const confirm = useCallback(async () => {
    if (!plan) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const next = await api.applyOperation(plan.token, true);
      setPlan(null);
      setResult(next);
      if (next.status === "success") {
        successRef.current?.(next);
      }
    } catch (requestError) {
      setPlan(null);
      setError(toUiError(requestError));
    } finally {
      setApplying(false);
    }
  }, [plan]);

  return { plan, result, error, planning, applying, start, confirm, reset };
}
