import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import type { CaseState } from "../../src/domain/stage-engine";
import {
  acceptedEvidenceKinds,
  advisorSlaView,
  applyClientSlaAction,
  assessClientSla,
  CLIENT_SLA_CARVE_OUTS,
  ClientSlaError,
  clientSlaTargetCopy,
  decodeClientSlaPayload,
  encodeClientSlaPayload,
  evaluateSlaCriteria,
  isIsoCalendarDate,
  partnerSlaMet,
  slaSignalsFrom,
  type SlaScorecardSignal,
} from "../../src/domain/client-sla";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const TARGET = "2026-12-15";

function paidUk(id = "sla1"): CaseState {
  return createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
    now: NOW,
  });
}

function acceptAny(caseState: CaseState): CaseState {
  const kind = caseState.stages[0]?.requiredEvidenceKinds[0];
  if (!kind) {
    return caseState;
  }
  return {
    ...caseState,
    stages: caseState.stages.map((stage, index) =>
      index === 0
        ? { ...stage, acceptedEvidenceKinds: [...stage.acceptedEvidenceKinds, kind] }
        : stage,
    ),
  };
}

function scorecard(): SlaScorecardSignal[] {
  return [
    {
      partnerId: "p_mortgage",
      roleType: "MORTGAGE_PARTNER",
      hasReferral: true,
      scorecardRating: "STRONG",
      participationRate: 0.8,
    },
  ];
}

function eligibleCase(): CaseState {
  return acceptAny(paidUk("sla_ok"));
}

function publish(caseState: CaseState, targetDate = TARGET): CaseState {
  return applyClientSlaAction(caseState, {
    action: "PUBLISH",
    targetDate,
    reason: "Ledger is live; partner scorecard supports a target.",
    actorRole: "ADVISOR",
    moduleEnabled: true,
    partnerSignals: scorecard(),
    now: NOW,
  });
}

describe("criteria from the ledger, not a marketing promise", () => {
  it("requires paid tier, a partner scorecard signal, and accepted ledger evidence", () => {
    const free = createCase({
      id: "sla_free",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
      now: NOW,
    });
    const unpaid = evaluateSlaCriteria({ caseState: free, partnerSignals: scorecard() });
    expect(unpaid.find((c) => c.key === "paid_tier")?.met).toBe(false);

    const noPartner = evaluateSlaCriteria({ caseState: paidUk(), partnerSignals: [] });
    expect(noPartner.find((c) => c.key === "partner_scorecard")?.met).toBe(false);

    const watchCounts = evaluateSlaCriteria({
      caseState: paidUk(),
      partnerSignals: [
        {
          partnerId: "p2",
          roleType: "CONVEYANCER",
          hasReferral: true,
          scorecardRating: "WATCH",
          participationRate: 0.2,
        },
      ],
    });
    expect(watchCounts.find((c) => c.key === "partner_scorecard")?.met).toBe(true);

    const missingLedger = evaluateSlaCriteria({
      caseState: paidUk(),
      partnerSignals: scorecard(),
    });
    expect(missingLedger.find((c) => c.key === "ledger_started")?.met).toBe(false);

    const ready = evaluateSlaCriteria({
      caseState: eligibleCase(),
      partnerSignals: scorecard(),
    });
    expect(ready.every((c) => c.met)).toBe(true);
    expect(acceptedEvidenceKinds(eligibleCase()).length).toBeGreaterThan(0);
  });

  it("treats a superseded referral as no signal and ignores client-role rows", () => {
    const signals = slaSignalsFrom({
      referrals: [
        { partnerId: "old", partnerRole: "MORTGAGE_PARTNER", supersededAt: "2026-09-03T00:00:00.000Z" },
        { partnerId: "new", partnerRole: "MORTGAGE_PARTNER", supersededAt: null },
        { partnerId: "clientish", partnerRole: "CLIENT", supersededAt: null },
      ],
      scorecards: [{ partnerId: "new", rating: "NO_DATA", participationRate: 0.6 }],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.partnerId).toBe("new");
    expect(partnerSlaMet(signals)).toBe(true);
  });
});

describe("assessClientSla", () => {
  it("stays UNPUBLISHED when the module is off, even if every criterion is green", () => {
    const commitment = assessClientSla({
      caseState: eligibleCase(),
      moduleEnabled: false,
      partnerSignals: scorecard(),
    });
    expect(commitment.status).toBe("UNPUBLISHED");
    expect(commitment.moduleEnabled).toBe(false);
    expect(commitment.eligibleByRules).toBe(false);
    expect(commitment.publication).toBeNull();
    expect(clientSlaTargetCopy(commitment)).toBeNull();
  });

  it("stays UNPUBLISHED until an advisor publishes, then AMENDED, then WITHDRAWN", () => {
    const unpublished = assessClientSla({
      caseState: eligibleCase(),
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(unpublished.status).toBe("UNPUBLISHED");
    expect(unpublished.eligibleByRules).toBe(true);
    expect(clientSlaTargetCopy(unpublished)).toBeNull();

    const published = publish(eligibleCase());
    const live = assessClientSla({
      caseState: published,
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(live.status).toBe("PUBLISHED");
    expect(live.publication?.targetDate).toBe(TARGET);
    expect(live.carveOuts).toEqual(CLIENT_SLA_CARVE_OUTS);

    const amended = applyClientSlaAction(published, {
      action: "AMEND",
      targetDate: "2027-01-20",
      reason: "Survey booked later than first assumed.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: scorecard(),
      now: NOW,
    });
    expect(
      assessClientSla({
        caseState: amended,
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }).status,
    ).toBe("AMENDED");

    const withdrawn = applyClientSlaAction(amended, {
      action: "WITHDRAW",
      targetDate: null,
      reason: "Client paused the purchase.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: scorecard(),
      now: NOW,
    });
    const after = assessClientSla({
      caseState: withdrawn,
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(after.status).toBe("WITHDRAWN");
    expect(after.publication?.targetDate).toBeNull();
    expect(clientSlaTargetCopy(after)).toBeNull();
  });
});

describe("applyClientSlaAction", () => {
  it("refuses clients, short reasons, a closed module, unpaid cases, and bad dates", () => {
    const ready = eligibleCase();
    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "CLIENT",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/advisor/i);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "short",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/reason/i);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "ADVISOR",
        moduleEnabled: false,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/not enabled/i);

    expect(() =>
      applyClientSlaAction(paidUk(), {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "I just like a date.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: [],
        now: NOW,
      }),
    ).toThrow(/eligib/i);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: "2026-13-40",
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(ClientSlaError);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: "2026-01-01",
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/past|date/i);
  });

  it("refuses a second publish, amend/withdraw with nothing live, then allows re-publish after withdraw", () => {
    const live = publish(eligibleCase());
    expect(() => publish(live)).toThrow(/already published/i);

    expect(() =>
      applyClientSlaAction(eligibleCase(), {
        action: "AMEND",
        targetDate: "2027-01-20",
        reason: "Survey booked later than first assumed.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/nothing to amend/i);

    expect(() =>
      applyClientSlaAction(eligibleCase(), {
        action: "WITHDRAW",
        targetDate: null,
        reason: "Client paused the purchase.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/nothing to withdraw/i);

    const withdrawn = applyClientSlaAction(live, {
      action: "WITHDRAW",
      targetDate: null,
      reason: "Client paused the purchase.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: scorecard(),
      now: NOW,
    });
    const again = publish(withdrawn, "2027-02-01");
    expect(
      assessClientSla({
        caseState: again,
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }).status,
    ).toBe("PUBLISHED");
  });

  it("round-trips the payload codec and ignores bare strings", () => {
    const encoded = encodeClientSlaPayload({
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "ok enough",
    });
    expect(decodeClientSlaPayload(encoded)).toEqual({
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "ok enough",
    });
    expect(decodeClientSlaPayload("dip_aip")).toBeNull();
    expect(decodeClientSlaPayload(undefined)).toBeNull();
    expect(isIsoCalendarDate(TARGET)).toBe(true);
    expect(isIsoCalendarDate("2026-02-31")).toBe(false);
    expect(isIsoCalendarDate("15/12/2026")).toBe(false);
  });
});

describe("client copy is a target with carve-outs, never a guarantee", () => {
  it("uses target / working toward / subject to carve-outs and omits guarantee language", () => {
    const copy = clientSlaTargetCopy(
      assessClientSla({
        caseState: publish(eligibleCase()),
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }),
    );
    expect(copy?.status).toBe("PUBLISHED");
    expect(copy?.targetDate).toBe(TARGET);
    expect(copy?.headline).toMatch(/target/i);
    expect(copy?.body).toMatch(/working toward/i);
    expect(copy?.body).toMatch(/subject to.{0,20}carve-outs/i);
    expect(copy?.carveOuts).toHaveLength(CLIENT_SLA_CARVE_OUTS.length);
    const blob = JSON.stringify(copy);
    expect(blob).not.toMatch(/guarante/i);
    expect(blob).not.toMatch(/qualityScore|participationRate|slaDays/i);
    expect(blob).not.toMatch(/england|wales|leasehold/i);
  });

  it("hides copy from free DIY even if a stale publish event is present", () => {
    const published = publish(eligibleCase());
    const asFree = { ...published, tier: "FREE_DIY" as const };
    const commitment = assessClientSla({
      caseState: asFree,
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(clientSlaTargetCopy(commitment)).toBeNull();
  });
});

describe("advisor view is operating IP", () => {
  it("exposes criteria and action gates without auto-publishing", () => {
    const unpublished = advisorSlaView(
      assessClientSla({
        caseState: eligibleCase(),
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }),
    );
    expect(unpublished.canPublish).toBe(true);
    expect(unpublished.canAmend).toBe(false);
    expect(unpublished.canWithdraw).toBe(false);
    expect(unpublished.criteria.every((c) => c.met)).toBe(true);

    const live = advisorSlaView(
      assessClientSla({
        caseState: publish(eligibleCase()),
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }),
    );
    expect(live.canPublish).toBe(false);
    expect(live.canAmend).toBe(true);
    expect(live.canWithdraw).toBe(true);
    expect(live.publication?.targetDate).toBe(TARGET);
  });
});
