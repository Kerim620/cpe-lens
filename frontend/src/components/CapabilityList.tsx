import { useMemo, useState } from "react";

import type { CapabilityCategory, CapabilityResult, CapabilityStatus } from "../api/types";
import { CAPABILITY_CATEGORIES } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { Language } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { formatDateTime } from "../lib/format";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

type Filter = "all" | "available" | "experimental" | "issues";

const issueStatuses: CapabilityStatus[] = ["unavailable", "no_permission", "unsupported", "probe_failed"];

const summaryStyles = {
  available: "border-success/30 bg-success/10 text-success",
  experimental: "border-warning/40 bg-warning/10 text-warning",
  issues: "border-danger/30 bg-danger/10 text-danger",
} as const;

function matchesFilter(capability: CapabilityResult, filter: Filter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "issues") {
    return issueStatuses.includes(capability.status);
  }
  return capability.status === filter;
}

function categoryKey(category: CapabilityCategory): TranslationKey {
  return `capability.group.${category}` as TranslationKey;
}

function capabilityNameKey(id: string): TranslationKey {
  return `capability.name.${id}` as TranslationKey;
}

function statusKey(status: CapabilityStatus): TranslationKey {
  return `capability.status.${status}` as TranslationKey;
}

export function CapabilityList({ capabilities }: { capabilities: CapabilityResult[] }) {
  const { t, language } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    return {
      available: capabilities.filter((capability) => capability.status === "available").length,
      experimental: capabilities.filter((capability) => capability.status === "experimental").length,
      issues: capabilities.filter((capability) => issueStatuses.includes(capability.status)).length,
    };
  }, [capabilities]);

  const filtered = useMemo(
    () => capabilities.filter((capability) => matchesFilter(capability, filter)),
    [capabilities, filter],
  );

  const grouped = useMemo(
    () =>
      CAPABILITY_CATEGORIES.map((category) => ({
        category,
        items: filtered.filter((capability) => capability.category === category),
      })).filter((group) => group.items.length > 0),
    [filtered],
  );

  const filterOptions: Array<{ value: Filter; label: string }> = [
    { value: "all", label: t("device.filter.all") },
    { value: "available", label: t("device.filter.available") },
    { value: "experimental", label: t("device.filter.experimental") },
    { value: "issues", label: t("device.filter.issues") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(["available", "experimental", "issues"] as const).map((key) => (
          <div className={`rounded-control border px-3.5 py-3 ${summaryStyles[key]}`} key={key}>
            <p className="text-xs font-medium">
              {key === "issues" ? t("device.filter.issues") : t(statusKey(key))}
            </p>
            <p className="tabular mt-1 text-2xl font-semibold">{counts[key]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">{t("device.filterLabel")}</span>
        {filterOptions.map((option) => (
          <button
            aria-pressed={filter === option.value}
            className={`chip transition-colors ${
              filter === option.value
                ? "border-brand bg-brand-soft text-brand-strong"
                : "border-line bg-card text-muted hover:bg-elevated hover:text-ink"
            }`}
            key={option.value}
            onClick={() => setFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          {t("device.noMatch")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-control border border-line">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <caption className="sr-only">{t("device.capabilities")}</caption>
            <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  {t("device.table.feature")}
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  {t("device.table.status")}
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  {t("device.table.reason")}
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  {t("device.table.latency")}
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  {t("device.table.checked")}
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <CategoryRows
                  category={group.category}
                  items={group.items}
                  key={group.category}
                  language={language}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryRows({
  category,
  items,
  language,
}: {
  category: CapabilityCategory;
  items: CapabilityResult[];
  language: Language;
}) {
  const { t } = useI18n();
  return (
    <>
      <tr className="border-t border-line bg-elevated/60">
        <th className="px-3 py-2 text-xs font-semibold text-ink" colSpan={5} scope="colgroup">
          {t(categoryKey(category))}
        </th>
      </tr>
      {items.map((capability) => (
        <tr className="border-t border-line align-top" key={capability.id}>
          <td className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{t(capabilityNameKey(capability.id))}</span>
              <span className="chip border-line bg-elevated text-[11px] text-muted">
                <Icon name={capability.access === "write" ? "lock" : "shield"} size={12} />
                {t(capability.access === "write" ? "capability.access.write" : "capability.access.read")}
              </span>
            </div>
            {capability.detail ? (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-xs text-muted hover:text-ink">{t("common.details")}</summary>
                <code className="mt-1 block break-all font-mono text-xs text-muted">{capability.detail}</code>
              </details>
            ) : null}
          </td>
          <td className="px-3 py-3">
            <StatusBadge status={capability.status} />
          </td>
          <td className="max-w-72 px-3 py-3 text-xs leading-5 text-muted">
            {t(`capability.reason.${capability.reason}` as TranslationKey)}
          </td>
          <td className="tabular px-3 py-3 text-xs text-muted">
            {capability.duration_ms === null ? t("common.dash") : t("capability.duration", { ms: capability.duration_ms })}
          </td>
          <td className="tabular px-3 py-3 text-xs text-muted">
            {formatDateTime(capability.checked_at, language, t("common.dash"))}
          </td>
        </tr>
      ))}
    </>
  );
}
