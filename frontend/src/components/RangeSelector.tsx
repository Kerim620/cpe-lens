import type { HistoryRange } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";

const ranges: HistoryRange[] = ["15m", "1h", "6h", "24h", "7d"];

export function RangeSelector({
  value,
  onChange,
}: {
  value: HistoryRange;
  onChange: (range: HistoryRange) => void;
}) {
  const { t } = useI18n();
  return (
    <div aria-label={t("history.range")} className="flex flex-wrap items-center gap-1" role="group">
      {ranges.map((range) => (
        <button
          aria-pressed={range === value}
          className={`chip min-h-8 px-2.5 transition-colors ${
            range === value
              ? "border-brand bg-brand-soft text-brand-strong"
              : "border-line bg-card text-muted hover:bg-elevated hover:text-ink"
          }`}
          key={range}
          onClick={() => onChange(range)}
          type="button"
        >
          {t(`history.range.${range}` as TranslationKey)}
        </button>
      ))}
    </div>
  );
}
