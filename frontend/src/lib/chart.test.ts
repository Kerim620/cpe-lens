import { describe, expect, it } from "vitest";

import { chartTickIndices, computeAxisScale } from "./chart";

describe("chart helpers", () => {
  it("computes padded scales and ticks", () => {
    const scale = computeAxisScale([-90, -80]);
    expect(scale).not.toBeNull();
    expect(scale!.min).toBeLessThan(-90);
    expect(scale!.max).toBeGreaterThan(-80);
    expect(scale!.ticks).toHaveLength(5);
  });

  it("can include zero for rate charts", () => {
    const scale = computeAxisScale([100, 200], true);
    expect(scale).not.toBeNull();
    expect(scale!.min).toBe(0);
    expect(scale!.max).toBeGreaterThan(200);
  });

  it("handles a single constant value", () => {
    const scale = computeAxisScale([50]);
    expect(scale).not.toBeNull();
    expect(scale!.min).toBeLessThan(50);
    expect(scale!.max).toBeGreaterThan(50);
  });

  it("returns no scale without data", () => {
    expect(computeAxisScale([])).toBeNull();
  });

  it("returns sensible x-axis tick indices", () => {
    expect(chartTickIndices(3)).toEqual([0, 1, 2]);
    expect(chartTickIndices(60)).toEqual([0, 15, 30, 44, 59]);
  });
});
