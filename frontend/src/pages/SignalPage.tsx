import { useState } from "react";

import type { HistoryPoint, HistoryRange } from "../api/types";
import { CellsTable } from "../components/CellsTable";
import { DisconnectedPanel } from "../components/DisconnectedPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { LiveNotice } from "../components/LiveNotice";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { RadioMetricsCard } from "../components/RadioMetricsCard";
import { RangeSelector } from "../components/RangeSelector";
import { RefreshLiveButton } from "../components/RefreshLiveButton";
import { SectionError } from "../components/SectionError";
import { useDevice } from "../hooks/useDevice";
import { useHistory } from "../hooks/useHistory";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { formatDb, formatDateTime } from "../lib/format";

type SignalMetric = "rsrp" | "rsrq" | "sinr";

const metricLabels: Record<SignalMetric, TranslationKey> = {
  rsrp: "signal.rsrp",
  rsrq: "signal.rsrq",
  sinr: "signal.sinr",
};

function pointValue(point: HistoryPoint, field: string): number | null {
  return (point as unknown as Record<string, number | null>)[field] ?? null;
}

function HistoryStats({
  summary,
  metric,
}: {
  summary: { current: Record<string, number | null>; average: Record<string, number | null>; minimum: Record<string, number | null>; maximum: Record<string, number | null> };
  metric: SignalMetric;
}) {
  const { t, language } = useI18n();
  const rows: Array<{ label: string; lte: number | null; nr: number | null }> = [
    { label: t("signal.average"), lte: summary.average[`lte_${metric}`] ?? null, nr: summary.average[`nr_${metric}`] ?? null },
    { label: t("signal.minimum"), lte: summary.minimum[`lte_${metric}`] ?? null, nr: summary.minimum[`nr_${metric}`] ?? null },
    { label: t("signal.maximum"), lte: summary.maximum[`lte_${metric}`] ?? null, nr: summary.maximum[`nr_${metric}`] ?? null },
    { label: t("signal.current"), lte: summary.current[`lte_${metric}`] ?? null, nr: summary.current[`nr_${metric}`] ?? null },
  ];
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full min-w-[320px] border-collapse text-left text-sm">
        <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">{t("signal.statistic")}</th>
            <th className="px-3 py-2 font-medium" scope="col">{t("signal.lte")}</th>
            <th className="px-3 py-2 font-medium" scope="col">{t("signal.nr")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-line" key={row.label}>
              <td className="px-3 py-2 text-xs text-muted">{row.label}</td>
              <td className="tabular px-3 py-2 text-sm">{formatDb(row.lte, language)}</td>
              <td className="tabular px-3 py-2 text-sm">{formatDb(row.nr, language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SignalPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const { dashboard, loading, refreshing, error, refresh } = useLiveDashboard();
  const [range, setRange] = useState<HistoryRange>("15m");
  const [metric, setMetric] = useState<SignalMetric>("rsrp");
  const connected = (dashboard?.connected ?? false) && (snapshot?.connected ?? dashboard?.connected ?? false);
  const history = useHistory(range, connected);

  if ((deviceLoading || loading) && !dashboard) {
    return <LoadingState />;
  }

  const signalSection = dashboard?.signal;
  const cellsSection = dashboard?.cells;
  const signal = signalSection?.data;
  const cells = cellsSection?.data;
  const timestamps = history.data?.points.map((point) => point.timestamp) ?? [];
  const series = [
    {
      id: "lte",
      label: t("signal.lte"),
      color: "rgb(var(--c-lte))",
      values: history.data?.points.map((point) => pointValue(point, `lte_${metric}`)) ?? [],
    },
    {
      id: "nr",
      label: t("signal.nr"),
      color: "rgb(var(--c-nr))",
      values: history.data?.points.map((point) => pointValue(point, `nr_${metric}`)) ?? [],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<RefreshLiveButton onClick={() => void refresh()} refreshing={refreshing} />}
        subtitle={t("signal.subtitle")}
        title={t("signal.title")}
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
            <span>
              {t("live.sampledAt", {
                time: formatDateTime(dashboard.sampled_at, language, t("common.dash")),
              })}
            </span>
            <span>{snapshot?.device?.model ?? t("common.dash")}</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {signal?.lte ? <RadioMetricsCard metrics={signal.lte} radio="lte" /> : null}
            {signal?.nr ? <RadioMetricsCard metrics={signal.nr} radio="nr" /> : null}
            {signalSection ? (
              <div className="lg:col-span-2">
                <SectionError section={signalSection} />
              </div>
            ) : null}
            {!signal?.lte && !signal?.nr ? (
              <p className="card px-4 py-8 text-center text-sm text-muted lg:col-span-2">{t("signal.noData")}</p>
            ) : null}
          </div>

          <section className="card p-5" aria-labelledby="signal-history">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base" id="signal-history">
                  <Icon name="signal" size={18} />
                  {t("signal.historyTitle")}
                </h2>
                <p className="mt-1 text-sm text-muted">{t("signal.historyBody")}</p>
              </div>
              <RangeSelector onChange={setRange} value={range} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("signal.metric")}>
              {(Object.keys(metricLabels) as SignalMetric[]).map((item) => (
                <button
                  aria-pressed={metric === item}
                  className={`chip min-h-8 px-2.5 ${
                    metric === item
                      ? "border-brand bg-brand-soft text-brand-strong"
                      : "border-line bg-card text-muted hover:bg-elevated hover:text-ink"
                  }`}
                  key={item}
                  onClick={() => setMetric(item)}
                  type="button"
                >
                  {t(metricLabels[item])}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {history.error ? <ErrorBanner error={history.error} /> : null}
              {history.loading && !history.data ? (
                <p className="rounded-control border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                  {t("common.loading")}
                </p>
              ) : (
                <LineChart
                  ariaLabel={t("signal.chartAria", { metric: t(metricLabels[metric]) })}
                  emptyLabel={t("history.empty")}
                  range={range}
                  series={series}
                  timestamps={timestamps}
                  valueFormatter={formatDb}
                />
              )}
              {history.data ? <HistoryStats metric={metric} summary={history.data.summary} /> : null}
            </div>
          </section>

          <section className="card p-5" aria-labelledby="signal-cells">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base" id="signal-cells">
                <Icon name="network" size={18} />
                {t("cells.title")}
              </h2>
              <span className="chip border-line bg-elevated text-muted">
                {t("cells.count", { count: cells?.cells.length ?? 0 })}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {cellsSection ? <SectionError section={cellsSection} /> : null}
              <CellsTable cells={cells?.cells ?? []} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
