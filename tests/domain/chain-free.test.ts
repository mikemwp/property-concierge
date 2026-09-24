import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import type { CaseState } from "../../src/domain/stage-engine";
import {
  acceptedEvidenceKinds,
  advisorCertificationView,
  applyCertificationOverride,
  assessCertification,
  CHAIN_FREE_REQUIRED_EVIDENCE,
  ChainFreeError,
  clientCertificationCopy,
  decodeChainFreePayload,
  encodeChainFreePayload,
  evaluateCriteria,
  partnerParticipationMet,
  partnerSignalsFrom,
  type PartnerParticipationSignal,
} from "../../src/domain/chain-free";

function paidUk(id = "cf1"): CaseState {
  return createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
  });
}

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

function participating(): PartnerParticipationSignal[] {
  return [
    {
      partnerId: "p_mortgage",
      roleType: "MORTGAGE_PARTNER",
      hasReferral: true,
      participatedOnCase: true,
      scorecardRating: "STRONG",
      participationRate: 0.8,
    },
  ];
}

function eligibleCase(): CaseState {
  return acceptKinds(paidUk("cf_ok"), CHAIN_FREE_REQUIRED_EVIDENCE);
}

describe("criteria from the ledger, not stars", () => {
  it("requires paid tier, a participation or scorecard signal, and the three evidence kinds", () => {
    const free = createCase({
      id: "cf_free",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    const unpaid = evaluateCriteria({ caseState: free, partnerSignals: participating() });
    expect(unpaid.find((c) => c.key === "paid_tier")?.met).toBe(false);

    const noPartner = evaluateCriteria({ caseState: paidUk(), partnerSignals: [] });
    expect(noPartner.find((c) => c.key === "partner_participation")?.met).toBe(false);

    const scoreOnly = evaluateCriteria({
      caseState: paidUk(),
      partnerSignals: [
        {
          partnerId: "p2",
          roleType: "CONVEYANCER",
          hasReferral: true,
          participatedOnCase: false,
          scorecardRating: "WATCH",
          participationRate: 0.2,
        },
      ],
    });
    expect(scoreOnly.find((c) => c.key === "partner_participation")?.met).toBe(true);

    const missingEvidence = evaluateCriteria({
      caseState: paidUk(),
      partnerSignals: participating(),
    });
    expect(missingEvidence.find((c) => c.key === "evidence_complete")?.met).toBe(false);

    const ready = evaluateCriteria({
      caseState: eligibleCase(),
      partnerSignals: participating(),
    });
    expect(ready.every((c) => c.met)).toBe(true);
    expect(acceptedEvidenceKinds(eligibleCase())).toEqual(
      expect.arrayContaining([...CHAIN_FREE_REQUIRED_EVIDENCE]),
    );
  });

  it("treats a superseded referral as no signal and ignores client-role rows", () => {
    const caseState = {
      ...paidUk(),
      events: [
        {
          type: "EVIDENCE_SUBMITTED",
          stageKey: "mortgage_path",
          actorRole: "MORTGAGE_PARTNER" as const,
          at: "2026-09-04T10:00:00.000Z",
          payload: "dip_aip",
        },
      ],
    };
    const signals = partnerSignalsFrom({
      caseState,
      referrals: [
        { partnerId: "old", partnerRole: "MORTGAGE_PARTNER", supersededAt: "2026-09-03T00:00:00.000Z" },
        { partnerId: "new", partnerRole: "MORTGAGE_PARTNER", supersededAt: null },
        { partnerId: "clientish", partnerRole: "CLIENT", supersededAt: null },
      ],
      scorecards: [
        { partnerId: "new", rating: "NO_DATA", participationRate: 0 },
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.partnerId).toBe("new");
    expect(signals[0]?.participatedOnCase).toBe(true);
    expect(partnerParticipationMet(signals)).toBe(true);
  });
});

describe("assessCertification", () => {
  it("stays NOT_ASSESSED when the module is off, even if every criterion is green", () => {
    const cert = assessCertification({
      caseState: eligibleCase(),
      moduleEnabled: false,
      partnerSignals: participating(),
    });
    expect(cert.status).toBe("NOT_ASSESSED");
    expect(cert.eligibleByRules).toBe(false);
    expect(cert.override).toBeNull();
    expect(clientCertificationCopy(cert)).toBeNull();
  });

  it("is NOT_ASSESSED for free DIY and IN_PROGRESS once the household is paid", () => {
    const free = assessCertification({
      caseState: createCase({ id: "cf_f", entryContext: "UK_RESIDENT_SPEED", tier: "FREE_DIY" }),
      moduleEnabled: true,
      partnerSignals: [],
    });
    expect(free.status).toBe("NOT_ASSESSED");
    expect(clientCertificationCopy(free)).toBeNull();

    const paid = assessCertification({
      caseState: paidUk(),
      moduleEnabled: true,
      partnerSignals: [],
    });
    expect(paid.status).toBe("IN_PROGRESS");
    expect(paid.eligibleByRules).toBe(false);
    expect(clientCertificationCopy(paid)?.status).toBe("IN_PROGRESS");
  });

  it("does not auto-certify when every rule is met — that stays an advisor override", () => {
    const cert = assessCertification({
      caseState: eligibleCase(),
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(cert.eligibleByRules).toBe(true);
    expect(cert.status).toBe("IN_PROGRESS");
  });

  it("serves UK-resident speed-seekers through the same assessor as returners", () => {
    const resident = assessCertification({
      caseState: eligibleCase(),
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    const returner = assessCertification({
      caseState: acceptKinds(
        createCase({ id: "cf_ret", entryContext: "RETURNER_OVERSEAS", tier: "PAID_DWY" }),
        CHAIN_FREE_REQUIRED_EVIDENCE,
      ),
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(resident.criteria.map((c) => c.key)).toEqual(returner.criteria.map((c) => c.key));
  });
});

describe("advisor override with an audit event", () => {
  it("certifies only when rules pass, records a reason, and is resettable", () => {
    const now = new Date("2026-09-06T09:00:00.000Z");
    const certified = applyCertificationOverride(eligibleCase(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      actorRole: "ADVISOR",
      now,
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    const event = certified.events.at(-1);
    expect(event?.type).toBe("CHAIN_FREE_CERTIFIED");
    expect(decodeChainFreePayload(event?.payload)).toEqual({
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
    });

    const after = assessCertification({
      caseState: certified,
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(after.status).toBe("CERTIFIED");
    expect(after.override?.reason).toMatch(/no onward chain/i);
    expect(advisorCertificationView(after)).toMatchObject({
      canCertify: false,
      canMarkIneligible: true,
      canReset: true,
    });
    expect(clientCertificationCopy(after)?.headline).toMatch(/certified chain-free/i);

    const reset = applyCertificationOverride(certified, {
      action: "RESET",
      reason: "Re-check after a new fact.",
      actorRole: "ADVISOR",
      now,
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(reset.events.at(-1)?.type).toBe("CHAIN_FREE_RESET");
    expect(
      assessCertification({
        caseState: reset,
        moduleEnabled: true,
        partnerSignals: participating(),
      }).status,
    ).toBe("IN_PROGRESS");
  });

  it("lets an advisor mark ineligible even when rules pass, and refuses a second stamp", () => {
    const marked = applyCertificationOverride(eligibleCase(), {
      action: "INELIGIBLE",
      reason: "Household still selling a flat.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(
      assessCertification({
        caseState: marked,
        moduleEnabled: true,
        partnerSignals: participating(),
      }).status,
    ).toBe("INELIGIBLE");
    expect(clientCertificationCopy(
      assessCertification({
        caseState: marked,
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    )).toBeNull();

    expect(() =>
      applyCertificationOverride(marked, {
        action: "INELIGIBLE",
        reason: "Household still selling a flat.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(ChainFreeError);
  });

  it("refuses clients, short reasons, a closed module, and certify-when-red", () => {
    const ready = eligibleCase();
    expect(() =>
      applyCertificationOverride(ready, {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        actorRole: "CLIENT",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(/advisor/i);

    expect(() =>
      applyCertificationOverride(ready, {
        action: "CERTIFY",
        reason: "short",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(/reason/i);

    expect(() =>
      applyCertificationOverride(ready, {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        actorRole: "ADVISOR",
        moduleEnabled: false,
        partnerSignals: participating(),
      }),
    ).toThrow(/not enabled/i);

    expect(() =>
      applyCertificationOverride(paidUk(), {
        action: "CERTIFY",
        reason: "I just like them.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: [],
      }),
    ).toThrow(/criterion/i);

    expect(() =>
      applyCertificationOverride(ready, {
        action: "RESET",
        reason: "Nothing to undo here.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(/reset/i);
  });

  it("round-trips the payload codec and ignores bare strings", () => {
    const encoded = encodeChainFreePayload({ action: "CERTIFY", reason: "ok enough" });
    expect(decodeChainFreePayload(encoded)).toEqual({ action: "CERTIFY", reason: "ok enough" });
    expect(decodeChainFreePayload("dip_aip")).toBeNull();
    expect(decodeChainFreePayload(undefined)).toBeNull();
  });
});

describe("client copy never carries scorecard IP", () => {
  it("omits numbers, SLA language, guarantees and evidence kind names", () => {
    const certified = applyCertificationOverride(eligibleCase(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    const copy = clientCertificationCopy(
      assessCertification({
        caseState: certified,
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    );
    const blob = JSON.stringify(copy);
    expect(blob).not.toMatch(/qualityScore|participationRate|slaDays|guarantee/i);
    expect(blob).not.toContain("source_of_funds");
    expect(blob).not.toContain("dip_aip");
    expect(blob).toMatch(/not a completion date/i);
  });
});
