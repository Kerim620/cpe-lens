import type { CapabilityStatus } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const presentation: Record<CapabilityStatus, { icon: IconName; className: string }> = {
  available: {
    icon: "check",
    className: "border-success/30 bg-success/10 text-success",
  },
  experimental: {
    icon: "flask",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  unavailable: {
    icon: "clock",
    className: "border-line bg-elevated text-muted",
  },
  no_permission: {
    icon: "lock",
    className: "border-warning/30 bg-warning/5 text-warning",
  },
  unsupported: {
    icon: "minus",
    className: "border-line bg-elevated text-neutral",
  },
  probe_failed: {
    icon: "alert",
    className: "border-danger/40 bg-danger/10 text-danger",
  },
};

export function StatusBadge({ status }: { status: CapabilityStatus }) {
  const { t } = useI18n();
  const config = presentation[status];
  return (
    <span className={`chip ${config.className}`}>
      <Icon name={config.icon} size={14} />
      <span>{t(`capability.status.${status}` as TranslationKey)}</span>
    </span>
  );
}
