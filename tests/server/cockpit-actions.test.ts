import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertWarmIntro } from "../../src/server/cockpit-policy";

describe("assertWarmIntro", () => {
  it("rejects free cases", () => {
    const c = createCase({
      id: "w1",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    expect(() => assertWarmIntro(c)).toThrow(/paid/i);
  });

  it("allows paid cases", () => {
    const c = createCase({
      id: "w2",
      entryContext: "RETURNER_IN_UK",
      tier: "PAID_DWY",
    });
    expect(() => assertWarmIntro(c)).not.toThrow();
  });
});
