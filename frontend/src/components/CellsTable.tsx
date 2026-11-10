import type { CellEntry } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { formatMhz } from "../lib/format";
import { Icon } from "./Icon";

export function CellsTable({ cells }: { cells: CellEntry[] }) {
  const { t, language } = useI18n();
  if (cells.length === 0) {
    return <p className="rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{t("cells.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{t("cells.title")}</caption>
        <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("cells.radio")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("signal.band")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("signal.pci")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("signal.cellId")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("signal.arfcn")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("signal.dlBandwidth")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("signal.ulBandwidth")}</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell, index) => (
            <tr className="border-t border-line align-middle" key={`${cell.radio}-${cell.cell_id}-${index}`}>
              <td className="px-3 py-3">
                <span className="chip border-line bg-elevated text-muted">
                  <Icon name="signal" size={12} />
                  {t(cell.radio === "lte" ? "signal.lte" : "signal.nr")}
                </span>
              </td>
              <td className="px-3 py-3 text-sm">{cell.band ?? t("common.dash")}</td>
              <td className="tabular px-3 py-3 text-sm">{cell.pci ?? t("common.dash")}</td>
              <td className="tabular px-3 py-3 font-mono text-xs">{cell.cell_id ?? t("common.dash")}</td>
              <td className="tabular px-3 py-3 text-sm">{cell.arfcn ?? t("common.dash")}</td>
              <td className="tabular px-3 py-3 text-sm">{formatMhz(cell.dl_bandwidth_mhz, language)}</td>
              <td className="tabular px-3 py-3 text-sm">{formatMhz(cell.ul_bandwidth_mhz, language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
