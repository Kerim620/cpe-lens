import { CircleAlert, X } from "lucide-react";

import type { UiError } from "@/hooks/useDevice";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorBanner({
  error,
  title,
  onDismiss,
  className,
}: {
  error: UiError;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5", className)} role="alert">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title ?? t(error.messageKey)}</p>
        {error.retryable ? <p className="mt-0.5 text-muted-foreground">{t("error.retryable")}</p> : null}
        {error.detail ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("error.detailLabel")}</summary>
            <code className="mt-1 block break-all font-mono text-[11px] text-muted-foreground">{error.detail}</code>
          </details>
        ) : null}
      </div>
      {onDismiss ? (
        <Button aria-label={t("common.close")} onClick={onDismiss} size="icon-sm" variant="ghost">
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
