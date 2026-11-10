import { useI18n } from "../i18n/I18nProvider";
import type { UiError } from "../hooks/useDevice";
import { Icon } from "./Icon";

interface ErrorBannerProps {
  error: UiError;
  onDismiss?: () => void;
  title?: string;
}

export function ErrorBanner({ error, onDismiss, title }: ErrorBannerProps) {
  const { t } = useI18n();
  return (
    <div
      className="flex items-start gap-3 rounded-control border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-ink"
      role="alert"
    >
      <Icon className="mt-0.5 shrink-0 text-danger" name="alert" size={18} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title ?? t(error.messageKey)}</p>
        {error.retryable ? <p className="mt-0.5 text-xs text-muted">{t("error.retryable")}</p> : null}
        {error.detail ? (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs text-muted hover:text-ink">{t("error.detailLabel")}</summary>
            <code className="mt-1 block break-all font-mono text-xs text-muted">{error.detail}</code>
          </details>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          aria-label={t("common.close")}
          className="rounded p-1 text-muted hover:bg-elevated hover:text-ink"
          onClick={onDismiss}
          type="button"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}
