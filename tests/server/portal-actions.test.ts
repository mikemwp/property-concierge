import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertPortalSubmit } from "../../src/server/portal-policy";

describe("assertPortalSubmit", () => {
  it("throws for free user on money_readiness", () => {
    const c = createCase({
      id: "p1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(() => assertPortalSubmit(c, "money_readiness")).toThrow(
      /upgrade|paid|forbidden/i,
    );
  });

  it("allows free user on current self-advanceable stage", () => {
    const c = createCase({
      id: "p2",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(() => assertPortalSubmit(c, "purchase_profile")).not.toThrow();
  });

  it("allows paid client on focus stage", () => {
    const c = createCase({
      id: "p3",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
    });
    expect(() => assertPortalSubmit(c, "purchase_profile")).not.toThrow();
  });
});
