import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import {
  canSelfAdvance,
  canUseWarmIntro,
  canViewPlaybook,
  clientStageView,
} from "../../src/domain/freemium";

describe("freemium", () => {
  it("blocks warm intro and playbooks on FREE_DIY", () => {
    const c = createCase({
      id: "f1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(canUseWarmIntro(c)).toBe(false);
    expect(canViewPlaybook(c, "money_readiness")).toBe(false);
    expect(canSelfAdvance(c, "money_readiness")).toBe(false);
  });

  it("marks non-free stages limited on free tier views", () => {
    const c = createCase({
      id: "f2",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
      now: new Date("2026-09-01T10:00:00.000Z"),
    });
    const views = clientStageView(c, new Date("2026-09-04T10:00:00.000Z"));
    const money = views.find((v) => v.key === "money_readiness");
    expect(money?.limited).toBe(true);
  });

  it("uses UTC day floors for daysInStage on visible stages", () => {
    const c = createCase({
      id: "f3",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      now: new Date("2026-09-01T10:00:00.000Z"),
    });
    const views = clientStageView(c, new Date("2026-09-04T10:00:00.000Z"));
    const profile = views.find((v) => v.key === "purchase_profile");
    expect(profile?.daysInStage).toBe(3);
  });
});
