import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

export function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
      <Icon className="animate-spin" name="refresh" size={18} />
      {t("common.loading")}
    </div>
  );
}
