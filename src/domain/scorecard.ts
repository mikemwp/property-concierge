import { daysInStage, escalationLevel, isOverSla } from "./escalation";
import type { PanelMember } from "./panel";
import type { CaseState, StageState } from "./stage-engine";
import type { ActorRole } from "./types";

/**
 * One referral's view of one case. `supersededAt` is set when the advisor re-routed
 * this role away from the member; attribution and time-in-stage stop there.
 */
export type ScorecardAttribution = {
  caseState: CaseState;
  referralCreatedAt: string;
  supersededAt: string | null;
};

export type StageOutcome = {
  caseId: string;
  stageKey: string;
  days: number;
  completed: boolean;
  missed: boolean;
  breached: boolean;
  participated: boolean;
  nudges: number;
};

export type ScorecardRating = "NO_DATA" | "STRONG" | "WATCH" | "UNDERPERFORMING";

/** Spec §4: "Partner quality = time-in-stage, miss rate, completion rate from the same ledger". */
export type PartnerScorecard = {
  partnerId: string;
  roleType: ActorRole;
  stagesAssigned: number;
  completions: number;
  openStages: number;
  missed: number;
  breaches: number;
  nudges: number;
  missRate: number;
  participationRate: number;
  avgDaysInStage: number | null;
  qualityScore: number;
  rating: ScorecardRating;
  recommendReroute: boolean;
};

export type PanelScorecardRow = {
  member: PanelMember;
  scorecard: PartnerScorecard;
};

export function attributedStages(
  member: PanelMember,
  attribution: ScorecardAttribution,
): StageState[] {
  const { caseState, referralCreatedAt, supersededAt } = attribution;
  return caseState.stages.filter((stage) => {
    if (stage.ownerRole !== member.roleType || stage.activatedAt === null) {
      return false;
    }
    if (supersededAt !== null && stage.activatedAt > supersededAt) {
      return false;
    }
    if (stage.completedAt !== null && stage.completedAt < referralCreatedAt) {
      return false;
    }
    return true;
  });
}

function windowEnd(
  stage: StageState,
  supersededAt: string | null,
  now: Date,
): Date {
  const candidates = [stage.completedAt, supersededAt]
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value).getTime());
  if (candidates.length === 0) {
    return now;
  }
  return new Date(Math.min(...candidates));
}

export function stageOutcome(
  member: PanelMember,
  attribution: ScorecardAttribution,
  stage: StageState,
  now: Date,
): StageOutcome {
  const { caseState, supersededAt } = attribution;
  const end = windowEnd(stage, supersededAt, now);
  const completedInWindow =
    stage.status === "DONE" &&
    stage.completedAt !== null &&
    (supersededAt === null || stage.completedAt <= supersededAt);
  const stageEvents = caseState.events.filter((e) => e.stageKey === stage.key);

  return {
    caseId: caseState.id,
    stageKey: stage.key,
    days: daysInStage(stage, end),
    completed: completedInWindow,
    missed: isOverSla(stage, member.slaDays, end),
    breached: escalationLevel(stage, member.slaDays, end) === "BREACH",
    participated: stageEvents.some(
      (e) => e.type === "EVIDENCE_SUBMITTED" && e.actorRole === member.roleType,
    ),
    nudges: stageEvents.filter((e) => e.type === "PARTNER_NUDGED").length,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeQualityScore(input: {
  missRate: number;
  participationRate: number;
  breaches: number;
  nudges: number;
}): number {
  const raw =
    100 -
    50 * input.missRate -
    30 * (1 - input.participationRate) -
    5 * Math.min(input.breaches, 4) -
    2 * Math.min(input.nudges, 5);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function rateScorecard(input: {
  stagesAssigned: number;
  qualityScore: number;
  breaches: number;
}): ScorecardRating {
  if (input.stagesAssigned === 0) {
    return "NO_DATA";
  }
  if (input.qualityScore < 50 || input.breaches >= 2) {
    return "UNDERPERFORMING";
  }
  if (input.qualityScore < 75) {
    return "WATCH";
  }
  return "STRONG";
}

export function summariseOutcomes(
  member: PanelMember,
  outcomes: StageOutcome[],
): PartnerScorecard {
  const stagesAssigned = outcomes.length;
  const completions = outcomes.filter((o) => o.completed).length;
  const missed = outcomes.filter((o) => o.missed).length;
  const breaches = outcomes.filter((o) => o.breached).length;
  const participated = outcomes.filter((o) => o.participated).length;
  const nudges = outcomes.reduce((sum, o) => sum + o.nudges, 0);

  const missRate = stagesAssigned === 0 ? 0 : round2(missed / stagesAssigned);
  const participationRate =
    stagesAssigned === 0 ? 1 : round2(participated / stagesAssigned);
  const avgDaysInStage =
    stagesAssigned === 0
      ? null
      : Math.round(
          (outcomes.reduce((sum, o) => sum + o.days, 0) / stagesAssigned) * 10,
        ) / 10;

  const qualityScore = computeQualityScore({
    missRate,
    participationRate,
    breaches,
    nudges,
  });
  const rating = rateScorecard({ stagesAssigned, qualityScore, breaches });

  return {
    partnerId: member.id,
    roleType: member.roleType,
    stagesAssigned,
    completions,
    openStages: stagesAssigned - completions,
    missed,
    breaches,
    nudges,
    missRate,
    participationRate,
    avgDaysInStage,
    qualityScore,
    rating,
    recommendReroute: rating === "UNDERPERFORMING",
  };
}

export function buildScorecard(
  member: PanelMember,
  attributions: ScorecardAttribution[],
  now: Date,
): PartnerScorecard {
  const outcomes = attributions.flatMap((attribution) =>
    attributedStages(member, attribution).map((stage) =>
      stageOutcome(member, attribution, stage, now),
    ),
  );
  return summariseOutcomes(member, outcomes);
}
