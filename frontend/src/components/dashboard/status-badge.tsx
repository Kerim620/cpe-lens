import type { CapabilityStatus, SignalQuality } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { CircleAlert, CheckCircle2, Clock3, FlaskConical, LockKeyhole, MinusCircle } from "lucide-react";

const statusMeta: Record<CapabilityStatus, { icon: typeof CheckCircle2; variant: "success" | "warning" | "outline" | "destructive" }> = {
  available: { icon: CheckCircle2, variant: "success" },
  experimental: { icon: FlaskConical, variant: "warning" },
  unavailable: { icon: Clock3, variant: "outline" },
  no_permission: { icon: LockKeyhole, variant: "warning" },
  unsupported: { icon: MinusCircle, variant: "outline" },
  probe_failed: { icon: CircleAlert, variant: "destructive" },
};

export function StatusBadge({ status }: { status: CapabilityStatus }) {
  const { t } = useI18n();
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant}>
      <Icon className="size-3" />
      {t(`capability.status.${status}` as TranslationKey)}
    </Badge>
  );
}

const qualityVariant: Record<SignalQuality, "success" | "warning" | "destructive"> = {
  excellent: "success",
  good: "success",
  fair: "warning",
  poor: "destructive",
};

export function QualityBadge({ quality }: { quality: SignalQuality | null }) {
  const { t } = useI18n();
  if (!quality) return null;
  return (
    <Badge variant={qualityVariant[quality]}>
      {t(`signal.quality.${quality}` as TranslationKey)}
    </Badge>
  );
}
