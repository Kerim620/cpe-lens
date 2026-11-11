import type { CellEntry } from "@/api/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nProvider";
import { formatMhz } from "@/lib/format";

export function CellsTable({ cells }: { cells: CellEntry[] }) {
  const { t, language } = useI18n();
  return (
    <Table className="min-w-[620px]">
      <TableHeader>
        <TableRow>
          <TableHead>{t("cells.radio")}</TableHead>
          <TableHead>{t("signal.band")}</TableHead>
          <TableHead>{t("signal.pci")}</TableHead>
          <TableHead>{t("signal.cellId")}</TableHead>
          <TableHead>{t("signal.arfcn")}</TableHead>
          <TableHead>{t("signal.dlBandwidth")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cells.map((cell, index) => (
          <TableRow key={`${cell.radio}-${cell.cell_id}-${index}`}>
            <TableCell className="text-xs font-medium uppercase text-foreground">{cell.radio}</TableCell>
            <TableCell className="tabular text-xs">{cell.band ?? t("common.dash")}</TableCell>
            <TableCell className="tabular text-xs">{cell.pci ?? t("common.dash")}</TableCell>
            <TableCell className="font-mono text-[11px]">{cell.cell_id ?? t("common.dash")}</TableCell>
            <TableCell className="tabular text-xs">{cell.arfcn ?? t("common.dash")}</TableCell>
            <TableCell className="tabular text-xs">{formatMhz(cell.dl_bandwidth_mhz, language)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
