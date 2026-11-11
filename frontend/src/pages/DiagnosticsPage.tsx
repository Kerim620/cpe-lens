import { Download, Power, ShieldCheck, Stethoscope } from "lucide-react";
import { useCallback } from "react";

import { api } from "@/api/client";
import type { CapabilityResult, DiagnosticReport } from "@/api/types";
import { CapabilityList } from "@/components/dashboard/capability-list";
import { DataNotice, LoadingState } from "@/components/dashboard/data-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { OperationDialog } from "@/components/operation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDevice } from "@/hooks/useDevice";
import { useOperation } from "@/hooks/useOperation";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n/I18nProvider";
import { isTranslationKey } from "@/i18n/translations";
import type { TranslationKey } from "@/i18n/translations";
import { formatDateTime, formatNetworkType } from "@/lib/format";

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

  if (deviceLoading) return <LoadingState rows={3} />;
  const data = report.data;
  const device = (data?.device ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button disabled={!data} onClick={download} size="sm" variant="outline">
              <Download className="size-3.5" />
              {t("diagnostics.export")}
            </Button>
            {connected ? (
              <Button disabled={operation.planning} onClick={() => void operation.start("device.reboot", {})} size="sm" variant="destructive">
                <Power className="size-3.5" />
                {t("diagnostics.reboot")}
              </Button>
            ) : null}
          </>
        }
        description={t("diagnostics.subtitle")}
        title={t("diagnostics.title")}
      />
      <DataNotice icon={<ShieldCheck className="mt-0.5 size-3.5 shrink-0" />}>{t("diagnostics.privacyNotice")}</DataNotice>
      {report.error ? <ErrorBanner error={report.error} /> : null}

      {report.loading && !data ? (
        <LoadingState rows={4} />
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("diagnostics.device")}>
              <dl>
                {[
                  [t("device.model"), asString(device.model)],
                  [t("device.firmware"), asString(device.firmware_version)],
                  [t("device.webui"), asString(device.web_ui_version)],
                  [t("device.operator"), asString(device.operator)],
                  [t("device.networkType"), formatNetworkType(asString(device.network_type), language)],
                  [t("common.status"), device.connected ? t("top.connected") : t("top.disconnected")],
                ].map(([label, value]) => (
                  <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0" key={label}>
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="font-mono text-[11px] text-foreground">{value ?? t("common.dash")}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
            <SectionCard title={t("diagnostics.runtime")}>
              <dl>
                {[
                  [t("diagnostics.version"), data.app_version],
                  [t("diagnostics.generatedAt"), formatDateTime(data.generated_at, language, t("common.dash"))],
                  ...Object.entries(data.settings).map(([key, value]) => [t(`diagnostics.setting.${key}` as TranslationKey), String(value)]),
                ].map(([label, value]) => (
                  <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0" key={label}>
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="font-mono text-[11px] text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          </div>

          <SectionCard actions={<Badge variant="outline">{data.capabilities.length}</Badge>} title={t("diagnostics.capabilities")}>
            <CapabilityList capabilities={data.capabilities as unknown as CapabilityResult[]} />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("diagnostics.liveErrors")}>
              {Object.values(data.live_errors).every((item) => item === null) ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("diagnostics.noLiveErrors")}</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(data.live_errors).map(([section, item]) =>
                    item ? (
                      <li className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs" key={section}>
                        <span className="font-medium">{t(`live.section.${section}` as TranslationKey)}</span>
                        <span className="text-muted-foreground">{isTranslationKey(item.message_key) ? t(item.message_key) : t("error.unknown")}</span>
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </SectionCard>

            <SectionCard actions={<Badge variant="outline">{data.operations.length}</Badge>} title={t("diagnostics.operations")}>
              {data.operations.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("diagnostics.operationsEmpty")}</p>
              ) : (
                <>
                  <div className="hidden max-h-[360px] overflow-y-auto md:block">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("diagnostics.time")}</TableHead>
                          <TableHead>{t("diagnostics.operation")}</TableHead>
                          <TableHead>{t("diagnostics.status")}</TableHead>
                          <TableHead>{t("diagnostics.verification")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.operations.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-[10px] text-muted-foreground">{formatDateTime(entry.created_at, language, t("common.dash"))}</TableCell>
                            <TableCell className="text-[11px]">{t(entry.title_key as TranslationKey)}</TableCell>
                            <TableCell className="text-[11px]">{t(`operation.status.${entry.status}` as TranslationKey)}</TableCell>
                            <TableCell className="text-[11px]">{t(`verification.${entry.verification}` as TranslationKey)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ul className="max-h-[360px] space-y-2 overflow-y-auto md:hidden">
                    {data.operations.map((entry) => (
                      <li className="rounded-md border border-border p-2.5" key={entry.id}>
                        <p className="text-[11px] font-medium">{t(entry.title_key as TranslationKey)}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(entry.created_at, language, t("common.dash"))}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge variant={entry.status === "success" ? "success" : "destructive"}>{t(`operation.status.${entry.status}` as TranslationKey)}</Badge>
                          <Badge variant="outline">{t(`verification.${entry.verification}` as TranslationKey)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SectionCard>
          </div>
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Stethoscope className="size-3" />{t("diagnostics.exportHint")}</p>
        </>
      ) : null}
      <OperationDialog controller={operation} onClose={() => void report.reload()} />
    </div>
  );
}
