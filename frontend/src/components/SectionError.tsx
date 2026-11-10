import type { LiveSection } from "../api/types";
import { errorInfoToUi } from "../hooks/useDevice";
import { useI18n } from "../i18n/I18nProvider";
import { formatDateTime } from "../lib/format";
import { Icon } from "./Icon";

export function SectionError({ section }: { section: LiveSection<unknown> }) {
  const { t, language } = useI18n();
  if (!section.error) {
    return null;
  }
  const error = errorInfoToUi(section.error);
  return (
    <div
      className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-ink"
      role="alert"
    >
      <Icon className="mt-0.5 shrink-0 text-warning" name="alert" size={15} />
      <div className="min-w-0">
        <p>{t(error.messageKey)}</p>
        {section.stale && section.updated_at ? (
          <p className="text-muted">
            {t("live.showingDataFrom", {
              time: formatDateTime(section.updated_at, language, t("common.dash")),
            })}
          </p>
        ) : null}
        {error.detail ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-muted hover:text-ink">{t("error.detailLabel")}</summary>
            <code className="mt-1 block break-all font-mono text-[11px] text-muted">{error.detail}</code>
          </details>
        ) : null}
      </div>
    </div>
  );
}
