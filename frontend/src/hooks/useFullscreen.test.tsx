import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FullscreenProvider, useFullscreen } from "./useFullscreen";

function Probe() {
  const { monitoring, toggle, exit } = useFullscreen();
  return (
    <div>
      <p data-testid="state">{monitoring ? "monitoring" : "normal"}</p>
      <button onClick={toggle} type="button">Toggle</button>
      <button onClick={exit} type="button">Exit</button>
    </div>
  );
}

describe("FullscreenProvider", () => {
  it("enters monitoring mode and exits without requiring native fullscreen", async () => {
    const user = userEvent.setup();
    render(
      <FullscreenProvider><Probe /></FullscreenProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("normal");
    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByTestId("state")).toHaveTextContent("monitoring");
    await user.click(screen.getByRole("button", { name: "Exit" }));
    expect(screen.getByTestId("state")).toHaveTextContent("normal");
  });
});
