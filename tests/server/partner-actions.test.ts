import { describe, it, expect } from "vitest";
import {
  acceptEvidence,
  advanceStage,
  blockStage,
  createCase,
  submitEvidence,
} from "../../src/domain/stage-engine";
import { assertPartnerSubmit } from "../../src/server/partner-policy";

function advanceToMortgagePath() {
  let c = createCase({
    id: "mp1",
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
  return c;
}

describe("assertPartnerSubmit", () => {
  it("allows conveyancer only when they own the active stage", () => {
    const c = createCase({
      id: "cv1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(() =>
      assertPartnerSubmit(c, "CONVEYANCER", "purchase_profile"),
    ).toThrow(/owner/i);
  });

  it("allows mortgage partner on mortgage_path focus stage", () => {
    const c = advanceToMortgagePath();
    expect(() =>
      assertPartnerSubmit(c, "MORTGAGE_PARTNER", "mortgage_path"),
    ).not.toThrow();
  });

  it("rejects mortgage partner on client-owned stage", () => {
    const c = advanceToMortgagePath();
    expect(() =>
      assertPartnerSubmit(c, "MORTGAGE_PARTNER", "purchase_profile"),
    ).toThrow(/owner|focus|forbidden/i);
  });

  it("allows partner submit on sole BLOCKED focus stage", () => {
    let c = advanceToMortgagePath();
    c = blockStage(c, { reason: "Awaiting docs", actorRole: "ADVISOR" });
    expect(() =>
      assertPartnerSubmit(c, "MORTGAGE_PARTNER", "mortgage_path"),
    ).not.toThrow();
  });
});
