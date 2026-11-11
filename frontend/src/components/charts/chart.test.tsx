import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chart } from "./chart";

const series = [{ key: "value", label: "Value", color: "var(--chart-lte)" }];

describe("Chart", () => {
  it("renders an explicit empty state instead of fabricating zeroes", () => {
    render(
      <Chart
        ariaLabel="Test chart"
        data={[]}
        emptyLabel="No samples"
        series={series}
      />,
    );
    expect(screen.getByRole("img", { name: "Test chart" })).toBeInTheDocument();
    expect(screen.getByText("No samples")).toBeInTheDocument();
  });

  it("treats an all-null series as empty", () => {
    render(
      <Chart
        ariaLabel="Gap chart"
        data={[{ label: "10:00", value: null }, { label: "10:01", value: null }]}
        emptyLabel="No samples"
        series={series}
      />,
    );
    expect(screen.getByText("No samples")).toBeInTheDocument();
  });
});
