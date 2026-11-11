import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { FullscreenProvider } from "@/hooks/useFullscreen";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ThemeProvider } from "@/i18n/ThemeProvider";

import { AppShell } from "./app-shell";

vi.mock("@/hooks/useDevice", () => ({
  useDevice: () => ({
    snapshot: { connected: false, device: null, last_seen_at: null },
    refresh: vi.fn(async () => undefined),
    refreshing: false,
  }),
}));

vi.mock("@/hooks/useLiveDashboard", () => ({
  useLiveDashboard: () => ({
    dashboard: null,
    refresh: vi.fn(async () => undefined),
    refreshing: false,
  }),
}));

beforeEach(() => {
  localStorage.setItem("cpe-lens.language", "en");
});

describe("AppShell", () => {
  it("keeps primary data views visible and groups management links", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <ThemeProvider>
          <FullscreenProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route element={<AppShell />} path="/">
                <Route element={<p>Overview content</p>} index />
                <Route element={<p>Wi-Fi content</p>} path="wifi" />
              </Route>
            </Routes>
          </MemoryRouter>
          </FullscreenProvider>
        </ThemeProvider>
      </I18nProvider>,
    );

    expect(screen.getByText("Overview content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Signal & cells" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Traffic" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clients" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wi-Fi" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(document.querySelector("aside")?.getAttribute("data-state")).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wi-Fi" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Wi-Fi" }));
    expect(screen.getByText("Wi-Fi content")).toBeInTheDocument();
  });
});
