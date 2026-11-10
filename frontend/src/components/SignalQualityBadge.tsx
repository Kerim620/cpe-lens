import type { SignalQuality } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";

const styles: Record<SignalQuality, string> = {
  excellent: "border-success/30 bg-success/10 text-success",
  good: "border-success/25 bg-success/5 text-success",
  fair: "border-warning/40 bg-warning/10 text-warning",
  poor: "border-danger/40 bg-danger/10 text-danger",
};

export function SignalQualityBadge({ quality }: { quality: SignalQuality | null }) {
  const { t } = useI18n();
  if (!quality) {
    return null;
  }
  return <span className={`chip ${styles[quality]}`}>{t(`signal.quality.${quality}` as TranslationKey)}</span>;
}
