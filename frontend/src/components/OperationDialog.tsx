import { useEffect, useRef, useState } from "react";

import type { OperationController } from "../hooks/useOperation";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { isTranslationKey } from "../i18n/translations";
import { ErrorBanner } from "./ErrorBanner";
import { Icon } from "./Icon";

function pretty(value: Record<string, unknown>): string {
  if (Object.keys(value).length === 0) {
    return "—";
  }
  return JSON.stringify(value, null, 2);
}

export function OperationDialog({ controller, onClose }: { controller: OperationController; onClose: () => void }) {
  const { t } = useI18n();
  const [understood, setUnderstood] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const open = Boolean(controller.plan || controller.result || controller.error || controller.planning);

  useEffect(() => {
    if (!open) {
      setUnderstood(false);
      return;
    }
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !controller.applying) {
        controller.reset();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, controller, onClose]);

  if (!open) {
    return null;
  }

  const result = controller.result;
  const plan = controller.plan;
  const risk = plan?.risk ?? "low";
  const close = () => {
    controller.reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
      <div
        aria-modal="true"
        className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-card sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("operation.confirmTitle")}</p>
            <h2 className="mt-1 text-lg">
              {plan ? t(plan.title_key as TranslationKey) : t("operation.resultTitle")}
            </h2>
          </div>
          <button
            aria-label={t("common.close")}
            className="rounded p-1 text-muted hover:bg-elevated hover:text-ink"
            disabled={controller.applying}
            onClick={close}
            ref={closeRef}
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {controller.error ? (
          <div className="mt-4">
            <ErrorBanner error={controller.error} />
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-4">
            <div
              className={`flex items-start gap-3 rounded-control border px-3.5 py-3 ${
                result.status === "success"
                  ? "border-success/30 bg-success/10"
                  : "border-danger/40 bg-danger/10"
              }`}
            >
              <Icon
                className={result.status === "success" ? "text-success" : "text-danger"}
                name={result.status === "success" ? "check" : "alert"}
                size={18}
              />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink">
                  {isTranslationKey(result.message_key) ? t(result.message_key) : t("operation.resultTitle")}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("operation.verificationLabel")}:{" "}
                  {t(`verification.${result.verification}` as TranslationKey)}
                </p>
                {result.error?.detail ? (
                  <code className="mt-1 block break-all font-mono text-[11px] text-muted">{result.error.detail}</code>
                ) : null}
              </div>
            </div>
            {Object.keys(result.output).length > 0 ? (
              <div>
                <p className="label">{t("operation.output")}</p>
                <pre className="max-h-48 overflow-auto rounded-control border border-line bg-elevated p-3 font-mono text-xs">
                  {pretty(result.output)}
                </pre>
              </div>
            ) : null}
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={close} type="button">
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : plan ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`chip ${
                  risk === "high"
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : risk === "medium"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-line bg-elevated text-muted"
                }`}
              >
                <Icon name="alert" size={13} />
                {t(`risk.${risk}` as TranslationKey)}
              </span>
              {plan.capability_ids.map((id) => (
                <span className="chip border-line bg-elevated text-muted" key={id}>
                  {t(`capability.name.${id}` as TranslationKey)}
                </span>
              ))}
            </div>

            {plan.warnings.map((warning) => (
              <p className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-ink" key={warning}>
                <Icon className="mt-0.5 shrink-0 text-warning" name="alert" size={15} />
                {isTranslationKey(warning) ? t(warning) : warning}
              </p>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="label">{t("operation.current")}</p>
                <pre className="max-h-64 overflow-auto rounded-control border border-line bg-elevated p-3 font-mono text-[11px]">
                  {pretty(plan.current)}
                </pre>
              </div>
              <div>
                <p className="label">{t("operation.proposed")}</p>
                <pre className="max-h-64 overflow-auto rounded-control border border-line bg-elevated p-3 font-mono text-[11px]">
                  {pretty(plan.proposed)}
                </pre>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm leading-6 text-ink">
              <input
                checked={understood}
                className="mt-1 h-4 w-4 accent-[rgb(var(--c-brand))]"
                onChange={(event) => setUnderstood(event.target.checked)}
                type="checkbox"
              />
              {t("operation.acknowledge")}
            </label>

            <div className="flex justify-end gap-2">
              <button className="btn" disabled={controller.applying} onClick={close} type="button">
                {t("common.cancel")}
              </button>
              <button
                className={`btn ${risk === "high" ? "btn-danger" : "btn-primary"}`}
                disabled={!understood || controller.applying}
                onClick={() => void controller.confirm()}
                type="button"
              >
                <Icon className={controller.applying ? "animate-spin" : ""} name={controller.applying ? "refresh" : "check"} size={16} />
                {controller.applying ? t("operation.applying") : t("operation.confirm")}
              </button>
            </div>
          </div>
        ) : controller.planning ? (
          <p className="mt-6 text-sm text-muted">{t("operation.planning")}</p>
        ) : (
          <div className="mt-5 flex justify-end">
            <button className="btn" onClick={close} type="button">
              {t("common.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
