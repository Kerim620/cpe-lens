import { ArrowUpRight, Clock3, Download, Upload, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { HistoryRange } from "@/api/types";
import { Chart } from "@/components/charts/chart";
import { ConnectionPanel } from "@/components/connection-panel";
import { EmptyState, LoadingState, SectionError } from "@/components/dashboard/data-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClientSummaryCard, NetworkStatusCard, TrafficTotalsCard } from "@/components/dashboard/overview-widgets";
import { RadioSummary } from "@/components/dashboard/radio-summary";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/useDevice";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useHistory } from "@/hooks/useHistory";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useI18n } from "@/i18n/I18nProvider";
import { formatBitrate, formatBytes, formatChartTime, formatDateTime, formatDb, formatDuration } from "@/lib/format";

function formatSignal(_label: string, value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value} dBm`;
}

export function OverviewPage() {
  const { t, language } = useI18n();
  const { snapshot, loading, connecting, error, connect } = useDevice();
  const { dashboard, loading: liveLoading, error: liveError } = useLiveDashboard();
  const [range, setRange] = useState<HistoryRange>("15m");
  const connected = snapshot?.connected ?? false;
  const history = useHistory(range, connected);
  const { monitoring } = useFullscreen();

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("overview.title")} description={t("overview.subtitle")} />
        <LoadingState rows={4} />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("overview.title")} description={t("overview.subtitle")} />
        <ConnectionPanel connecting={connecting} error={error} onConnect={connect} />
        <p className="mx-auto max-w-2xl text-center text-[11px] leading-5 text-muted-foreground">{t("overview.phaseNote")}</p>
      </div>
    );
  }

  const signal = dashboard?.signal.data ?? null;
  const traffic = dashboard?.traffic.data ?? null;
  const status = dashboard?.status.data ?? null;
  const clients = dashboard?.clients.data ?? null;
  const cells = dashboard?.cells.data?.cells ?? [];
  const points = history.data?.points ?? [];
  const speedData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    download: point.download_bps,
    upload: point.upload_bps,
  }));
  const signalData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    lte: point.lte_rsrp,
    nr: point.nr_rsrp,
  }));
  const volumeData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    download: point.download_bytes,
    upload: point.upload_bytes,
  }));
  const sinrData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    lte: point.lte_sinr,
    nr: point.nr_sinr,
  }));
  const rsrqData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    lte: point.lte_rsrq,
    nr: point.nr_rsrq,
  }));
  const rssiData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    lte: point.lte_rssi,
    nr: null,
  }));
  const report = snapshot?.capability_report;
  const capabilityCount = report?.capabilities.length ?? 0;
  const issueCount =
    report?.capabilities.filter((item) => ["unsupported", "no_permission", "probe_failed", "unavailable"].includes(item.status)).length ?? 0;
  const sessionTotal =
    traffic?.session_download_bytes !== null && traffic?.session_download_bytes !== undefined &&
    traffic?.session_upload_bytes !== null && traffic?.session_upload_bytes !== undefined
      ? traffic.session_download_bytes + traffic.session_upload_bytes
      : null;
  const latestHistory = history.data?.points.at(-1);

  if (monitoring) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[1800px] flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard color="var(--chart-download)" label={t("traffic.download")} value={formatBitrate(traffic?.download_bps ?? null, language)} />
          <MetricCard color="var(--chart-upload)" label={t("traffic.upload")} value={formatBitrate(traffic?.upload_bps ?? null, language)} />
          <MetricCard color="var(--chart-lte)" label={t("signal.lte")} value={formatSignal(t("signal.rsrp"), signal?.lte?.rsrp_dbm)} />
          <MetricCard color="var(--chart-nr)" label={t("signal.nr")} value={formatSignal(t("signal.rsrp"), signal?.nr?.rsrp_dbm)} />
        </div>
        {liveError ? <ErrorBanner error={liveError} /> : null}
        <div className="grid gap-3 xl:grid-cols-2">
          <SectionCard
            actions={<RangeTabs onChange={setRange} value={range} />}
            title={t("traffic.speedChart")}
          >
            <Chart
              ariaLabel={t("overview.trafficChartAria")}
              data={speedData}
              emptyLabel={t("history.empty")}
              height={250}
              series={[
                { key: "download", label: t("traffic.download"), color: "var(--chart-download)" },
                { key: "upload", label: t("traffic.upload"), color: "var(--chart-upload)" },
              ]}
              valueFormatter={(value) => formatBitrate(value, language)}
              variant="area"
              yAxisWidth={68}
            />
          </SectionCard>
          <SectionCard title={t("traffic.volumeChart")}>
            <Chart
              ariaLabel={t("traffic.volumeChartAria")}
              data={volumeData}
              emptyLabel={t("history.empty")}
              height={250}
              series={[
                { key: "download", label: t("traffic.download"), color: "var(--chart-download)" },
                { key: "upload", label: t("traffic.upload"), color: "var(--chart-upload)" },
              ]}
              valueFormatter={(value) => formatBytes(value, language)}
              variant="bar"
              yAxisWidth={68}
            />
          </SectionCard>
          <SectionCard title={t("signal.historyTitle")}>
            <Chart
              ariaLabel={t("overview.signalChartAria")}
              data={signalData}
              emptyLabel={t("history.empty")}
              height={250}
              series={[
                { key: "lte", label: t("signal.lte"), color: "var(--chart-lte)" },
                { key: "nr", label: t("signal.nr"), color: "var(--chart-nr)" },
              ]}
              valueFormatter={(value) => formatDb(value, language)}
              variant="line"
            />
          </SectionCard>
          <SectionCard title={t("signal.sinrTrend")}>
            <Chart
              ariaLabel={t("signal.sinrTrend")}
              data={sinrData}
              emptyLabel={t("history.empty")}
              height={250}
              series={[
                { key: "lte", label: t("signal.lte"), color: "var(--chart-lte)" },
                { key: "nr", label: t("signal.nr"), color: "var(--chart-nr)" },
              ]}
              valueFormatter={(value) => formatDb(value, language)}
              variant="line"
            />
          </SectionCard>
          <SectionCard title={t("signal.rsrqTrend")}>
            <Chart
              ariaLabel={t("signal.rsrqTrend")}
              data={rsrqData}
              emptyLabel={t("history.empty")}
              height={250}
              series={[
                { key: "lte", label: t("signal.lte"), color: "var(--chart-lte)" },
                { key: "nr", label: t("signal.nr"), color: "var(--chart-nr)" },
              ]}
              valueFormatter={(value) => formatDb(value, language)}
              variant="line"
            />
          </SectionCard>
          <SectionCard title={t("signal.rssiTrend")}>
            <Chart
              ariaLabel={t("signal.rssiTrend")}
              data={rssiData}
              emptyLabel={t("history.empty")}
              height={250}
              series={[{ key: "lte", label: t("signal.lte"), color: "var(--chart-lte)" }]}
              valueFormatter={(value) => formatDb(value, language)}
              variant="line"
            />
          </SectionCard>
        </div>
        {history.error ? <ErrorBanner error={history.error} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader description={t("overview.subtitle")} title={t("overview.title")} />

      {liveError ? <ErrorBanner error={liveError} /> : null}
      {liveLoading && !dashboard ? <LoadingState rows={2} /> : null}


      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          color="var(--chart-download)"
          hint={traffic?.today_download_bytes !== null && traffic?.today_download_bytes !== undefined ? `${t("traffic.today")}: ${formatBytes(traffic.today_download_bytes, language)}` : undefined}
          icon={<Download className="size-4" />}
          label={t("traffic.download")}
          trend={points.map((point) => point.download_bps)}
          value={formatBitrate(traffic?.download_bps ?? null, language)}
        />
        <MetricCard
          color="var(--chart-upload)"
          hint={traffic?.today_upload_bytes !== null && traffic?.today_upload_bytes !== undefined ? `${t("traffic.today")}: ${formatBytes(traffic.today_upload_bytes, language)}` : undefined}
          icon={<Upload className="size-4" />}
          label={t("traffic.upload")}
          trend={points.map((point) => point.upload_bps)}
          value={formatBitrate(traffic?.upload_bps ?? null, language)}
        />
        <MetricCard
          color="var(--chart-neutral)"
          hint={t("traffic.currentSessionHint", { duration: formatDuration(traffic?.current_connect_seconds ?? null, language) })}
          icon={<Clock3 className="size-4" />}
          label={t("traffic.session")}
          value={formatBytes(sessionTotal, language)}
        />
        <MetricCard
          color="var(--chart-lte)"
          hint={clients ? t("clients.connection.wifi") + ": " + clients.clients.filter((item) => item.connection_type === "wifi").length : undefined}
          icon={<Users className="size-4" />}
          label={t("clients.title")}
          value={clients?.count ?? t("common.dash")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <NetworkStatusCard status={status} />
        <TrafficTotalsCard traffic={traffic} />
        <ClientSummaryCard clients={clients} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SectionCard
            actions={<RangeTabs onChange={setRange} value={range} />}
            description={t("overview.speedChartDescription")}
            title={t("traffic.speedChart")}
          >
            <Chart
              ariaLabel={t("overview.trafficChartAria")}
              data={speedData}
              emptyLabel={t("history.empty")}
              series={[
                { key: "download", label: t("traffic.download"), color: "var(--chart-download)" },
                { key: "upload", label: t("traffic.upload"), color: "var(--chart-upload)" },
              ]}
              valueFormatter={(value) => formatBitrate(value, language)}
              variant="area"
              yAxisWidth={68}
            />
            {dashboard?.traffic ? <SectionError section={dashboard.traffic} /> : null}
            {history.error ? <ErrorBanner error={history.error} /> : null}
          </SectionCard>

          <SectionCard
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link to="/signal">
                  {t("overview.details")}
                  <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            }
            title={t("signal.historyTitle")}
          >
            <Chart
              ariaLabel={t("overview.signalChartAria")}
              data={signalData}
              emptyLabel={t("history.empty")}
              height={220}
              series={[
                { key: "lte", label: t("signal.lte"), color: "var(--chart-lte)" },
                { key: "nr", label: t("signal.nr"), color: "var(--chart-nr)" },
              ]}
              valueFormatter={(value) => formatDb(value, language)}
              variant="line"
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <RadioSummary signal={signal} />
          {dashboard?.signal ? <SectionError section={dashboard.signal} /> : null}
          <SectionCard
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link to="/signal">
                  {t("overview.details")}
                  <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            }
            title={t("cells.title")}
          >
            {cells.length === 0 ? (
              <EmptyState title={t("cells.empty")} />
            ) : (
              <ul className="space-y-2">
                {cells.slice(0, 3).map((cell, index) => (
                  <li className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-[11px]" key={`${cell.radio}-${index}`}>
                    <span className="font-medium uppercase text-foreground">{cell.radio}</span>
                    <span className="text-muted-foreground">B{cell.band ?? t("common.dash")} · PCI {cell.pci ?? t("common.dash")}</span>
                    <span className="font-mono text-muted-foreground">{cell.cell_id ?? t("common.dash")}</span>
                  </li>
                ))}
              </ul>
            )}
            {dashboard?.cells ? <div className="mt-3"><SectionError section={dashboard.cells} /></div> : null}
          </SectionCard>
          <SectionCard
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link to="/device">
                  {t("overview.openDevice")}
                  <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            }
            title={t("overview.capabilitiesTitle")}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border p-2 text-center">
                <p className="tabular text-lg font-semibold text-success">{report?.capabilities.filter((item) => item.status === "available").length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">{t("capability.status.available")}</p>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <p className="tabular text-lg font-semibold text-warning">{report?.capabilities.filter((item) => item.status === "experimental").length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">{t("capability.status.experimental")}</p>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <p className="tabular text-lg font-semibold text-destructive">{issueCount}</p>
                <p className="text-[10px] text-muted-foreground">{t("device.filter.issues")}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{t("overview.capabilityCount", { count: capabilityCount, latest: formatDateTime(latestHistory?.timestamp ?? null, language, t("common.dash")) })}</p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
