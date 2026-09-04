import { daysInStage as utcDaysInStage } from "./escalation";
import type { CaseState } from "./stage-engine";
import { getFocusStage } from "./stage-engine";
import type { ActorRole, StageStatus } from "./types";

export type PublicStageView = {
  key: string;
  title: string;
  status: StageStatus;
  ownerRole: ActorRole | null;
  daysInStage: number | null;
  isCurrent: boolean;
  limited: boolean;
};

function findStage(caseState: CaseState, stageKey: string) {
  return caseState.stages.find((s) => s.key === stageKey);
}

function isFreeTier(caseState: CaseState): boolean {
  return caseState.tier === "FREE_DIY";
}

function isSimpleFreeAdvanceableCurrent(
  caseState: CaseState,
  stageKey: string,
): boolean {
  const focus = getFocusStage(caseState);
  if (!focus || focus.key !== stageKey) {
    return false;
  }
  const stage = findStage(caseState, stageKey);
  return stage?.freeCanSelfAdvance === true;
}

export function canViewStage(caseState: CaseState, stageKey: string): boolean {
  const stage = findStage(caseState, stageKey);
  if (!stage) {
    return false;
  }
  if (isFreeTier(caseState)) {
    return stage.freeVisible;
  }
  return true;
}

export function canSelfAdvance(caseState: CaseState, stageKey: string): boolean {
  const stage = findStage(caseState, stageKey);
  if (!stage) {
    return false;
  }
  if (!stage.freeCanSelfAdvance) {
    return false;
  }
  if (isFreeTier(caseState)) {
    return isSimpleFreeAdvanceableCurrent(caseState, stageKey);
  }
  return stage.freeCanSelfAdvance;
}

export function canUseWarmIntro(caseState: CaseState): boolean {
  return caseState.tier === "PAID_DWY";
}

export function canViewSlaPressure(caseState: CaseState): boolean {
  return caseState.tier === "PAID_DWY";
}

export function canViewPlaybook(caseState: CaseState, stageKey: string): boolean {
  if (isFreeTier(caseState)) {
    return false;
  }
  return findStage(caseState, stageKey) !== undefined;
}

export function clientStageView(
  caseState: CaseState,
  now: Date = new Date(),
): PublicStageView[] {
  const focus = getFocusStage(caseState);

  return caseState.stages.map((stage) => {
    const isCurrent = focus?.key === stage.key;
    const limited = isFreeTier(caseState) && !stage.freeCanSelfAdvance;
    const showFullFreeDetail =
      !isFreeTier(caseState) ||
      (!limited && stage.freeVisible) ||
      isSimpleFreeAdvanceableCurrent(caseState, stage.key);

    let status = stage.status;
    if (limited && !isSimpleFreeAdvanceableCurrent(caseState, stage.key)) {
      status = "PENDING";
    }

    return {
      key: stage.key,
      title: stage.title,
      status,
      ownerRole: showFullFreeDetail ? stage.ownerRole : null,
      daysInStage: showFullFreeDetail ? utcDaysInStage(stage, now) : null,
      isCurrent,
      limited,
    };
  });
}
