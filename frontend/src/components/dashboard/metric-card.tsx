import type { ReactNode } from "react";

import { Sparkline } from "@/components/charts/chart";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  unit,
  hint,
  icon,
  trend,
  color = "var(--primary)",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: Array<number | null>;
  color?: string;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="tabular mt-2 flex items-baseline gap-1 text-2xl font-semibold leading-8 text-foreground">
        {value}
        {unit ? <span className="text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <div className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{hint}</div> : null}
      {trend && trend.some((item) => item !== null) ? (
        <div className="mt-2">
          <Sparkline color={color} values={trend} />
        </div>
      ) : null}
    </Card>
  );
}
