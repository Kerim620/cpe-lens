import { Link } from "react-router-dom";

import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";
import { Notice } from "./Notice";

export function DisconnectedPanel() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <Notice icon="plug" variant="info">
        <p className="font-medium">{t("live.disconnectedTitle")}</p>
        <p className="mt-0.5 text-muted">{t("live.disconnectedBody")}</p>
      </Notice>
      <Link className="btn btn-primary" to="/">
        <Icon name="plug" size={16} />
        {t("live.openOverview")}
      </Link>
    </div>
  );
}
