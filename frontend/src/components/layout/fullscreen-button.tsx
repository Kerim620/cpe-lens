import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useI18n } from "@/i18n/I18nProvider";

export function FullscreenButton({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { monitoring, toggle } = useFullscreen();
  const label = monitoring ? t("fullscreen.exit") : t("fullscreen.enter");
  const Icon = monitoring ? Minimize2 : Maximize2;
  if (compact) {
    return (
      <Button aria-label={label} onClick={toggle} size="icon-sm" variant="ghost">
        <Icon className="size-4" />
      </Button>
    );
  }
  return (
    <Button aria-label={label} onClick={toggle} size="sm" variant="ghost">
      <Icon className="size-4" />
      <span className="hidden xl:inline">{label}</span>
    </Button>
  );
}
