import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { DeviceProvider } from "@/hooks/useDevice";
import { FullscreenProvider } from "@/hooks/useFullscreen";
import { LiveDashboardProvider } from "@/hooks/useLiveDashboard";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ThemeProvider } from "@/i18n/ThemeProvider";

const OverviewPage = lazy(() => import("@/pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const DevicePage = lazy(() => import("@/pages/DevicePage").then((module) => ({ default: module.DevicePage })));
const SignalPage = lazy(() => import("@/pages/SignalPage").then((module) => ({ default: module.SignalPage })));
const TrafficPage = lazy(() => import("@/pages/TrafficPage").then((module) => ({ default: module.TrafficPage })));
const ClientsPage = lazy(() => import("@/pages/ClientsPage").then((module) => ({ default: module.ClientsPage })));
const WifiPage = lazy(() => import("@/pages/WifiPage").then((module) => ({ default: module.WifiPage })));
const MobilePage = lazy(() => import("@/pages/MobilePage").then((module) => ({ default: module.MobilePage })));
const MessagingPage = lazy(() => import("@/pages/MessagingPage").then((module) => ({ default: module.MessagingPage })));
const LocksPage = lazy(() => import("@/pages/LocksPage").then((module) => ({ default: module.LocksPage })));
const AdvancedPage = lazy(() => import("@/pages/AdvancedPage").then((module) => ({ default: module.AdvancedPage })));
const DiagnosticsPage = lazy(() => import("@/pages/DiagnosticsPage").then((module) => ({ default: module.DiagnosticsPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <FullscreenProvider>
        <BrowserRouter>
          <DeviceProvider>
            <LiveDashboardProvider>
              <Routes>
                <Route element={<AppShell />} path="/">
                  <Route element={<OverviewPage />} index />
                  <Route element={<DevicePage />} path="device" />
                  <Route element={<SignalPage />} path="signal" />
                  <Route element={<TrafficPage />} path="traffic" />
                  <Route element={<ClientsPage />} path="clients" />
                  <Route element={<WifiPage />} path="wifi" />
                  <Route element={<MobilePage />} path="mobile" />
                  <Route element={<MessagingPage />} path="messaging" />
                  <Route element={<LocksPage />} path="locks" />
                  <Route element={<AdvancedPage />} path="advanced" />
                  <Route element={<DiagnosticsPage />} path="diagnostics" />
                  <Route element={<SettingsPage />} path="settings" />
                  <Route element={<Navigate replace to="/" />} path="*" />
                </Route>
              </Routes>
            </LiveDashboardProvider>
          </DeviceProvider>
        </BrowserRouter>
        </FullscreenProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
