import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./I18nProvider";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function Probe() {
  const { language, setLanguage, t } = useI18n();
  const { mode, setMode } = useTheme();
  return (
    <div>
      <p>{t("nav.overview")}</p>
      <p data-testid="language">{language}</p>
      <p data-testid="theme">{mode}</p>
      <button onClick={() => setLanguage("en")} type="button">English</button>
      <button onClick={() => setMode("dark")} type="button">Dark</button>
    </div>
  );
}

describe("providers", () => {
  it("applies language and theme choices to the document", async () => {
    const user = userEvent.setup();
    localStorage.setItem("cpe-lens.language", "zh");
    render(
      <I18nProvider>
        <ThemeProvider><Probe /></ThemeProvider>
      </I18nProvider>,
    );

    expect(screen.getByText("总览")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("language")).toHaveTextContent("en");
    expect(document.documentElement.lang).toBe("en");

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
