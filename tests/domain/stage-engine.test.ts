import { describe, it, expect } from "vitest";
import { createCase, getCurrentStage } from "../../src/domain/stage-engine";

describe("createCase", () => {
  it("activates purchase_profile owned by CLIENT and only one ACTIVE stage", () => {
    const c = createCase({
      id: "case_1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      now: new Date("2026-09-04T10:00:00.000Z"),
    });
    const active = c.stages.filter((s) => s.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].key).toBe("purchase_profile");
    expect(active[0].ownerRole).toBe("CLIENT");
    expect(getCurrentStage(c)?.key).toBe("purchase_profile");
    expect(c.marketPackId).toBe("ew");
  });
});
