// Chart primitives adapted from Tremor Raw (Apache-2.0) and rebuilt on Recharts
// for this project's Tailwind theme tokens.
import { useId } from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

export type ChartVariant = "area" | "line" | "bar";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartProps {
  data: Array<Record<string, string | number | null>>;
  series: ChartSeries[];
  variant?: ChartVariant;
  xKey?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  showGrid?: boolean;
  showYAxis?: boolean;
  showLegend?: boolean;
  yAxisWidth?: number;
  emptyLabel: string;
  ariaLabel: string;
  className?: string;
}

function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map((item) => (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" key={item.key}>
          <span aria-hidden="true" className="h-1.5 w-4 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function Chart({
  data,
  series,
  variant = "area",
  xKey = "label",
  height = 280,
  valueFormatter = (value) => String(value),
  showGrid = true,
  showYAxis = true,
  showLegend = true,
  yAxisWidth = 52,
  emptyLabel,
  ariaLabel,
  className,
}: ChartProps) {
  const gradientPrefix = useId().replaceAll(":", "");
  const hasData = data.some((row) => series.some((item) => row[item.key] !== null && row[item.key] !== undefined));
  if (!hasData) {
    return (
      <figure aria-label={ariaLabel} className={cn("flex flex-col gap-3", className)} role="img">
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      </figure>
    );
  }

  const commonAxes = (
    <>
      {showGrid ? <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" vertical={false} /> : null}
      <XAxis
        axisLine={false}
        dataKey={xKey}
        minTickGap={36}
        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        tickLine={false}
      />
      {showYAxis ? (
        <YAxis
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => valueFormatter(value)}
          tickLine={false}
          width={yAxisWidth}
        />
      ) : null}
      <Tooltip
        contentStyle={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          color: "var(--card-foreground)",
          fontSize: "12px",
          boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
        }}
        cursor={{ fill: "var(--muted)", opacity: 0.45, stroke: "var(--chart-grid)" }}
        formatter={(value, name) => [
          value === null || value === undefined ? "—" : valueFormatter(Number(value)),
          series.find((item) => item.key === String(name))?.label ?? String(name),
        ]}
        labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px" }}
      />
    </>
  );

  const chart =
    variant === "bar" ? (
      <RechartsBarChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
        {commonAxes}
        {series.map((item) => (
          <Bar
            dataKey={item.key}
            fill={item.color}
            isAnimationActive={false}
            key={item.key}
            maxBarSize={26}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    ) : variant === "line" ? (
      <RechartsLineChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
        {commonAxes}
        {series.map((item) => (
          <Line
            activeDot={{ r: 3 }}
            connectNulls={false}
            dataKey={item.key}
            dot={false}
            isAnimationActive={false}
            key={item.key}
            stroke={item.color}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </RechartsLineChart>
    ) : (
      <RechartsAreaChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
        <defs>
          {series.map((item, index) => (
            <linearGradient id={`chart-fill-${gradientPrefix}-${index}`} key={item.key} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        {commonAxes}
        {series.map((item, index) => (
          <Area
            activeDot={{ r: 3 }}
            connectNulls={false}
            dataKey={item.key}
            fill={`url(#chart-fill-${gradientPrefix}-${index})`}
            isAnimationActive={false}
            key={item.key}
            stroke={item.color}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </RechartsAreaChart>
    );

  return (
    <figure aria-label={ariaLabel} className={cn("flex flex-col gap-3", className)} role="img">
      <div style={{ height }}>
        <ResponsiveContainer height="100%" width="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      {showLegend ? <ChartLegend series={series} /> : null}
    </figure>
  );
}

export function Sparkline({
  values,
  color,
  className,
}: {
  values: Array<number | null>;
  color: string;
  className?: string;
}) {
  const gradientId = `spark-${useId().replaceAll(":", "")}`;
  const data = values.map((value, index) => ({ index, value }));
  if (!values.some((value) => value !== null)) {
    return <div className={cn("h-10 rounded-sm bg-muted/50", className)} />;
  }
  return (
    <div className={cn("h-10", className)}>
      <ResponsiveContainer height="100%" width="100%">
        <RechartsAreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            connectNulls={false}
            dataKey="value"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            stroke={color}
            strokeWidth={1.5}
            type="monotone"
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
