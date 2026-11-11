import type { HistoryRange } from "@/api/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

const ranges: HistoryRange[] = ["15m", "1h", "6h", "24h", "7d"];

export function RangeTabs({ value, onChange }: { value: HistoryRange; onChange: (value: HistoryRange) => void }) {
  const { t } = useI18n();
  return (
    <Tabs onValueChange={(next) => onChange(next as HistoryRange)} value={value}>
      <TabsList aria-label={t("history.range")}>
        {ranges.map((range) => (
          <TabsTrigger key={range} value={range}>
            {t(`history.range.${range}` as TranslationKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
