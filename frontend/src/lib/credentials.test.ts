import { beforeEach, describe, expect, it } from "vitest";

import { clearRememberedCredentials, loadRememberedCredentials, saveRememberedCredentials } from "./credentials";

beforeEach(() => {
  localStorage.clear();
});

describe("remembered credentials", () => {
  it("round-trips an explicit opt-in", () => {
    saveRememberedCredentials({ address: "http://192.168.8.1", username: "admin", password: "secret" });
    expect(loadRememberedCredentials()).toEqual({
      address: "http://192.168.8.1",
      username: "admin",
      password: "secret",
    });
  });

  it("ignores corrupt and incomplete values", () => {
    localStorage.setItem("cpe-lens.remembered-credentials", "{bad");
    expect(loadRememberedCredentials()).toBeNull();
    localStorage.setItem("cpe-lens.remembered-credentials", JSON.stringify({ address: "x" }));
    expect(loadRememberedCredentials()).toBeNull();
    clearRememberedCredentials();
    expect(loadRememberedCredentials()).toBeNull();
  });
});
