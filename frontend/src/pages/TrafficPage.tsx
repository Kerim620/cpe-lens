import { CalendarDays, Clock3, Download, Upload } from "lucide-react";
import { useState } from "react";

import type { HistoryRange } from "@/api/types";
import { Chart } from "@/components/charts/chart";
import { LoadingState, SectionError } from "@/components/dashboard/data-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { useDevice } from "@/hooks/useDevice";
import { useHistory } from "@/hooks/useHistory";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useI18n } from "@/i18n/I18nProvider";
import { formatBitrate, formatBytes, formatChartTime, formatDuration } from "@/lib/format";

export function TrafficPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const { dashboard, loading: liveLoading, error } = useLiveDashboard();
  const connected = snapshot?.connected ?? false;
  const [range, setRange] = useState<HistoryRange>("1h");
  const history = useHistory(range, connected);
  const traffic = dashboard?.traffic.data ?? null;
  const points = history.data?.points ?? [];
  const speedData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    download: point.download_bps,
    upload: point.upload_bps,
  }));
  const volumeData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    download: point.download_bytes,
    upload: point.upload_bytes,
  }));

  if (deviceLoading || (liveLoading && !dashboard)) return <LoadingState rows={4} />;

  if (!connected) {
    return (
      <div className="space-y-5">
        <PageHeader description={t("traffic.subtitle")} title={t("traffic.title")} />
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("live.disconnectedTitle")}
        </p>
      </div>
    );
  }

  const summary = history.data?.summary;

  return (
    <div className="space-y-5">
      <PageHeader
        description={t("traffic.subtitle")}
        title={t("traffic.title")}
      />
      {error ? <ErrorBanner error={error} /> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          color="var(--chart-download)"
          hint={t("traffic.currentSessionHint", { duration: formatDuration(traffic?.current_connect_seconds ?? null, language) })}
          icon={<Download className="size-4" />}
          label={t("traffic.download")}
          trend={points.map((point) => point.download_bps)}
          value={formatBitrate(traffic?.download_bps ?? null, language)}
        />
        <MetricCard
          color="var(--chart-upload)"
          hint={t("traffic.currentSessionHint", { duration: formatDuration(traffic?.current_connect_seconds ?? null, language) })}
          icon={<Upload className="size-4" />}
          label={t("traffic.upload")}
          trend={points.map((point) => point.upload_bps)}
          value={formatBitrate(traffic?.upload_bps ?? null, language)}
        />
        <MetricCard
          color="var(--chart-download)"
          hint={`${t("traffic.download")}: ${formatBytes(traffic?.today_download_bytes ?? null, language)}`}
          icon={<CalendarDays className="size-4" />}
          label={t("traffic.today")}
          value={formatBytes(
            traffic?.today_download_bytes !== null && traffic?.today_download_bytes !== undefined && traffic?.today_upload_bytes !== null && traffic?.today_upload_bytes !== undefined
              ? traffic.today_download_bytes + traffic.today_upload_bytes
              : null,
            language,
          )}
        />
        <MetricCard
          color="var(--chart-upload)"
          hint={`${t("traffic.upload")}: ${formatBytes(traffic?.month_upload_bytes ?? null, language)}`}
          icon={<Clock3 className="size-4" />}
          label={t("traffic.month")}
          value={formatBytes(
            traffic?.month_download_bytes !== null && traffic?.month_download_bytes !== undefined && traffic?.month_upload_bytes !== null && traffic?.month_upload_bytes !== undefined
              ? traffic.month_download_bytes + traffic.month_upload_bytes
              : null,
            language,
          )}
        />
      </div>

      <SectionCard actions={<RangeTabs onChange={setRange} value={range} />} description={t("traffic.speedChartBody")} title={t("traffic.speedChart")}>
        <Chart
          ariaLabel={t("traffic.speedChartAria")}
          data={speedData}
          emptyLabel={t("history.empty")}
          height={300}
          series={[
            { key: "download", label: t("traffic.download"), color: "var(--chart-download)" },
            { key: "upload", label: t("traffic.upload"), color: "var(--chart-upload)" },
          ]}
          valueFormatter={(value) => formatBitrate(value, language)}
          variant="area"
          yAxisWidth={68}
        />
        {dashboard?.traffic ? <div className="mt-3"><SectionError section={dashboard.traffic} /></div> : null}
        {history.error ? <div className="mt-3"><ErrorBanner error={history.error} /></div> : null}
      </SectionCard>

      <SectionCard description={t("traffic.volumeChartBody")} title={t("traffic.volumeChart")}>
        <Chart
          ariaLabel={t("traffic.volumeChartAria")}
          data={volumeData}
          emptyLabel={t("history.empty")}
          height={240}
          series={[
            { key: "download", label: t("traffic.download"), color: "var(--chart-download)" },
            { key: "upload", label: t("traffic.upload"), color: "var(--chart-upload)" },
          ]}
          valueFormatter={(value) => formatBytes(value, language)}
          variant="bar"
          yAxisWidth={76}
        />
      </SectionCard>

      {summary ? (
        <SectionCard title={t("traffic.summaryTitle")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["current", "average", "minimum", "maximum"] as const).map((key) => (
              <div className="rounded-md border border-border p-3" key={key}>
                <p className="text-[10px] text-muted-foreground">{t(`traffic.stat.${key}`)}</p>
                <p className="tabular mt-1 text-xs text-foreground">
                  {t("traffic.download")}: {formatBitrate(summary[key].download_bps ?? null, language)}
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {t("traffic.upload")}: {formatBitrate(summary[key].upload_bps ?? null, language)}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
