import type { ReactNode } from "react";

import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type Variant = "info" | "warning" | "danger" | "success";

const styles: Record<Variant, string> = {
  info: "border-brand/30 bg-brand-soft/70 text-ink",
  warning: "border-warning/40 bg-warning/10 text-ink",
  danger: "border-danger/40 bg-danger/10 text-ink",
  success: "border-success/30 bg-success/10 text-ink",
};

const icons: Record<Variant, IconName> = {
  info: "info",
  warning: "alert",
  danger: "xcircle",
  success: "check",
};

interface NoticeProps {
  variant?: Variant;
  children: ReactNode;
  icon?: IconName;
}

export function Notice({ variant = "info", children, icon }: NoticeProps) {
  return (
    <div className={`flex items-start gap-3 rounded-control border px-3.5 py-3 text-sm leading-6 ${styles[variant]}`}>
      <Icon className="mt-0.5 shrink-0" name={icon ?? icons[variant]} size={18} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
