import { useState } from "react";
import { Link } from "react-router-dom";

import type { HistoryRange, RadioMetrics } from "@/api/types";
import { Chart } from "@/components/charts/chart";
import { CellsTable } from "@/components/dashboard/cells-table";
import { LoadingState, SectionError } from "@/components/dashboard/data-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { SectionCard } from "@/components/dashboard/section-card";
import { QualityBadge } from "@/components/dashboard/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDevice } from "@/hooks/useDevice";
import { useHistory } from "@/hooks/useHistory";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { formatChartTime, formatDb, formatMhz, formatSignalNumber } from "@/lib/format";

type SignalMetric = "rsrp" | "rsrq" | "sinr";
const metricKeys: Record<SignalMetric, TranslationKey> = { rsrp: "signal.rsrp", rsrq: "signal.rsrq", sinr: "signal.sinr" };

function RadioDetail({ radio, metrics }: { radio: "lte" | "nr"; metrics: RadioMetrics }) {
  const { t, language } = useI18n();
  const rows: Array<[string, string]> = [
    [t("signal.rsrp"), `${formatSignalNumber(metrics.rsrp_dbm, language)} dBm`],
    [t("signal.rsrq"), `${formatSignalNumber(metrics.rsrq_db, language)} dB`],
    [t("signal.rssi"), `${formatSignalNumber(metrics.rssi_dbm, language)} dBm`],
    [t("signal.sinr"), `${formatSignalNumber(metrics.sinr_db, language)} dB`],
    [t("signal.band"), metrics.band ?? t("common.dash")],
    [t("signal.pci"), String(metrics.pci ?? t("common.dash"))],
    [t("signal.cellId"), metrics.cell_id ?? t("common.dash")],
    [t("signal.arfcn"), String(metrics.arfcn ?? t("common.dash"))],
    [t("signal.dlBandwidth"), formatMhz(metrics.dl_bandwidth_mhz, language)],
    [t("signal.ulBandwidth"), formatMhz(metrics.ul_bandwidth_mhz, language)],
    [t("signal.cqi"), String(metrics.cqi ?? t("common.dash"))],
    [t("signal.mcs"), String(metrics.mcs ?? t("common.dash"))],
    [t("signal.txPower"), `${formatSignalNumber(metrics.tx_power_dbm, language)} dBm`],
    [t("signal.rank"), String(metrics.rank ?? t("common.dash"))],
  ];
  return (
    <SectionCard
      actions={<QualityBadge quality={metrics.quality} />}
      title={
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: radio === "lte" ? "var(--chart-lte)" : "var(--chart-nr)" }} />
          {t(radio === "lte" ? "signal.lte" : "signal.nr")}
        </span>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0" key={label}>
            <dt className="text-[10px] text-muted-foreground">{label}</dt>
            <dd className="tabular truncate text-[11px] text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

function HistoryStats({ summary, metric }: { summary: { current: Record<string, number | null>; average: Record<string, number | null>; minimum: Record<string, number | null>; maximum: Record<string, number | null> }; metric: SignalMetric }) {
  const { t, language } = useI18n();
  const rows = [
    ["signal.average", summary.average],
    ["signal.minimum", summary.minimum],
    ["signal.maximum", summary.maximum],
    ["signal.current", summary.current],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
      {rows.map(([label, values]) => (
        <div className="rounded-md border border-border px-2.5 py-2" key={label}>
          <dt className="text-[10px] text-muted-foreground">{t(label)}</dt>
          <dd className="tabular mt-0.5 text-[11px] text-foreground">
            {t("signal.lte")} {formatDb(values[`lte_${metric}`] ?? null, language)}
            <span className="mx-1 text-border">|</span>
            {t("signal.nr")} {formatDb(values[`nr_${metric}`] ?? null, language)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SignalPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const { dashboard, loading: liveLoading, error } = useLiveDashboard();
  const connected = snapshot?.connected ?? false;
  const [range, setRange] = useState<HistoryRange>("15m");
  const [metric, setMetric] = useState<SignalMetric>("rsrp");
  const history = useHistory(range, connected);
  const signal = dashboard?.signal.data ?? null;
  const cells = dashboard?.cells.data?.cells ?? [];
  const points = history.data?.points ?? [];

  if (deviceLoading || (liveLoading && !dashboard)) {
    return <LoadingState rows={4} />;
  }

  if (!connected) {
    return (
      <div className="space-y-5">
        <PageHeader description={t("signal.subtitle")} title={t("signal.title")} />
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("live.disconnectedTitle")} · <Link className="text-primary underline-offset-4 hover:underline" to="/">{t("live.openOverview")}</Link>
        </p>
      </div>
    );
  }

  const chartData = points.map((point) => ({
    label: formatChartTime(point.timestamp, language, range),
    lte: point[`lte_${metric}`],
    nr: point[`nr_${metric}`],
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        description={t("signal.subtitle")}
        title={t("signal.title")}
      />
      {error ? <ErrorBanner error={error} /> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          color="var(--chart-lte)"
          hint={t("signal.lte")}
          label={t("signal.rsrp")}
          trend={points.map((point) => point.lte_rsrp)}
          value={formatSignalNumber(signal?.lte?.rsrp_dbm ?? null, language)}
          unit="dBm"
        />
        <MetricCard
          color="var(--chart-lte)"
          hint={t("signal.lte")}
          label={t("signal.sinr")}
          trend={points.map((point) => point.lte_sinr)}
          value={formatSignalNumber(signal?.lte?.sinr_db ?? null, language)}
          unit="dB"
        />
        <MetricCard
          color="var(--chart-nr)"
          hint={t("signal.nr")}
          label={t("signal.rsrp")}
          trend={points.map((point) => point.nr_rsrp)}
          value={formatSignalNumber(signal?.nr?.rsrp_dbm ?? null, language)}
          unit="dBm"
        />
        <MetricCard
          color="var(--chart-nr)"
          hint={t("signal.nr")}
          label={t("signal.sinr")}
          trend={points.map((point) => point.nr_sinr)}
          value={formatSignalNumber(signal?.nr?.sinr_db ?? null, language)}
          unit="dB"
        />
      </div>

      <SectionCard
        actions={<RangeTabs onChange={setRange} value={range} />}
        description={t("signal.historyBody")}
        title={t("signal.historyTitle")}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Tabs onValueChange={(value) => setMetric(value as SignalMetric)} value={metric}>
            <TabsList>
              {(Object.keys(metricKeys) as SignalMetric[]).map((key) => (
                <TabsTrigger key={key} value={key}>{t(metricKeys[key])}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <Chart
          ariaLabel={t("signal.chartAria", { metric: t(metricKeys[metric]) })}
          data={chartData}
          emptyLabel={t("history.empty")}
          height={300}
          series={[
            { key: "lte", label: t("signal.lte"), color: "var(--chart-lte)" },
            { key: "nr", label: t("signal.nr"), color: "var(--chart-nr)" },
          ]}
          valueFormatter={(value) => formatDb(value, language)}
          variant="line"
        />
        {history.data ? <div className="mt-4"><HistoryStats metric={metric} summary={history.data.summary} /></div> : null}
        {history.error ? <div className="mt-3"><ErrorBanner error={history.error} /></div> : null}
        {dashboard?.signal ? <div className="mt-3"><SectionError section={dashboard.signal} /></div> : null}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {signal?.lte ? <RadioDetail metrics={signal.lte} radio="lte" /> : null}
        {signal?.nr ? <RadioDetail metrics={signal.nr} radio="nr" /> : null}
      </div>

      <SectionCard title={t("cells.title")}>
        {cells.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("cells.empty")}</p>
        ) : (
          <CellsTable cells={cells} />
        )}
        {dashboard?.cells ? <div className="mt-3"><SectionError section={dashboard.cells} /></div> : null}
      </SectionCard>
      <p className="text-[10px] text-muted-foreground">{t("live.runtimeNotice")}</p>
    </div>
  );
}
