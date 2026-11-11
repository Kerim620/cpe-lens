import { Link } from "react-router-dom";
import { ArrowUpRight, Signal } from "lucide-react";

import type { SignalSnapshot } from "@/api/types";
import { QualityBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { formatSignalNumber } from "@/lib/format";

function RadioRow({ radio, metrics }: { radio: "lte" | "nr"; metrics: NonNullable<SignalSnapshot["lte"]> }) {
  const { t, language } = useI18n();
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: radio === "lte" ? "var(--chart-lte)" : "var(--chart-nr)" }} />
          {t(radio === "lte" ? "signal.lte" : "signal.nr")}
        </span>
        <QualityBadge quality={metrics.quality} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tabular text-xl font-semibold">{formatSignalNumber(metrics.rsrp_dbm, language)}</span>
        <span className="text-[10px] text-muted-foreground">dBm</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>SINR {formatSignalNumber(metrics.sinr_db, language)} dB</span>
        <span>RSRQ {formatSignalNumber(metrics.rsrq_db, language)} dB</span>
        <span>Band {metrics.band ?? t("common.dash")}</span>
        <span>PCI {metrics.pci ?? t("common.dash")}</span>
      </div>
    </div>
  );
}

export function RadioSummary({ signal }: { signal: SignalSnapshot | null }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Signal className="size-4 text-primary" />
          {t("overview.signalTitle")}
        </CardTitle>
        <Button asChild size="sm" variant="ghost">
          <Link to="/signal">
            {t("overview.details")}
            <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {signal?.lte ? <RadioRow metrics={signal.lte} radio="lte" /> : null}
        {signal?.nr ? <RadioRow metrics={signal.nr} radio="nr" /> : null}
        {!signal?.lte && !signal?.nr ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("signal.noData")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
