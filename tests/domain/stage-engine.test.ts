import { describe, it, expect } from "vitest";
import {
  acceptEvidence,
  advanceStage,
  blockStage,
  createCase,
  getCurrentStage,
  getFocusStage,
  resumeStage,
  StageEngineError,
  submitEvidence,
  submitPartnerEvidence,
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

describe("evidence focus stage guard", () => {
  function advancePastPurchaseProfile() {
    let c = createCase({
      id: "case_focus",
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
    return advanceStage(c, { actorRole: "ADVISOR" });
  }

  it("rejects acceptEvidence on a completed stage after advance", () => {
    const c = advancePastPurchaseProfile();
    expect(getCurrentStage(c)?.key).toBe("money_readiness");
    expect(() =>
      acceptEvidence(c, {
        stageKey: "purchase_profile",
        kind: "profile_complete",
        actorRole: "ADVISOR",
      }),
    ).toThrowError(StageEngineError);
    expect(() =>
      acceptEvidence(c, {
        stageKey: "purchase_profile",
        kind: "profile_complete",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/focus stage: money_readiness/);
  });

  it("rejects acceptEvidence on a pending future stage", () => {
    const c = advancePastPurchaseProfile();
    expect(() =>
      acceptEvidence(c, {
        stageKey: "mortgage_path",
        kind: "dip_aip",
        actorRole: "ADVISOR",
      }),
    ).toThrowError(StageEngineError);
    expect(() =>
      acceptEvidence(c, {
        stageKey: "mortgage_path",
        kind: "dip_aip",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/focus stage: money_readiness/);
  });
});

describe("advanceStage role guard", () => {
  function readyToAdvance() {
    let c = createCase({
      id: "case_partner_adv",
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
    return c;
  }

  it("rejects partner advance", () => {
    const c = readyToAdvance();
    expect(() => advanceStage(c, { actorRole: "MORTGAGE_PARTNER" })).toThrow(
      StageEngineError,
    );
  });

  it("allows advisor advance", () => {
    const c = readyToAdvance();
    const next = advanceStage(c, { actorRole: "ADVISOR" });
    expect(getCurrentStage(next)?.key).toBe("money_readiness");
  });
});

describe("block and resume", () => {
  it("blocks then resumes to single ACTIVE stage", () => {
    let c = createCase({
      id: "case_block",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = blockStage(c, { reason: "Awaiting docs", actorRole: "ADVISOR" });
    expect(getCurrentStage(c)).toBeNull();
    expect(getFocusStage(c)?.status).toBe("BLOCKED");

    c = resumeStage(c, { actorRole: "ADVISOR" });
    expect(getCurrentStage(c)?.status).toBe("ACTIVE");
    expect(c.stages.filter((s) => s.status === "ACTIVE")).toHaveLength(1);
  });

  it("rejects resume from non-advisor", () => {
    let c = createCase({
      id: "case_block2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = blockStage(c, { reason: "Hold", actorRole: "ADVISOR" });
    expect(() => resumeStage(c, { actorRole: "CLIENT" })).toThrow(
      StageEngineError,
    );
  });

  it("rejects block from non-advisor", () => {
    const c = createCase({
      id: "case_block3",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(() =>
      blockStage(c, { reason: "Hold", actorRole: "CLIENT" }),
    ).toThrow(StageEngineError);
  });
});

describe("submitted evidence tracking", () => {
  it("tracks submitted kinds until accepted", () => {
    let c = createCase({
      id: "case_sub",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = submitEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    const stage = c.stages.find((s) => s.key === "purchase_profile");
    expect(stage?.submittedEvidenceKinds).toContain("profile_complete");
    expect(stage?.acceptedEvidenceKinds).not.toContain("profile_complete");

    c = acceptEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "ADVISOR",
    });
    const accepted = c.stages.find((s) => s.key === "purchase_profile");
    expect(accepted?.acceptedEvidenceKinds).toContain("profile_complete");
    expect(accepted?.submittedEvidenceKinds).not.toContain("profile_complete");
  });

  it("tracks partner submitted evidence", () => {
    let c = createCase({
      id: "case_ps",
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
    c = submitEvidence(c, {
      stageKey: "money_readiness",
      kind: "source_of_funds",
      actorRole: "CLIENT",
    });
    c = acceptEvidence(c, {
      stageKey: "money_readiness",
      kind: "source_of_funds",
      actorRole: "ADVISOR",
    });
    c = advanceStage(c, { actorRole: "ADVISOR" });

    c = submitPartnerEvidence(c, {
      stageKey: "mortgage_path",
      kind: "dip_aip",
      actorRole: "MORTGAGE_PARTNER",
    });
    const stage = c.stages.find((s) => s.key === "mortgage_path");
    expect(stage?.submittedEvidenceKinds).toContain("dip_aip");
  });
});
