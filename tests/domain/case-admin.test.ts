import { describe, it, expect } from "vitest";
import { setEntryContext, upgradeToPaid } from "../../src/domain/case-admin";
import {
  acceptEvidence,
  advanceStage,
  createCase,
  submitEvidence,
} from "../../src/domain/stage-engine";

function paidCaseAtMoneyStage(entry: "RETURNER_OVERSEAS" | "UK_RESIDENT_SPEED") {
  let c = createCase({ id: "adm_1", entryContext: entry, tier: "PAID_DWY" });
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

describe("upgradeToPaid", () => {
  it("moves a free case to paid and logs the upgrade", () => {
    const free = createCase({
      id: "up_1",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    const upgraded = upgradeToPaid(free, {
      actorRole: "ADVISOR",
      now: new Date("2026-09-05T09:00:00.000Z"),
    });

    expect(upgraded.tier).toBe("PAID_DWY");
    const event = upgraded.events.at(-1);
    expect(event?.type).toBe("CASE_UPGRADED");
    expect(event?.payload).toBe("FREE_DIY->PAID_DWY");
    expect(free.tier).toBe("FREE_DIY");
  });

  it("refuses non-advisors and already-paid cases", () => {
    const free = createCase({
      id: "up_2",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    expect(() => upgradeToPaid(free, { actorRole: "CLIENT" })).toThrow(
      /advisor/i,
    );

    const paid = createCase({
      id: "up_3",
      entryContext: "RETURNER_IN_UK",
      tier: "PAID_DWY",
    });
    expect(() => upgradeToPaid(paid, { actorRole: "ADVISOR" })).toThrow(
      /already/i,
    );
  });
});

describe("setEntryContext", () => {
  it("recomputes required evidence and drops kinds that no longer apply", () => {
    let c = paidCaseAtMoneyStage("RETURNER_OVERSEAS");
    c = submitEvidence(c, {
      stageKey: "money_readiness",
      kind: "fx_plan",
      actorRole: "CLIENT",
    });
    expect(
      c.stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds,
    ).toContain("fx_plan");

    const switched = setEntryContext(c, {
      entryContext: "UK_RESIDENT_SPEED",
      actorRole: "ADVISOR",
    });
    const money = switched.stages.find((s) => s.key === "money_readiness");

    expect(switched.entryContext).toBe("UK_RESIDENT_SPEED");
    expect(money?.requiredEvidenceKinds).toEqual(["source_of_funds"]);
    expect(money?.submittedEvidenceKinds).not.toContain("fx_plan");
    expect(switched.events.at(-1)?.type).toBe("ENTRY_CONTEXT_CHANGED");
    expect(switched.events.at(-1)?.payload).toBe(
      "RETURNER_OVERSEAS->UK_RESIDENT_SPEED",
    );
  });

  it("is a no-op when the entry context is unchanged", () => {
    const c = paidCaseAtMoneyStage("RETURNER_OVERSEAS");
    const same = setEntryContext(c, {
      entryContext: "RETURNER_OVERSEAS",
      actorRole: "ADVISOR",
    });
    expect(same.events.length).toBe(c.events.length);
  });

  it("refuses non-advisors", () => {
    const c = paidCaseAtMoneyStage("RETURNER_OVERSEAS");
    expect(() =>
      setEntryContext(c, {
        entryContext: "RETURNER_IN_UK",
        actorRole: "CLIENT",
      }),
    ).toThrow(/advisor/i);
  });

  it("locks once the offer stage has started", () => {
    let c = createCase({
      id: "lock_1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = {
      ...c,
      stages: c.stages.map((s) =>
        s.key === "offer_instruct" ? { ...s, status: "ACTIVE" as const } : s,
      ),
    };
    expect(() =>
      setEntryContext(c, {
        entryContext: "RETURNER_IN_UK",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/locked/i);
  });
});
