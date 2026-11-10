import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { DeviceProvider } from "./hooks/useDevice";
import { LiveDashboardProvider } from "./hooks/useLiveDashboard";
import { I18nProvider } from "./i18n/I18nProvider";
import { ThemeProvider } from "./i18n/ThemeProvider";
import { AdvancedPage } from "./pages/AdvancedPage";
import { ClientsPage } from "./pages/ClientsPage";
import { DevicePage } from "./pages/DevicePage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { LocksPage } from "./pages/LocksPage";
import { MessagingPage } from "./pages/MessagingPage";
import { MobilePage } from "./pages/MobilePage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignalPage } from "./pages/SignalPage";
import { TrafficPage } from "./pages/TrafficPage";
import { WifiPage } from "./pages/WifiPage";

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <BrowserRouter>
          <DeviceProvider>
            <LiveDashboardProvider>
              <Routes>
                <Route element={<Layout />} path="/">
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
      </ThemeProvider>
    </I18nProvider>
  );
}
