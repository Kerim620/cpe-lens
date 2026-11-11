import { PlugZap } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

export function DisconnectedState() {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <PlugZap className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">{t("live.disconnectedTitle")}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{t("live.disconnectedBody")}</p>
      <Button asChild className="mt-4" size="sm">
        <Link to="/">{t("live.openOverview")}</Link>
      </Button>
    </Card>
  );
}
