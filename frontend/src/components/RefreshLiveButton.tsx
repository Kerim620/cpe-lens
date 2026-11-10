import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

export function RefreshLiveButton({ refreshing, onClick }: { refreshing: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button className="btn" disabled={refreshing} onClick={onClick} type="button">
      <Icon className={refreshing ? "animate-spin" : ""} name="refresh" size={16} />
      {refreshing ? t("live.refreshing") : t("live.refresh")}
    </button>
  );
}
