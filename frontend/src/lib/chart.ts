export interface AxisScale {
  min: number;
  max: number;
  ticks: number[];
}

export function computeAxisScale(values: number[], includeZero = false, tickCount = 4): AxisScale | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    const padding = Math.abs(min) * 0.1 || 1;
    min -= padding;
    max += padding;
  } else {
    const padding = (max - min) * 0.08;
    min -= padding;
    max += padding;
  }
  if (includeZero) {
    min = 0;
    max = Math.max(0, max);
  }
  const step = (max - min) / tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => min + step * index);
  return { min, max, ticks };
}

export function chartTickIndices(count: number, maxTicks = 5): number[] {
  if (count <= 0) {
    return [];
  }
  if (count <= maxTicks) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const indices = new Set<number>();
  for (let index = 0; index < maxTicks; index += 1) {
    indices.add(Math.round((index * (count - 1)) / (maxTicks - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}
