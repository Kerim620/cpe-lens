import {
  ChartNoAxesCombined,
  Languages,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  Monitor,
  Moon,
  RadioTower,
  RefreshCw,
  Router,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Stethoscope,
  Sun,
  Users,
  Wifi,
} from "lucide-react";
import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { FullscreenButton } from "@/components/layout/fullscreen-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarCollapseButton,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDevice } from "@/hooks/useDevice";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/i18n/ThemeProvider";
import type { ThemeMode } from "@/i18n/ThemeProvider";
import type { TranslationKey } from "@/i18n/translations";
import { formatDateTime, formatNetworkType } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: TranslationKey;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const primaryNav: NavItem[] = [
  { to: "/", label: "nav.overview", icon: LayoutDashboard, end: true },
  { to: "/signal", label: "nav.signal", icon: RadioTower },
  { to: "/traffic", label: "nav.traffic", icon: ChartNoAxesCombined },
  { to: "/clients", label: "nav.clients", icon: Users },
];

const manageNav: NavItem[] = [
  { to: "/device", label: "nav.device", icon: Router },
  { to: "/wifi", label: "nav.wifi", icon: Wifi },
  { to: "/mobile", label: "nav.mobile", icon: Smartphone },
  { to: "/locks", label: "nav.locks", icon: LockKeyhole },
  { to: "/messaging", label: "nav.messaging", icon: MessageSquare },
  { to: "/advanced", label: "nav.advanced", icon: SlidersHorizontal },
];

const systemNav: NavItem[] = [
  { to: "/diagnostics", label: "nav.diagnostics", icon: Stethoscope },
  { to: "/settings", label: "nav.settings", icon: Settings },
];

const pageTitles: Record<string, TranslationKey> = {
  "/": "nav.overview",
  "/device": "nav.device",
  "/signal": "nav.signal",
  "/traffic": "nav.traffic",
  "/clients": "nav.clients",
  "/wifi": "nav.wifi",
  "/mobile": "nav.mobile",
  "/locks": "nav.locks",
  "/messaging": "nav.messaging",
  "/advanced": "nav.advanced",
  "/diagnostics": "nav.diagnostics",
  "/settings": "nav.settings",
};

function NavRow({ item }: { item: NavItem }) {
  const { t } = useI18n();
  const { open, isMobile, setOpenMobile } = useSidebar();
  const expanded = open || isMobile;
  const { pathname } = useLocation();
  const Icon = item.icon;
  const label = t(item.label);
  const active = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-label={label}
        asChild
        collapsed={!expanded}
        isActive={active}
        tooltip={label}
      >
        <NavLink onClick={() => { if (isMobile) setOpenMobile(false); }} to={item.to}>
          <Icon />
          <span className={expanded ? "truncate" : "sr-only"}>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Brand() {
  const { t } = useI18n();
  const { open, isMobile } = useSidebar();
  const expanded = open || isMobile;
  return (
    <SidebarHeader className={cn("border-b border-border", expanded ? "gap-2.5 px-3" : "justify-center")}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <RadioTower className="size-4" />
      </span>
      {expanded ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{t("app.name")}</p>
          <p className="truncate text-[10px] text-muted-foreground">{t("app.tagline")}</p>
        </div>
      ) : null}
    </SidebarHeader>
  );
}

function SidebarNavigation() {
  const { t } = useI18n();
  const { open, isMobile } = useSidebar();
  const expanded = open || isMobile;
  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.section.monitor")}</SidebarGroupLabel>
          <SidebarMenu>
            {primaryNav.map((item) => <NavRow item={item} key={item.to} />)}
          </SidebarMenu>
        </SidebarGroup>
        {!expanded ? <SidebarSeparator /> : null}

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.group.manage")}</SidebarGroupLabel>
          <SidebarMenu>
            {manageNav.map((item) => <NavRow item={item} key={item.to} />)}
          </SidebarMenu>
        </SidebarGroup>
        {!expanded ? <SidebarSeparator /> : null}

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.section.system")}</SidebarGroupLabel>
          <SidebarMenu>
            {systemNav.map((item) => <NavRow item={item} key={item.to} />)}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarCollapseButton collapseLabel={t("nav.collapseSidebar")} expandLabel={t("nav.expandSidebar")} />
      </SidebarFooter>
    </>
  );
}

function ThemeMenu() {
  const { t } = useI18n();
  const { mode, setMode } = useTheme();
  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const options: Array<{ value: ThemeMode; label: TranslationKey; icon: typeof Sun }> = [
    { value: "system", label: "theme.system", icon: Monitor },
    { value: "light", label: "theme.light", icon: Sun },
    { value: "dark", label: "theme.dark", icon: Moon },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("theme.label")} size="icon-sm" variant="ghost">
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
        {options.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuCheckboxItem
              checked={mode === option.value}
              key={option.value}
              onCheckedChange={() => setMode(option.value)}
            >
              <OptionIcon className="size-3.5" />
              {t(option.label)}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LanguageMenu() {
  const { t, language, setLanguage } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("language.label")} size="sm" variant="ghost">
          <Languages className="size-4" />
          <span className="text-[11px]">{language === "zh" ? "中文" : "EN"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={language === "zh"} onCheckedChange={() => setLanguage("zh")}>
          {t("language.zh")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={language === "en"} onCheckedChange={() => setLanguage("en")}>
          {t("language.en")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar() {
  const { t, language } = useI18n();
  const { pathname } = useLocation();
  const { snapshot, refresh: refreshDevice, refreshing: refreshingDevice } = useDevice();
  const { dashboard, refresh: refreshLive, refreshing: refreshingLive } = useLiveDashboard();
  const refreshing = refreshingDevice || refreshingLive;
  const lastSeen = dashboard?.sampled_at ?? snapshot?.last_seen_at;
  const titleKey = pageTitles[pathname] ?? "nav.overview";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <SidebarTrigger className="lg:hidden" label={t("aria.menu")} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full sm:hidden", snapshot?.connected ? "bg-success" : "bg-muted-foreground")} />
            {t(titleKey)}
          </p>
          <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
            {snapshot?.device?.model ?? t("app.tagline")}
            {snapshot?.device?.network_type ? ` · ${formatNetworkType(snapshot.device.network_type, language)}` : ""}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
              snapshot?.connected
                ? "border-success/25 bg-success/10 text-success"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {snapshot?.connected ? t("top.connected") : t("top.disconnected")}
          </span>
          <span className="hidden text-[10px] text-muted-foreground md:inline">
            {lastSeen
              ? t("top.lastUpdated", { time: formatDateTime(lastSeen, language, t("common.dash")) })
              : t("top.never")}
          </span>
          <Button
            aria-label={t("aria.refresh")}
            disabled={refreshing}
            onClick={() => {
              void refreshDevice();
              void refreshLive();
            }}
            size="icon-sm"
            variant="ghost"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
          <FullscreenButton compact />
          <ThemeMenu />
          <LanguageMenu />
        </div>
      </div>
    </header>
  );
}

function RouteFallback() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="h-24 animate-pulse rounded-lg bg-muted" key={index} />
        ))}
      </div>
    </div>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const { monitoring, exit } = useFullscreen();
  if (monitoring) {
    return (
      <div className="min-h-svh bg-background">
        <div className="fixed right-3 top-3 z-50">
          <Button aria-label={t("fullscreen.exit")} onClick={exit} size="sm" variant="outline">
            <span className="hidden sm:inline">{t("fullscreen.exit")}</span>
            <span className="sm:hidden">×</span>
          </Button>
        </div>
        <main className="h-svh overflow-auto p-3 pt-14 sm:p-4 sm:pt-14">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    );
  }
  return (
    <SidebarProvider>
      <Sidebar closeLabel={t("common.close")} mobileDescription={t("aria.mainNavigation")} mobileTitle={t("app.name")}>
        <Brand />
        <SidebarNavigation />
      </Sidebar>
      <SidebarInset>
        <TopBar />
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-border px-6 py-3 text-center text-[10px] text-muted-foreground">
          {t("app.footer")}
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
