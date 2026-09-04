import { describe, it, expect } from "vitest";
import { nudgePartner, reroutePartner } from "../../src/domain/partner-ops";
import {
  acceptEvidence,
  advanceStage,
  createCase,
  StageEngineError,
  submitEvidence,
} from "../../src/domain/stage-engine";

function paidCaseAtMortgagePath() {
  let c = createCase({
    id: "ops_1",
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
  });
  c = submitEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "ADVISOR" });
  c = advanceStage(c, { actorRole: "ADVISOR" });
  c = submitEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "ADVISOR" });
  return advanceStage(c, { actorRole: "ADVISOR" });
}

describe("nudgePartner", () => {
  it("appends PARTNER_NUDGED on a partner-owned focus stage", () => {
    const c = paidCaseAtMortgagePath();
    const nudged = nudgePartner(c, {
      actorRole: "ADVISOR",
      now: new Date("2026-09-06T09:00:00.000Z"),
    });
    const event = nudged.events.at(-1);
    expect(event).toEqual({
      type: "PARTNER_NUDGED",
      stageKey: "mortgage_path",
      actorRole: "ADVISOR",
      at: "2026-09-06T09:00:00.000Z",
      payload: "MORTGAGE_PARTNER",
    });
    expect(nudged.stages).toEqual(c.stages);
  });

  it("rejects non-advisors and client-owned focus stages", () => {
    const c = paidCaseAtMortgagePath();
    expect(() => nudgePartner(c, { actorRole: "CLIENT" })).toThrow(StageEngineError);

    const fresh = createCase({ id: "ops_2", entryContext: "RETURNER_IN_UK", tier: "PAID_DWY" });
    expect(() => nudgePartner(fresh, { actorRole: "ADVISOR" })).toThrow(/partner-owned/i);
  });
});

describe("reroutePartner", () => {
  it("appends PARTNER_REROUTED with a JSON payload on the focus stage", () => {
    const c = paidCaseAtMortgagePath();
    const rerouted = reroutePartner(c, {
      roleType: "MORTGAGE_PARTNER",
      fromPartnerId: "p_old",
      toPartnerId: "p_new",
      actorRole: "ADVISOR",
      now: new Date("2026-09-07T09:00:00.000Z"),
    });
    const event = rerouted.events.at(-1)!;
    expect(event.type).toBe("PARTNER_REROUTED");
    expect(event.stageKey).toBe("mortgage_path");
    expect(JSON.parse(event.payload!)).toEqual({
      roleType: "MORTGAGE_PARTNER",
      fromPartnerId: "p_old",
      toPartnerId: "p_new",
    });
  });

  it("allows a first assignment (fromPartnerId null) but rejects same-partner and non-partner roles", () => {
    const c = paidCaseAtMortgagePath();
    expect(() =>
      reroutePartner(c, {
        roleType: "CONVEYANCER",
        fromPartnerId: null,
        toPartnerId: "p_new",
        actorRole: "ADVISOR",
      }),
    ).not.toThrow();
    expect(() =>
      reroutePartner(c, {
        roleType: "MORTGAGE_PARTNER",
        fromPartnerId: "p_same",
        toPartnerId: "p_same",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/same partner/i);
    expect(() =>
      reroutePartner(c, {
        roleType: "CLIENT",
        fromPartnerId: null,
        toPartnerId: "p_new",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/partner role/i);
    expect(() =>
      reroutePartner(c, {
        roleType: "MORTGAGE_PARTNER",
        fromPartnerId: null,
        toPartnerId: "p_new",
        actorRole: "MORTGAGE_PARTNER",
      }),
    ).toThrow(StageEngineError);
  });
});
