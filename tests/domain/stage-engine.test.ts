import { describe, it, expect } from "vitest";
import {
  acceptEvidence,
  advanceStage,
  createCase,
  getCurrentStage,
  submitEvidence,
} from "../../src/domain/stage-engine";

describe("createCase", () => {
  it("activates purchase_profile owned by CLIENT and only one ACTIVE stage", () => {
    const c = createCase({
      id: "case_1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      now: new Date("2026-09-04T10:00:00.000Z"),
    });
    expect(c.stages).toHaveLength(9);
    const active = c.stages.filter((s) => s.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].key).toBe("purchase_profile");
    expect(active[0].ownerRole).toBe("CLIENT");
    expect(active[0].activatedAt).toBe("2026-09-04T10:00:00.000Z");
    expect(active[0].dueAt).toBe("2026-09-07T10:00:00.000Z");
    expect(c.stages.slice(1).every((s) => s.status === "PENDING")).toBe(true);
    expect(getCurrentStage(c)?.key).toBe("purchase_profile");
    expect(c.marketPackId).toBe("ew");
    expect(c.events).toContainEqual({
      type: "CASE_CREATED",
      stageKey: "purchase_profile",
      actorRole: "CLIENT",
      at: "2026-09-04T10:00:00.000Z",
    });
  });
});

describe("advanceStage", () => {
  it("refuses advance when required evidence missing", () => {
    let c = createCase({
      id: "case_2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = submitEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    c = acceptEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "ADVISOR",
    });
    c = advanceStage(c, { actorRole: "ADVISOR" });
    expect(() => advanceStage(c, { actorRole: "ADVISOR" })).toThrow(
      /evidence/i,
    );
  });

  it("keeps exactly one ACTIVE stage after a successful advance", () => {
    let c = createCase({
      id: "case_3",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = submitEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    c = acceptEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "ADVISOR",
    });
    c = advanceStage(c, { actorRole: "ADVISOR" });
    expect(c.stages.filter((s) => s.status === "ACTIVE")).toHaveLength(1);
    expect(getCurrentStage(c)?.key).toBe("money_readiness");
  });
});
