import type { HistoryRange } from "../api/types";
import { translate } from "../i18n/I18nProvider";
import type { Language } from "../i18n/I18nProvider";

export function formatDateTime(
  value: string | null | undefined,
  language: Language,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US").format(value);
}

export function formatNetworkType(value: string | null | undefined, language: Language): string {
  if (!value) {
    return translate(language, "network.unknown");
  }
  if (/^\d+$/.test(value)) {
    return translate(language, "network.typeCode", { code: value });
  }
  return value;
}

export function displayValue(value: string | null | undefined, language: Language): string {
  return value && value.trim() ? value : translate(language, "common.dash");
}


function compactNumber(value: number, language: Language): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatBitrate(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  let scaled = Math.max(0, value);
  let index = 0;
  while (scaled >= 1000 && index < units.length - 1) {
    scaled /= 1000;
    index += 1;
  }
  return `${compactNumber(scaled, language)} ${units[index]}`;
}

export function formatBytes(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let scaled = Math.max(0, value);
  let index = 0;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return `${compactNumber(scaled, language)} ${units[index]}`;
}

export function formatDuration(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  const total = Math.max(0, Math.floor(value));
  if (total < 60) {
    return translate(language, "duration.seconds", { value: total });
  }
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) {
    return translate(language, "duration.daysHours", { days, hours });
  }
  if (hours > 0) {
    return translate(language, "duration.hoursMinutes", { hours, minutes });
  }
  return translate(language, "duration.minutesSeconds", { minutes, seconds });
}

export function formatMhz(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  return translate(language, "unit.mhzValue", { value: compactNumber(value, language) });
}

export function formatSignalNumber(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDb(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  return `${new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 }).format(value)} ${translate(language, "unit.db")}`;
}

export function formatDbm(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return translate(language, "common.dash");
  }
  return `${new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 }).format(value)} ${translate(language, "unit.dbm")}`;
}

export function formatChartTime(value: string, language: Language, range: HistoryRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return translate(language, "common.dash");
  }
  const options: Intl.DateTimeFormatOptions =
    range === "7d"
      ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
      : { hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", options).format(date);
}
