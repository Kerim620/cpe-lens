import type { RadioMetrics } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { formatSignalNumber } from "../lib/format";
import { Icon } from "./Icon";
import { SignalQualityBadge } from "./SignalQualityBadge";

function Value({ children, unit }: { children: string | number | null; unit?: string }) {
  const { t } = useI18n();
  if (children === null || children === "") {
    return <span className="text-muted">{t("common.dash")}</span>;
  }
  return (
    <span className="tabular text-sm text-ink">
      {children}
      {unit ? <span className="ml-0.5 text-xs text-muted">{unit}</span> : null}
    </span>
  );
}

export function RadioMetricsCard({ radio, metrics }: { radio: "lte" | "nr"; metrics: RadioMetrics }) {
  const { t, language } = useI18n();
  const color = radio === "lte" ? "rgb(var(--c-lte))" : "rgb(var(--c-nr))";
  const formatted = (value: number | null): string | null =>
    value === null ? null : formatSignalNumber(value, language);
  const rows: Array<{ label: string; value: string | number | null; unit?: string }> = [
    { label: t("signal.rsrp"), value: formatted(metrics.rsrp_dbm), unit: t("unit.dbm") },
    { label: t("signal.rsrq"), value: formatted(metrics.rsrq_db), unit: t("unit.db") },
    { label: t("signal.rssi"), value: formatted(metrics.rssi_dbm), unit: t("unit.dbm") },
    { label: t("signal.sinr"), value: formatted(metrics.sinr_db), unit: t("unit.db") },
    { label: t("signal.band"), value: metrics.band },
    { label: t("signal.pci"), value: metrics.pci },
    { label: t("signal.cellId"), value: metrics.cell_id },
    { label: t("signal.arfcn"), value: metrics.arfcn },
    { label: t("signal.dlBandwidth"), value: formatted(metrics.dl_bandwidth_mhz), unit: t("unit.mhz") },
    { label: t("signal.ulBandwidth"), value: formatted(metrics.ul_bandwidth_mhz), unit: t("unit.mhz") },
    { label: t("signal.cqi"), value: metrics.cqi },
    { label: t("signal.mcs"), value: metrics.mcs },
    { label: t("signal.txPower"), value: formatted(metrics.tx_power_dbm), unit: t("unit.dbm") },
    { label: t("signal.rank"), value: metrics.rank },
  ];

  return (
    <section className="card p-5" aria-labelledby={`radio-${radio}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base" id={`radio-${radio}`}>
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <Icon name="signal" size={17} />
          {t(radio === "lte" ? "signal.lte" : "signal.nr")}
        </h2>
        <SignalQualityBadge quality={metrics.quality} />
      </div>
      <dl className="mt-3 grid gap-x-5 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0"
            key={row.label}
          >
            <dt className="text-xs text-muted">{row.label}</dt>
            <dd>
              <Value unit={row.unit}>{row.value}</Value>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
