import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import type { HistoryRange } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { Language } from "../i18n/I18nProvider";
import { computeAxisScale, chartTickIndices } from "../lib/chart";
import { formatChartTime } from "../lib/format";

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  values: Array<number | null>;
}

interface LineChartProps {
  series: ChartSeries[];
  timestamps: string[];
  range: HistoryRange;
  valueFormatter: (value: number, language: Language) => string;
  emptyLabel: string;
  ariaLabel: string;
  includeZero?: boolean;
}

const WIDTH = 920;
const HEIGHT = 300;
const LEFT = 74;
const RIGHT = 18;
const TOP = 16;
const BOTTOM = 38;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export function LineChart({
  series,
  timestamps,
  range,
  valueFormatter,
  emptyLabel,
  ariaLabel,
  includeZero = false,
}: LineChartProps) {
  const { t, language } = useI18n();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    setHoverIndex(null);
  }, [timestamps.length, range]);

  const allValues = useMemo(
    () => series.flatMap((entry) => entry.values).filter((value): value is number => value !== null),
    [series],
  );
  const scale = useMemo(() => computeAxisScale(allValues, includeZero), [allValues, includeZero]);

  if (timestamps.length === 0 || !scale) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-control border border-dashed border-line px-4 py-10 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const xFor = (index: number) =>
    timestamps.length <= 1 ? LEFT + PLOT_WIDTH / 2 : LEFT + (index / (timestamps.length - 1)) * PLOT_WIDTH;
  const yFor = (value: number) =>
    TOP + PLOT_HEIGHT - ((value - scale.min) / (scale.max - scale.min || 1)) * PLOT_HEIGHT;
  const xTicks = chartTickIndices(timestamps.length);
  const hoveredValues =
    hoverIndex === null
      ? []
      : series.map((entry) => ({ series: entry, value: entry.values[hoverIndex] ?? null }));

  const updateHover = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (svgX - LEFT) / PLOT_WIDTH));
    setHoverIndex(Math.round(ratio * (timestamps.length - 1)));
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const current = hoverIndex ?? timestamps.length - 1;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setHoverIndex(Math.max(0, current - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setHoverIndex(Math.min(timestamps.length - 1, current + 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHoverIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHoverIndex(timestamps.length - 1);
    }
  };

  return (
    <div className="space-y-3">
      <div
        aria-live="polite"
        className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 rounded-control bg-elevated px-3 py-2 text-xs text-muted"
      >
        {hoverIndex === null ? (
          <span>{t("chart.hoverHint")}</span>
        ) : (
          <>
            <span className="tabular font-medium text-ink">{formatChartTime(timestamps[hoverIndex], language, range)}</span>
            {hoveredValues.map(({ series: entry, value }) => (
              <span className="inline-flex items-center gap-1.5" key={entry.id}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.label}: <span className="tabular text-ink">{value === null ? t("common.dash") : valueFormatter(value, language)}</span>
              </span>
            ))}
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          aria-label={ariaLabel}
          className="h-auto w-[760px] max-w-none touch-none sm:w-full"
          onBlur={() => setHoverIndex(null)}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={updateHover}
          role="img"
          tabIndex={0}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {scale.ticks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  className="text-line"
                  stroke="currentColor"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                  x1={LEFT}
                  x2={WIDTH - RIGHT}
                  y1={y}
                  y2={y}
                />
                <text
                  className="fill-muted text-[11px]"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={LEFT - 8}
                  y={y}
                >
                  {valueFormatter(tick, language)}
                </text>
              </g>
            );
          })}

          {xTicks.map((index) => (
            <text
              className="fill-muted text-[11px]"
              key={index}
              textAnchor={index === 0 ? "start" : index === timestamps.length - 1 ? "end" : "middle"}
              x={xFor(index)}
              y={HEIGHT - 10}
            >
              {formatChartTime(timestamps[index], language, range)}
            </text>
          ))}

          {series.map((entry) => {
            let started = false;
            const path: string[] = [];
            entry.values.forEach((value, index) => {
              if (value === null) {
                started = false;
                return;
              }
              path.push(`${started ? "L" : "M"}${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`);
              started = true;
            });
            return (
              <path
                d={path.join(" ")}
                fill="none"
                key={entry.id}
                stroke={entry.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
            );
          })}

          {timestamps.length === 1
            ? series.map((entry) =>
                entry.values[0] === null ? null : (
                  <circle
                    cx={xFor(0)}
                    cy={yFor(entry.values[0])}
                    fill={entry.color}
                    key={`point-${entry.id}`}
                    r="3"
                  />
                ),
              )
            : null}

          {hoverIndex !== null ? (
            <>
              <line
                className="text-muted/40"
                stroke="currentColor"
                strokeWidth="1"
                x1={xFor(hoverIndex)}
                x2={xFor(hoverIndex)}
                y1={TOP}
                y2={TOP + PLOT_HEIGHT}
              />
              {hoveredValues.map(({ series: entry, value }) =>
                value === null ? null : (
                  <circle
                    cx={xFor(hoverIndex)}
                    cy={yFor(value)}
                    fill={entry.color}
                    key={`hover-${entry.id}`}
                    r="3.5"
                    stroke="rgb(var(--c-card))"
                    strokeWidth="1.5"
                  />
                ),
              )}
            </>
          ) : null}

          <rect
            fill="transparent"
            height={PLOT_HEIGHT}
            width={PLOT_WIDTH}
            x={LEFT}
            y={TOP}
          />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((entry) => (
          <span className="inline-flex items-center gap-1.5" key={entry.id}>
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
