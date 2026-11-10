import { useState } from "react";

import type { HistoryRange, TrafficSnapshot } from "../api/types";
import { DisconnectedPanel } from "../components/DisconnectedPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { LiveNotice } from "../components/LiveNotice";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { RangeSelector } from "../components/RangeSelector";
import { RefreshLiveButton } from "../components/RefreshLiveButton";
import { SectionError } from "../components/SectionError";
import { useDevice } from "../hooks/useDevice";
import { useHistory } from "../hooks/useHistory";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { useI18n } from "../i18n/I18nProvider";
import { formatBitrate, formatBytes, formatDateTime, formatDuration } from "../lib/format";

function TrafficPairCard({
  label,
  download,
  upload,
  hint,
}: {
  label: string;
  download: number | null;
  upload: number | null;
  hint?: string;
}) {
  const { t, language } = useI18n();
  return (
    <div className="rounded-control border border-line bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="tabular text-lg font-semibold text-[rgb(var(--c-download))]">
          ↓ {formatBytes(download, language)}
        </span>
        <span className="tabular text-lg font-semibold text-[rgb(var(--c-upload))]">
          ↑ {formatBytes(upload, language)}
        </span>
      </div>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
      <p className="sr-only">{t("traffic.downloadUploadHint")}</p>
    </div>
  );
}

function TrafficSummary({
  traffic,
  historySummary,
}: {
  traffic: TrafficSnapshot | null;
  historySummary: {
    average: Record<string, number | null>;
    minimum: Record<string, number | null>;
    maximum: Record<string, number | null>;
  } | null;
}) {
  const { t, language } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-control border border-line bg-elevated/50 px-3 py-2 text-xs text-muted">
        <p className="font-medium text-ink">{t("traffic.averageSpeed")}</p>
        <p className="tabular mt-1">
          ↓ {formatBitrate(historySummary?.average["download_bps"] ?? null, language)} · ↑{" "}
          {formatBitrate(historySummary?.average["upload_bps"] ?? null, language)}
        </p>
      </div>
      <div className="rounded-control border border-line bg-elevated/50 px-3 py-2 text-xs text-muted">
        <p className="font-medium text-ink">{t("traffic.peakSpeed")}</p>
        <p className="tabular mt-1">
          ↓ {formatBitrate(historySummary?.maximum["download_bps"] ?? null, language)} · ↑{" "}
          {formatBitrate(historySummary?.maximum["upload_bps"] ?? null, language)}
        </p>
      </div>
      <div className="rounded-control border border-line bg-elevated/50 px-3 py-2 text-xs text-muted">
        <p className="font-medium text-ink">{t("traffic.minimumSpeed")}</p>
        <p className="tabular mt-1">
          ↓ {formatBitrate(historySummary?.minimum["download_bps"] ?? null, language)} · ↑{" "}
          {formatBitrate(historySummary?.minimum["upload_bps"] ?? null, language)}
        </p>
      </div>
      <p className="text-xs leading-5 text-muted sm:col-span-2">
        {t("traffic.currentSessionHint", {
          duration: formatDuration(traffic?.current_connect_seconds ?? null, language),
        })}
      </p>
    </div>
  );
}

export function TrafficPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const { dashboard, loading, refreshing, error, refresh } = useLiveDashboard();
  const [range, setRange] = useState<HistoryRange>("15m");
  const connected = (dashboard?.connected ?? false) && (snapshot?.connected ?? dashboard?.connected ?? false);
  const history = useHistory(range, connected);
  const traffic = dashboard?.traffic.data ?? null;
  const trafficSection = dashboard?.traffic;

  if ((deviceLoading || loading) && !dashboard) {
    return <LoadingState />;
  }

  const timestamps = history.data?.points.map((point) => point.timestamp) ?? [];
  const speedSeries = [
    {
      id: "download",
      label: t("traffic.download"),
      color: "rgb(var(--c-download))",
      values: history.data?.points.map((point) => point.download_bps) ?? [],
    },
    {
      id: "upload",
      label: t("traffic.upload"),
      color: "rgb(var(--c-upload))",
      values: history.data?.points.map((point) => point.upload_bps) ?? [],
    },
  ];
  const volumeSeries = [
    {
      id: "download-bytes",
      label: t("traffic.download"),
      color: "rgb(var(--c-download))",
      values: history.data?.points.map((point) => point.download_bytes) ?? [],
    },
    {
      id: "upload-bytes",
      label: t("traffic.upload"),
      color: "rgb(var(--c-upload))",
      values: history.data?.points.map((point) => point.upload_bytes) ?? [],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<RefreshLiveButton onClick={() => void refresh()} refreshing={refreshing} />}
        subtitle={t("traffic.subtitle")}
        title={t("traffic.title")}
      />

      {!dashboard ? (
        <div className="space-y-4">
          {error ? <ErrorBanner error={error} /> : null}
          <p className="text-sm text-muted">{t("live.waiting")}</p>
        </div>
      ) : !connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <LiveNotice />
          {error ? <ErrorBanner error={error} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{t("live.sampledAt", { time: formatDateTime(dashboard.sampled_at, language, t("common.dash")) })}</span>
            <span>{t("traffic.todayObservedHint")}</span>
          </div>

          {trafficSection ? <SectionError section={trafficSection} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              accent="download"
              label={t("traffic.realtimeDownload")}
              value={formatBitrate(traffic?.download_bps ?? null, language)}
            />
            <MetricCard
              accent="upload"
              label={t("traffic.realtimeUpload")}
              value={formatBitrate(traffic?.upload_bps ?? null, language)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TrafficPairCard
              download={traffic?.session_download_bytes ?? null}
              hint={formatDuration(traffic?.current_connect_seconds ?? null, language)}
              label={t("traffic.session")}
              upload={traffic?.session_upload_bytes ?? null}
            />
            <TrafficPairCard
              download={traffic?.today_download_bytes ?? null}
              hint={t("traffic.todayObservedHint")}
              label={t("traffic.today")}
              upload={traffic?.today_upload_bytes ?? null}
            />
            <TrafficPairCard
              download={traffic?.month_download_bytes ?? null}
              label={t("traffic.month")}
              upload={traffic?.month_upload_bytes ?? null}
            />
            <TrafficPairCard
              download={traffic?.total_download_bytes ?? null}
              label={t("traffic.total")}
              upload={traffic?.total_upload_bytes ?? null}
            />
          </div>

          <section className="card p-5" aria-labelledby="traffic-history">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base" id="traffic-history">
                  <Icon name="traffic" size={18} />
                  {t("traffic.historyTitle")}
                </h2>
                <p className="mt-1 text-sm text-muted">{t("traffic.historyBody")}</p>
              </div>
              <RangeSelector onChange={setRange} value={range} />
            </div>

            <div className="mt-4 space-y-5">
              {history.error ? <ErrorBanner error={history.error} /> : null}
              {history.loading && !history.data ? (
                <p className="rounded-control border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                  {t("common.loading")}
                </p>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-ink">{t("traffic.speedChart")}</h3>
                    <div className="mt-2">
                      <LineChart
                        ariaLabel={t("traffic.speedChartAria")}
                        emptyLabel={t("history.empty")}
                        includeZero
                        range={range}
                        series={speedSeries}
                        timestamps={timestamps}
                        valueFormatter={formatBitrate}
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-ink">{t("traffic.volumeChart")}</h3>
                    <div className="mt-2">
                      <LineChart
                        ariaLabel={t("traffic.volumeChartAria")}
                        emptyLabel={t("history.empty")}
                        includeZero
                        range={range}
                        series={volumeSeries}
                        timestamps={timestamps}
                        valueFormatter={formatBytes}
                      />
                    </div>
                  </div>
                </>
              )}
              <TrafficSummary historySummary={history.data?.summary ?? null} traffic={traffic} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
