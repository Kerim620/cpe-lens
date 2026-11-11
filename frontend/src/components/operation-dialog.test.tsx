import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperationPlan, OperationResult } from "@/api/types";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { OperationController } from "@/hooks/useOperation";

import { OperationDialog } from "./operation-dialog";

const plan: OperationPlan = {
  token: "token",
  action: "wifi.update",
  title_key: "control.wifiUpdate.title",
  risk: "high",
  capability_ids: ["wifi_settings"],
  current: { ssid: "Old-WiFi", hidden: false },
  proposed: { ssid: "New-WiFi", hidden: false },
  warnings: ["control.wifiUpdate.disconnectWarning"],
  expires_at: "2026-11-11T00:00:00Z",
};

function controller(overrides: Partial<OperationController> = {}): OperationController {
  return {
    plan,
    result: null,
    error: null,
    planning: false,
    applying: false,
    start: vi.fn(async () => undefined),
    confirm: vi.fn(async () => undefined),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderDialog(value: OperationController, onClose = vi.fn()) {
  return render(
    <I18nProvider>
      <OperationDialog controller={value} onClose={onClose} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem("cpe-lens.language", "en");
});

describe("OperationDialog", () => {
  it("shows old and new values and requires an explicit acknowledgement", async () => {
    const user = userEvent.setup();
    const value = controller();
    renderDialog(value);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Old-WiFi")).toBeInTheDocument();
    expect(screen.getByText("New-WiFi")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Apply" });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(value.confirm).toHaveBeenCalledTimes(1);
  });

  it("cancels without applying the plan", async () => {
    const user = userEvent.setup();
    const value = controller();
    const onClose = vi.fn();
    renderDialog(value, onClose);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(value.confirm).not.toHaveBeenCalled();
    expect(value.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("renders read-back verification results", () => {
    const result: OperationResult = {
      operation_id: 1,
      action: "wifi.update",
      status: "success",
      verification: "partial",
      current: { ssid: "Old-WiFi" },
      proposed: { ssid: "New-WiFi" },
      output: { restart_requested: true },
      message_key: "operation.partial",
      error: null,
    };
    renderDialog(controller({ plan: null, result }));
    expect(screen.getByText("Operation submitted; part of the result could not be verified")).toBeInTheDocument();
    expect(screen.getByText(/Partially verified/)).toBeInTheDocument();
    expect(screen.getByText("restart requested")).toBeInTheDocument();
  });
});
