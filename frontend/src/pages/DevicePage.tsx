import { ShieldCheck, Unplug } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { CapabilityList } from "@/components/dashboard/capability-list";
import { LoadingState } from "@/components/dashboard/data-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ConnectionPanel } from "@/components/connection-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/useDevice";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] break-words text-right font-mono text-[11px] text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

export function DevicePage() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { snapshot, loading, connecting, probing, error, connect, disconnect, probe, clearError } = useDevice();

  if (loading) return <LoadingState rows={4} />;
  if (!snapshot?.connected) {
    return (
      <div className="space-y-5">
        <PageHeader description={t("device.subtitle")} title={t("device.title")} />
        <ConnectionPanel connecting={connecting} error={error} onConnect={connect} />
      </div>
    );
  }

  const device = snapshot.device;
  const report = snapshot.capability_report;
  const issues = report?.capabilities.filter((item) => ["unsupported", "no_permission", "probe_failed", "unavailable"].includes(item.status)).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button disabled={probing} onClick={() => void probe()} size="sm" variant="outline">
              <ShieldCheck className={probing ? "size-3.5 animate-pulse" : "size-3.5"} />
              {probing ? t("device.reprobing") : t("device.reprobe")}
            </Button>
            <Button
              onClick={() => {
                void disconnect().then((ok) => {
                  if (ok) navigate("/");
                });
              }}
              size="sm"
              variant="destructive"
            >
              <Unplug className="size-3.5" />
              {t("device.disconnect")}
            </Button>
          </>
        }
        description={t("device.subtitle")}
        title={t("device.title")}
      />
      {error ? <ErrorBanner error={error} onDismiss={clearError} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard description={device?.model ?? undefined} title={t("device.identity")}>
          <dl>
            <Info label={t("device.model")} value={device?.model ?? null} />
            <Info label={t("device.hardware")} value={device?.hardware_version ?? null} />
            <Info label={t("device.firmware")} value={device?.firmware_version ?? null} />
            <Info label={t("device.webui")} value={device?.web_ui_version ?? null} />
            <Info label={t("device.deviceName")} value={device?.device_name ?? null} />
            <Info label={t("device.imei")} value={device?.imei ?? null} />
            <Info label={t("device.operator")} value={device?.operator ?? null} />
            <Info label={t("device.networkType")} value={device?.network_type ?? null} />
          </dl>
        </SectionCard>
        <SectionCard description={snapshot.address ?? undefined} title={t("device.session")}>
          <dl>
            <Info label={t("device.address")} value={snapshot.address} />
            <Info label={t("device.username")} value={snapshot.username} />
            <Info label={t("device.connectedSince")} value={formatDateTime(snapshot.connected_at, language, t("common.dash"))} />
            <Info label={t("device.lastSeen")} value={formatDateTime(snapshot.last_seen_at, language, t("common.dash"))} />
            <Info label={t("device.reconnects")} value={String(snapshot.reconnect_count)} />
            <Info label={t("device.connectionStatus")} value={device?.connection_status ?? null} />
          </dl>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant={issues > 0 ? "warning" : "success"}>{t("device.filter.issues")}: {issues}</Badge>
            <Badge variant="outline">{t("device.capabilityCount", { count: report?.capabilities.length ?? 0 })}</Badge>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        description={report ? t("device.probedAt", { time: formatDateTime(report.probed_at, language, t("common.dash")) }) : t("device.empty")}
        title={t("device.capabilities")}
      >
        {report ? <CapabilityList capabilities={report.capabilities} /> : <p className="py-8 text-center text-xs text-muted-foreground">{t("device.empty")}</p>}
      </SectionCard>
    </div>
  );
}
