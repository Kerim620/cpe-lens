import { NavLink, Outlet } from "react-router-dom";

import { useDevice } from "../hooks/useDevice";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../i18n/ThemeProvider";
import type { ThemeMode } from "../i18n/ThemeProvider";
import type { TranslationKey } from "../i18n/translations";
import { formatDateTime, formatNetworkType } from "../lib/format";
import { ErrorBanner } from "./ErrorBanner";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: IconName;
  end?: boolean;
}

interface NavSection {
  titleKey: TranslationKey;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: "nav.section.monitoring",
    items: [
      { to: "/", labelKey: "nav.overview", icon: "overview", end: true },
      { to: "/device", labelKey: "nav.device", icon: "device" },
      { to: "/signal", labelKey: "nav.signal", icon: "signal" },
      { to: "/traffic", labelKey: "nav.traffic", icon: "traffic" },
      { to: "/clients", labelKey: "nav.clients", icon: "clients" },
    ],
  },
  {
    titleKey: "nav.section.control",
    items: [
      { to: "/wifi", labelKey: "nav.wifi", icon: "wifi" },
      { to: "/mobile", labelKey: "nav.mobile", icon: "mobile" },
      { to: "/messaging", labelKey: "nav.messaging", icon: "message" },
      { to: "/locks", labelKey: "nav.locks", icon: "lock" },
      { to: "/advanced", labelKey: "nav.advanced", icon: "advanced" },
    ],
  },
  {
    titleKey: "nav.section.system",
    items: [
      { to: "/diagnostics", labelKey: "nav.diagnostics", icon: "diagnostics" },
      { to: "/settings", labelKey: "nav.settings", icon: "settings" },
    ],
  },
];


function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-card lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand text-brand-contrast">
          <Icon name="signal" size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{t("app.name")}</p>
          <p className="truncate text-xs text-muted">{t("app.tagline")}</p>
        </div>
      </div>
      <nav aria-label={t("aria.mainNavigation")} className="flex-1 overflow-y-auto px-3 pb-4">
        {navSections.map((section) => (
          <div className="mb-5" key={section.titleKey}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
                    end={item.end}
                    to={item.to}
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4 text-xs leading-5 text-muted">
        <p className="flex items-center gap-1.5">
          <Icon name="shield" size={14} />
          {t("app.localOnly")}
        </p>
        <p className="mt-1">{t("app.footer")}</p>
      </div>
    </aside>
  );
}

function MobileNav() {
  const { t } = useI18n();
  const items = navSections.flatMap((section) => section.items);
  return (
    <nav
      aria-label={t("aria.mainNavigation")}
      className="border-b border-line bg-card px-2 py-2 lg:hidden"
    >
      <ul className="flex gap-1 overflow-x-auto">
        {items.map((item) => (
          <li className="shrink-0" key={item.to}>
            <NavLink
              className={({ isActive }) =>
                `flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-control px-2.5 text-xs font-medium ${
                  isActive ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-elevated hover:text-ink"
                }`
              }
              end={item.end}
              to={item.to}
            >
              <Icon name={item.icon} size={14} />
              {t(item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TopBar() {
  const { t, language, setLanguage } = useI18n();
  const { mode, setMode } = useTheme();
  const { snapshot, loading, refreshing, refresh, connecting } = useDevice();

  const connected = snapshot?.connected ?? false;
  const stateLabel = loading
    ? t("common.loading")
    : connecting
      ? t("top.connecting")
      : connected
        ? t("top.connected")
        : t("top.disconnected");
  const stateClass =
    loading || connecting
      ? "border-line bg-elevated text-muted"
      : connected
        ? "border-success/30 bg-success/10 text-success"
        : "border-line bg-elevated text-muted";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <span className={`chip ${stateClass}`}>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          <span>{stateLabel}</span>
        </span>

        <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <Icon name="network" size={14} />
          {snapshot?.device
            ? formatNetworkType(snapshot.device.network_type, language)
            : t("top.networkUnknown")}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="tabular hidden text-xs text-muted md:inline">
            {snapshot?.last_seen_at
              ? t("top.lastUpdated", {
                  time: formatDateTime(snapshot.last_seen_at, language, t("common.dash")),
                })
              : t("top.never")}
          </span>
          <button
            aria-label={t("aria.refresh")}
            className="btn btn-ghost px-2.5"
            disabled={loading || refreshing}
            onClick={() => void refresh()}
            title={t("top.refresh")}
            type="button"
          >
            <Icon className={refreshing ? "animate-spin" : ""} name="refresh" size={16} />
          </button>
          <label className="sr-only" htmlFor="language-select">
            {t("language.label")}
          </label>
          <select
            aria-label={t("language.label")}
            className="field min-h-9 w-auto py-1.5 text-xs"
            id="language-select"
            onChange={(event) => setLanguage(event.target.value === "zh" ? "zh" : "en")}
            value={language}
          >
            <option value="zh">{t("language.zh")}</option>
            <option value="en">{t("language.en")}</option>
          </select>
          <label className="sr-only" htmlFor="theme-select">
            {t("theme.label")}
          </label>
          <select
            aria-label={t("theme.label")}
            className="field min-h-9 w-auto py-1.5 text-xs"
            id="theme-select"
            onChange={(event) => setMode(event.target.value as ThemeMode)}
            value={mode}
          >
            <option value="system">{t("theme.system")}</option>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
          </select>
        </div>
      </div>
    </header>
  );
}

export function Layout() {
  const { t } = useI18n();
  const { error, snapshot, clearError } = useDevice();
  const showGlobalError = error !== null && (snapshot?.connected ?? false);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {showGlobalError && error ? (
            <div className="mb-5">
              <ErrorBanner error={error} onDismiss={clearError} />
            </div>
          ) : null}
          <Outlet />
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted sm:px-6">
          {t("app.phase")} · {t("app.footer")}
        </footer>
      </div>
    </div>
  );
}
