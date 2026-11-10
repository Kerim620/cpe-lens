import { useI18n } from "../i18n/I18nProvider";
import { Notice } from "./Notice";

export function LiveNotice() {
  const { t } = useI18n();
  return (
    <Notice icon="info" variant="info">
      {t("live.runtimeNotice")}
    </Notice>
  );
}
