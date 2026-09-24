import { describe, it, expect } from "vitest";
import {
  applyCertificationOverride,
  CHAIN_FREE_REQUIRED_EVIDENCE,
  ChainFreeError,
  assessCertification,
  type PartnerParticipationSignal,
} from "../../src/domain/chain-free";
import { createCase, type CaseState } from "../../src/domain/stage-engine";
import { performCertificationOverride } from "../../src/server/chain-free";

function acceptKinds(caseState: CaseState, kinds: readonly string[]): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      acceptedEvidenceKinds: [
        ...new Set([
          ...stage.acceptedEvidenceKinds,
          ...kinds.filter((kind) => stage.requiredEvidenceKinds.includes(kind)),
        ]),
      ],
    })),
  };
}

const signals: PartnerParticipationSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    participatedOnCase: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

function ready(): CaseState {
  return acceptKinds(
    createCase({ id: "cfa1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" }),
    CHAIN_FREE_REQUIRED_EVIDENCE,
  );
}

describe("performCertificationOverride", () => {
  it("writes CERTIFIED through the policy gate", () => {
    const next = performCertificationOverride(ready(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      partnerSignals: signals,
    });
    expect(
      assessCertification({
        caseState: next,
        moduleEnabled: true,
        partnerSignals: signals,
      }).status,
    ).toBe("CERTIFIED");
  });

  it("maps domain refusals to ChainFreeError codes the action will surface", () => {
    try {
      performCertificationOverride(
        createCase({ id: "cfa2", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" }),
        { action: "CERTIFY", reason: "I just like them.", partnerSignals: [] },
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ChainFreeError);
      expect((err as ChainFreeError).code).toBe("NOT_ELIGIBLE");
    }
  });

  it("refuses the overlay when the pack flag is off", () => {
    const other = { ...ready(), marketPackId: "au" };
    expect(() =>
      performCertificationOverride(other, {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        partnerSignals: signals,
      }),
    ).toThrow(/not enabled/i);
  });
});

describe("error mapping contract", () => {
  it("exposes the domain message, not a generic failure, for ChainFreeError", () => {
    const err = new ChainFreeError("REASON_REQUIRED", "A reason of at least 8 characters is required");
    expect(err.message).toMatch(/reason/i);
    expect(err).toBeInstanceOf(Error);
  });

  it("does not let applyCertificationOverride skip the server gate", () => {
    const certified = applyCertificationOverride(ready(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
    });
    expect(certified.events.some((e) => e.type === "CHAIN_FREE_CERTIFIED")).toBe(true);
  });
});
