import { describe, expect, it } from "vitest";

import { translate } from "./I18nProvider";
import { en, isTranslationKey, zh } from "./translations";

describe("translations", () => {
  it("keeps Chinese and English dictionaries in sync", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  it("interpolates named parameters", () => {
    expect(translate("en", "top.lastUpdated", { time: "10:30" })).toContain("10:30");
    expect(translate("zh", "device.capabilityCount", { count: 26 })).toContain("26");
  });

  it("keeps unknown placeholders intact instead of printing undefined", () => {
    expect(translate("en", "device.capabilityCount", {})).toContain("{count}");
  });

  it("recognizes only known translation keys", () => {
    expect(isTranslationKey("capability.status.available")).toBe(true);
    expect(isTranslationKey("capability.status.not_real")).toBe(false);
  });
});
