import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { CapabilityResult } from "@/api/types";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

type Filter = "all" | "available" | "experimental" | "issues";

const issueStatuses = new Set(["unavailable", "no_permission", "unsupported", "probe_failed"]);

export function CapabilityList({ capabilities }: { capabilities: CapabilityResult[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return capabilities.filter((item) => {
      if (filter === "available" && item.status !== "available") return false;
      if (filter === "experimental" && item.status !== "experimental") return false;
      if (filter === "issues" && !issueStatuses.has(item.status)) return false;
      if (!needle) return true;
      return [item.id, t(`capability.name.${item.id}` as TranslationKey)].some((value) => value.toLowerCase().includes(needle));
    });
  }, [capabilities, filter, query, t]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs onValueChange={(value) => setFilter(value as Filter)} value={filter}>
          <TabsList>
            <TabsTrigger value="all">{t("device.filter.all")}</TabsTrigger>
            <TabsTrigger value="available">{t("device.filter.available")}</TabsTrigger>
            <TabsTrigger value="experimental">{t("device.filter.experimental")}</TabsTrigger>
            <TabsTrigger value="issues">{t("device.filter.issues")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("device.filterLabel")}
            className="h-8 pl-8 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("device.filterLabel")}
            value={query}
          />
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto rounded-md border border-border">
      <Table className="min-w-full md:min-w-[680px]">
        <TableHeader>
          <TableRow>
            <TableHead>{t("device.table.feature")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("device.table.reason")}</TableHead>
            <TableHead className="hidden text-right md:table-cell">{t("device.table.latency")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell className="py-8 text-center text-xs text-muted-foreground" colSpan={4}>{t("device.noMatch")}</TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{t(`capability.name.${item.id}` as TranslationKey)}</span>
                    <Badge variant="outline">{t(item.access === "write" ? "capability.access.write" : "capability.access.read")}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.id}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground md:hidden">
                    {t(`capability.reason.${item.reason}` as TranslationKey)}
                  </p>
                </TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
                <TableCell className="hidden md:table-cell">
                  <p className="text-[11px] text-muted-foreground">{t(`capability.reason.${item.reason}` as TranslationKey)}</p>
                  {item.detail ? <p className="mt-0.5 max-w-md truncate font-mono text-[10px] text-muted-foreground" title={item.detail}>{item.detail}</p> : null}
                </TableCell>
                <TableCell className="tabular hidden text-right text-[11px] text-muted-foreground md:table-cell">
                  {item.duration_ms === null || item.duration_ms === undefined ? "—" : `${item.duration_ms} ms`}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
