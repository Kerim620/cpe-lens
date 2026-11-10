import { describe, expect, it } from "vitest";

import {
  displayValue,
  formatBitrate,
  formatBytes,
  formatDateTime,
  formatDb,
  formatDbm,
  formatDuration,
  formatNetworkType,
  formatNumber,
} from "./format";

describe("formatters", () => {
  it("falls back for missing or invalid dates", () => {
    expect(formatDateTime(null, "en", "Never")).toBe("Never");
    expect(formatDateTime("not-a-date", "en", "Never")).toBe("Never");
    expect(formatDateTime("2026-11-10T12:00:00Z", "en", "Never")).not.toBe("Never");
  });

  it("translates numeric network types and keeps textual ones", () => {
    expect(formatNetworkType("19", "en")).toBe("Type 19");
    expect(formatNetworkType("LTE", "en")).toBe("LTE");
    expect(formatNetworkType(null, "en")).toBe("Unknown network");
  });

  it("formats numbers and missing values", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(displayValue(null, "en")).toBe("—");
    expect(displayValue("Generic CPE", "en")).toBe("Generic CPE");
  });
});

describe("telemetry formatters", () => {
  it("formats bitrates with decimal units", () => {
    expect(formatBitrate(1_500_000, "en")).toBe("1.5 Mbps");
    expect(formatBitrate(0, "en")).toBe("0 bps");
    expect(formatBitrate(null, "en")).toBe("—");
  });

  it("formats bytes with binary units", () => {
    expect(formatBytes(1024, "en")).toBe("1 KB");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(null, "en")).toBe("—");
  });

  it("formats durations", () => {
    expect(formatDuration(45, "en")).toBe("45s");
    expect(formatDuration(3661, "en")).toBe("1h 1m");
    expect(formatDuration(null, "en")).toBe("—");
  });

  it("formats signal values with localized units", () => {
    expect(formatDb(-90, "en")).toBe("-90 dB");
    expect(formatDbm(-85, "en")).toBe("-85 dBm");
    expect(formatDb(null, "en")).toBe("—");
  });
});
