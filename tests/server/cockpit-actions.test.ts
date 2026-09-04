import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertReroute, assertWarmIntro } from "../../src/server/cockpit-policy";

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

describe("assertReroute", () => {
  it("rejects free cases with a re-route specific message", () => {
    const c = createCase({ id: "rr1", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" });
    expect(() => assertReroute(c)).toThrow(/re-rout/i);
  });

  it("allows paid cases", () => {
    const c = createCase({ id: "rr2", entryContext: "RETURNER_IN_UK", tier: "PAID_DWY" });
    expect(() => assertReroute(c)).not.toThrow();
  });
});
