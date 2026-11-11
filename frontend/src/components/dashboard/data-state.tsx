import type { ReactNode } from "react";
import { CircleAlert, Clock3, Inbox, Info } from "lucide-react";

import type { LiveSection } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorInfoToUi } from "@/hooks/useDevice";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

export function LoadingState({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div aria-label={t("common.loading")} className="space-y-3" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton className={index === 0 ? "h-8 w-40" : "h-20 w-full"} key={index} />
      ))}
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}


export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
      <span className="mb-3 text-muted-foreground">{icon ?? <Inbox className="size-6" />}</span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionError({ section, onRetry }: { section: LiveSection<unknown>; onRetry?: () => void }) {
  const { t, language } = useI18n();
  if (!section.error && !section.stale) return null;
  if (!section.error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <Clock3 className="size-3.5" />
        {t("live.showingDataFrom", { time: formatDateTime(section.updated_at, language, t("common.dash")) })}
      </div>
    );
  }
  const error = errorInfoToUi(section.error);
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-5">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-foreground">{t(error.messageKey)}</p>
        {section.stale && section.updated_at ? (
          <p className="text-muted-foreground">
            {t("live.showingDataFrom", { time: formatDateTime(section.updated_at, language, t("common.dash")) })}
          </p>
        ) : null}
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("error.detailLabel")}</summary>
          <code className="mt-1 block break-all font-mono text-[11px] text-muted-foreground">{error.detail ?? error.code}</code>
        </details>
      </div>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="ghost">
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}


export function DataNotice({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
      {icon ?? <Info className="mt-0.5 size-3.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}
