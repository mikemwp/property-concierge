import { describe, it, expect } from "vitest";
import type { PanelMember } from "../../src/domain/panel";
import {
  attributedStages,
  buildScorecard,
  computeQualityScore,
  rateScorecard,
  stageOutcome,
} from "../../src/domain/scorecard";
import {
  createCase,
  type CaseState,
  type StageState,
} from "../../src/domain/stage-engine";

const priya: PanelMember = {
  id: "p_priya",
  roleType: "MORTGAGE_PARTNER",
  name: "Priya Nair",
  firm: "Northstar Mortgages",
  active: true,
  slaDays: 3,
  userId: null,
};

function fixtureCase(
  id: string,
  mortgagePatch: Partial<StageState>,
  events: CaseState["events"] = [],
): CaseState {
  const base = createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
    now: new Date("2026-08-20T09:00:00.000Z"),
  });
  return {
    ...base,
    stages: base.stages.map((s) =>
      s.key === "mortgage_path" ? { ...s, ...mortgagePatch } : s,
    ),
    events: [...base.events, ...events],
  };
}

const referral = { referralCreatedAt: "2026-08-21T00:00:00.000Z", supersededAt: null };

describe("attributedStages", () => {
  it("returns only activated stages owned by the member's role", () => {
    const c = fixtureCase("a1", {
      status: "ACTIVE",
      activatedAt: "2026-09-01T10:00:00.000Z",
    });
    const stages = attributedStages(priya, { caseState: c, ...referral });
    expect(stages.map((s) => s.key)).toEqual(["mortgage_path"]);
  });

  it("ignores stages never activated and stages completed before the referral existed", () => {
    const pending = fixtureCase("a2", {});
    expect(attributedStages(priya, { caseState: pending, ...referral })).toEqual([]);

    const earlier = fixtureCase("a3", {
      status: "DONE",
      activatedAt: "2026-08-10T10:00:00.000Z",
      completedAt: "2026-08-15T10:00:00.000Z",
    });
    expect(attributedStages(priya, { caseState: earlier, ...referral })).toEqual([]);
  });

  it("ignores stages activated after the member was re-routed away", () => {
    const c = fixtureCase("a4", {
      status: "ACTIVE",
      activatedAt: "2026-09-10T10:00:00.000Z",
    });
    expect(
      attributedStages(priya, {
        caseState: c,
        referralCreatedAt: "2026-08-21T00:00:00.000Z",
        supersededAt: "2026-09-04T10:00:00.000Z",
      }),
    ).toEqual([]);
  });
});

describe("stageOutcome", () => {
  it("scores a completed stage inside SLA with partner participation", () => {
    const c = fixtureCase(
      "o1",
      {
        status: "DONE",
        activatedAt: "2026-09-01T10:00:00.000Z",
        completedAt: "2026-09-03T10:00:00.000Z",
      },
      [
        {
          type: "EVIDENCE_SUBMITTED",
          stageKey: "mortgage_path",
          actorRole: "MORTGAGE_PARTNER",
          at: "2026-09-02T10:00:00.000Z",
          payload: "dip_aip",
        },
      ],
    );
    const stage = c.stages.find((s) => s.key === "mortgage_path")!;
    const outcome = stageOutcome(
      priya,
      { caseState: c, ...referral },
      stage,
      new Date("2026-09-20T10:00:00.000Z"),
    );
    expect(outcome).toEqual({
      caseId: "o1",
      stageKey: "mortgage_path",
      days: 2,
      completed: true,
      missed: false,
      breached: false,
      participated: true,
      nudges: 0,
    });
  });

  it("marks an open, silent stage as missed and breached using the member SLA and counts nudges", () => {
    const c = fixtureCase(
      "o2",
      { status: "ACTIVE", activatedAt: "2026-09-01T10:00:00.000Z" },
      [
        {
          type: "PARTNER_NUDGED",
          stageKey: "mortgage_path",
          actorRole: "ADVISOR",
          at: "2026-09-05T10:00:00.000Z",
          payload: "MORTGAGE_PARTNER",
        },
      ],
    );
    const stage = c.stages.find((s) => s.key === "mortgage_path")!;
    const outcome = stageOutcome(
      priya,
      { caseState: c, ...referral },
      stage,
      new Date("2026-09-08T10:00:00.000Z"),
    );
    expect(outcome.days).toBe(7);
    expect(outcome.completed).toBe(false);
    expect(outcome.missed).toBe(true);
    expect(outcome.breached).toBe(true);
    expect(outcome.participated).toBe(false);
    expect(outcome.nudges).toBe(1);
  });

  it("caps time-in-stage at supersededAt after a re-route", () => {
    const c = fixtureCase("o3", {
      status: "ACTIVE",
      activatedAt: "2026-09-01T10:00:00.000Z",
    });
    const stage = c.stages.find((s) => s.key === "mortgage_path")!;
    const outcome = stageOutcome(
      priya,
      {
        caseState: c,
        referralCreatedAt: "2026-08-21T00:00:00.000Z",
        supersededAt: "2026-09-04T10:00:00.000Z",
      },
      stage,
      new Date("2026-09-20T10:00:00.000Z"),
    );
    expect(outcome.days).toBe(3);
    expect(outcome.missed).toBe(true);
    expect(outcome.breached).toBe(false);
  });
});

describe("computeQualityScore / rateScorecard", () => {
  it("starts at 100 and deducts for misses, silence, breaches and nudges", () => {
    expect(
      computeQualityScore({ missRate: 0, participationRate: 1, breaches: 0, nudges: 0 }),
    ).toBe(100);
    expect(
      computeQualityScore({ missRate: 1, participationRate: 0, breaches: 1, nudges: 1 }),
    ).toBe(13);
    expect(
      computeQualityScore({ missRate: 0.5, participationRate: 0.5, breaches: 0, nudges: 0 }),
    ).toBe(60);
    expect(
      computeQualityScore({ missRate: 1, participationRate: 0, breaches: 9, nudges: 9 }),
    ).toBe(0);
  });

  it("rates NO_DATA, STRONG, WATCH and UNDERPERFORMING", () => {
    expect(rateScorecard({ stagesAssigned: 0, qualityScore: 100, breaches: 0 })).toBe("NO_DATA");
    expect(rateScorecard({ stagesAssigned: 2, qualityScore: 80, breaches: 0 })).toBe("STRONG");
    expect(rateScorecard({ stagesAssigned: 2, qualityScore: 60, breaches: 0 })).toBe("WATCH");
    expect(rateScorecard({ stagesAssigned: 2, qualityScore: 40, breaches: 0 })).toBe(
      "UNDERPERFORMING",
    );
    expect(rateScorecard({ stagesAssigned: 4, qualityScore: 80, breaches: 2 })).toBe(
      "UNDERPERFORMING",
    );
  });
});

describe("buildScorecard", () => {
  it("returns NO_DATA with neutral rates when nothing is attributed", () => {
    const card = buildScorecard(priya, [], new Date("2026-09-08T10:00:00.000Z"));
    expect(card).toEqual({
      partnerId: "p_priya",
      roleType: "MORTGAGE_PARTNER",
      stagesAssigned: 0,
      completions: 0,
      openStages: 0,
      missed: 0,
      breaches: 0,
      nudges: 0,
      missRate: 0,
      participationRate: 1,
      avgDaysInStage: null,
      qualityScore: 100,
      rating: "NO_DATA",
      recommendReroute: false,
    });
  });

  it("aggregates across cases and recommends a re-route for underperformers", () => {
    const good = fixtureCase(
      "b1",
      {
        status: "DONE",
        activatedAt: "2026-09-01T10:00:00.000Z",
        completedAt: "2026-09-03T10:00:00.000Z",
      },
      [
        {
          type: "EVIDENCE_SUBMITTED",
          stageKey: "mortgage_path",
          actorRole: "MORTGAGE_PARTNER",
          at: "2026-09-02T10:00:00.000Z",
          payload: "dip_aip",
        },
      ],
    );
    const bad = fixtureCase("b2", {
      status: "ACTIVE",
      activatedAt: "2026-09-01T10:00:00.000Z",
    });
    const now = new Date("2026-09-08T10:00:00.000Z");

    const card = buildScorecard(
      priya,
      [
        { caseState: good, ...referral },
        { caseState: bad, ...referral },
      ],
      now,
    );

    expect(card.stagesAssigned).toBe(2);
    expect(card.completions).toBe(1);
    expect(card.openStages).toBe(1);
    expect(card.missed).toBe(1);
    expect(card.breaches).toBe(1);
    expect(card.missRate).toBe(0.5);
    expect(card.participationRate).toBe(0.5);
    expect(card.avgDaysInStage).toBe(4.5);
    expect(card.qualityScore).toBe(55);
    expect(card.rating).toBe("WATCH");
    expect(card.recommendReroute).toBe(false);

    const onlyBad = buildScorecard(priya, [{ caseState: bad, ...referral }], now);
    expect(onlyBad.rating).toBe("UNDERPERFORMING");
    expect(onlyBad.recommendReroute).toBe(true);
  });
});
