import type { ReactNode } from "react";

export function InfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
