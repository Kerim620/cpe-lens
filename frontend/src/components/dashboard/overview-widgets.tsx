import { ArrowUpRight, Users, Wifi } from "lucide-react";
import { Link } from "react-router-dom";

import type { ClientSnapshot, NetworkStatus, TrafficSnapshot } from "@/api/types";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/dashboard/section-card";
import { useI18n } from "@/i18n/I18nProvider";
import { formatBytes, formatDuration, formatNetworkType } from "@/lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="max-w-[62%] break-words text-right font-mono text-[11px] text-foreground">{value}</dd>
    </div>
  );
}

export function NetworkStatusCard({ status }: { status: NetworkStatus | null }) {
  const { t, language } = useI18n();
  return (
    <SectionCard title={t("overview.networkTitle")}>
      <dl>
        <Row label={t("device.operator")} value={status?.operator ?? t("common.dash")} />
        <Row label={t("device.networkType")} value={formatNetworkType(status?.network_type ?? null, language)} />
        <Row label={t("device.roaming")} value={status?.roaming === null || status?.roaming === undefined ? t("common.dash") : status.roaming ? t("common.yes") : t("common.no")} />
        <Row label={t("device.wanIp")} value={status?.wan_ip ?? t("common.dash")} />
        <Row label={t("device.signalBars")} value={status?.signal_bars === null || status?.signal_bars === undefined ? t("common.dash") : `${status.signal_bars}/5`} />
        <Row label={t("device.connectedFor")} value={formatDuration(status?.connect_time_seconds ?? null, language)} />
        <Row label={t("device.uptime")} value={formatDuration(status?.uptime_seconds ?? null, language)} />
      </dl>
    </SectionCard>
  );
}

export function TrafficTotalsCard({ traffic }: { traffic: TrafficSnapshot | null }) {
  const { t, language } = useI18n();
  const pairs: Array<[string, number | null, number | null]> = [
    [t("traffic.session"), traffic?.session_download_bytes ?? null, traffic?.session_upload_bytes ?? null],
    [t("traffic.today"), traffic?.today_download_bytes ?? null, traffic?.today_upload_bytes ?? null],
    [t("traffic.month"), traffic?.month_download_bytes ?? null, traffic?.month_upload_bytes ?? null],
    [t("traffic.total"), traffic?.total_download_bytes ?? null, traffic?.total_upload_bytes ?? null],
  ];
  return (
    <SectionCard title={t("overview.trafficTotals")}>
      <div className="space-y-3">
        {pairs.map(([label, down, up]) => (
          <div className="border-b border-border pb-2 last:border-0 last:pb-0" key={label}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <div className="mt-1 flex justify-between gap-2 text-[11px]">
              <span>{t("traffic.download")}: <span className="font-mono text-foreground">{formatBytes(down, language)}</span></span>
              <span>{t("traffic.upload")}: <span className="font-mono text-foreground">{formatBytes(up, language)}</span></span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function ClientSummaryCard({ clients }: { clients: ClientSnapshot | null }) {
  const { t, language } = useI18n();
  const wifi = clients?.clients.filter((client) => client.connection_type === "wifi").length ?? 0;
  const ethernet = clients?.clients.filter((client) => client.connection_type === "ethernet").length ?? 0;
  return (
    <SectionCard
      actions={<Button asChild size="sm" variant="ghost"><Link to="/clients">{t("overview.details")}<ArrowUpRight className="size-3" /></Link></Button>}
      title={t("overview.clientsSummary")}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <span className="tabular text-2xl font-semibold">{clients?.count ?? t("common.dash")}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          <p><Wifi className="inline size-3" /> {t("clients.connection.wifi")}: {wifi}</p>
          <p>{t("clients.connection.ethernet")}: {ethernet}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {(clients?.clients ?? []).slice(0, 3).map((client) => (
          <li className="rounded-md border border-border px-2.5 py-2 text-[11px]" key={`${client.mac ?? client.ip_address}`}>
            <div className="flex justify-between gap-2">
              <span className="truncate font-medium text-foreground">{client.hostname ?? t("clients.unknownName")}</span>
              <span className="shrink-0 text-muted-foreground">{formatDuration(client.online_seconds, language)}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{client.ip_address ?? t("common.dash")} · {client.mac ?? t("common.dash")}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
