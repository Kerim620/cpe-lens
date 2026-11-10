import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  accent?: "default" | "download" | "upload";
}

export function MetricCard({ label, value, unit, hint, accent = "default" }: MetricCardProps) {
  const accentClass =
    accent === "download" ? "text-[rgb(var(--c-download))]" : accent === "upload" ? "text-[rgb(var(--c-upload))]" : "text-ink";
  return (
    <div className="rounded-control border border-line bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`tabular mt-1 text-xl font-semibold leading-7 ${accentClass}`}>
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}
