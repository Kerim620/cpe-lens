import { useCallback } from "react";

import { api } from "../api/client";
import type { CapabilityStatus, DiagnosticReport } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { InfoRow } from "../components/InfoRow";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { OperationDialog } from "../components/OperationDialog";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useDevice } from "../hooks/useDevice";
import { useOperation } from "../hooks/useOperation";
import { useResource } from "../hooks/useResource";
import { useI18n } from "../i18n/I18nProvider";
import { isTranslationKey } from "../i18n/translations";
import type { TranslationKey } from "../i18n/translations";
import { formatDateTime, formatNetworkType } from "../lib/format";

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function DiagnosticsPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const connected = snapshot?.connected ?? false;
  const loadReport = useCallback(() => api.diagnosticReport(), []);
  const report = useResource<DiagnosticReport>(loadReport, true, 30_000);
  const operation = useOperation(() => void report.reload());

  const download = () => {
    if (!report.data) return;
    const blob = new Blob([JSON.stringify(report.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cpe-lens-diagnostics-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (deviceLoading) {
    return <LoadingState />;
  }
  const data = report.data;
  const device = (data?.device ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <button className="btn" disabled={!data} onClick={download} type="button">
              <Icon name="advanced" size={16} />
              {t("diagnostics.export")}
            </button>
            {connected ? (
              <button className="btn btn-danger" disabled={operation.planning} onClick={() => void operation.start("device.reboot", {})} type="button">
                <Icon name="refresh" size={16} />
                {t("diagnostics.reboot")}
              </button>
            ) : null}
          </>
        }
        subtitle={t("diagnostics.subtitle")}
        title={t("diagnostics.title")}
      />
      <Notice variant="info" icon="shield">{t("diagnostics.privacyNotice")}</Notice>
      {report.error ? <ErrorBanner error={report.error} /> : null}
      {report.loading && !data ? (
        <LoadingState />
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5" aria-labelledby="diag-device">
              <h2 className="flex items-center gap-2 text-base" id="diag-device"><Icon name="device" size={18} />{t("diagnostics.device")}</h2>
              <dl className="mt-2">
                <InfoRow label={t("device.model")} value={asString(device.model) ?? t("common.dash")} />
                <InfoRow label={t("device.firmware")} value={asString(device.firmware_version) ?? t("common.dash")} />
                <InfoRow label={t("device.webui")} value={asString(device.web_ui_version) ?? t("common.dash")} />
                <InfoRow label={t("device.operator")} value={asString(device.operator) ?? t("common.dash")} />
                <InfoRow label={t("device.networkType")} value={formatNetworkType(asString(device.network_type), language)} />
                <InfoRow label={t("common.status")} value={device.connected ? t("top.connected") : t("top.disconnected")} />
              </dl>
            </section>
            <section className="card p-5" aria-labelledby="diag-runtime">
              <h2 className="flex items-center gap-2 text-base" id="diag-runtime"><Icon name="diagnostics" size={18} />{t("diagnostics.runtime")}</h2>
              <dl className="mt-2">
                <InfoRow label={t("diagnostics.version")} value={data.app_version} />
                <InfoRow label={t("diagnostics.generatedAt")} value={formatDateTime(data.generated_at, language, t("common.dash"))} />
                {Object.entries(data.settings).map(([key, value]) => (
                  <InfoRow key={key} label={t(`diagnostics.setting.${key}` as TranslationKey)} value={String(value)} />
                ))}
              </dl>
            </section>
          </div>

          <section className="card p-5" aria-labelledby="diag-capabilities">
            <h2 className="flex items-center gap-2 text-base" id="diag-capabilities"><Icon name="shield" size={18} />{t("diagnostics.capabilities")}</h2>
            <div className="mt-3 overflow-x-auto rounded-control border border-line">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-elevated text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2.5" scope="col">{t("device.table.feature")}</th><th className="px-3 py-2.5" scope="col">{t("device.table.status")}</th><th className="px-3 py-2.5" scope="col">{t("device.table.reason")}</th></tr></thead>
                <tbody>
                  {data.capabilities.map((item) => (
                    <tr className="border-t border-line" key={String(item.id)}>
                      <td className="px-3 py-2.5">{t(`capability.name.${String(item.id)}` as TranslationKey)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={String(item.status) as CapabilityStatus} /></td>
                      <td className="px-3 py-2.5 text-xs text-muted">{t(`capability.reason.${String(item.reason)}` as TranslationKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5" aria-labelledby="diag-live-errors">
            <h2 className="flex items-center gap-2 text-base" id="diag-live-errors"><Icon name="diagnostics" size={18} />{t("diagnostics.liveErrors")}</h2>
            {Object.entries(data.live_errors).filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] !== null).length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("diagnostics.noLiveErrors")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {Object.entries(data.live_errors).map(([section, item]) =>
                  item ? (
                    <li className="flex flex-wrap items-center gap-2 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-xs" key={section}>
                      <span className="font-medium text-ink">{t(`live.section.${section}` as TranslationKey)}</span>
                      <span className="text-muted">
                        {isTranslationKey(item.message_key) ? t(item.message_key) : t("error.unknown")}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </section>

          <section className="card p-5" aria-labelledby="diag-operations">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base" id="diag-operations"><Icon name="settings" size={18} />{t("diagnostics.operations")}</h2>
              <span className="chip border-line bg-elevated text-muted">{data.operations.length}</span>
            </div>
            {data.operations.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("diagnostics.operationsEmpty")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-control border border-line">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-elevated text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2.5" scope="col">{t("diagnostics.time")}</th><th className="px-3 py-2.5" scope="col">{t("diagnostics.operation")}</th><th className="px-3 py-2.5" scope="col">{t("diagnostics.status")}</th><th className="px-3 py-2.5" scope="col">{t("diagnostics.verification")}</th></tr></thead>
                  <tbody>
                    {data.operations.map((entry) => (
                      <tr className="border-t border-line" key={entry.id}>
                        <td className="px-3 py-2.5 text-xs text-muted">{formatDateTime(entry.created_at, language, t("common.dash"))}</td>
                        <td className="px-3 py-2.5">{t(entry.title_key as TranslationKey)}</td>
                        <td className="px-3 py-2.5 text-xs">{t(`operation.status.${entry.status}` as TranslationKey)}</td>
                        <td className="px-3 py-2.5 text-xs">{t(`verification.${entry.verification}` as TranslationKey)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
      <OperationDialog controller={operation} onClose={() => void report.reload()} />
    </div>
  );
}
