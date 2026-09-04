import { canSelfAdvance } from "../domain/freemium";
import type { CaseState } from "../domain/stage-engine";
import { getFocusStage } from "../domain/stage-engine";

export class PortalPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalPolicyError";
  }
}

export function assertPortalSubmit(caseState: CaseState, stageKey: string): void {
  const focus = getFocusStage(caseState);
  if (!focus || focus.key !== stageKey) {
    throw new PortalPolicyError("Forbidden: evidence submit only on current focus stage");
  }

  if (caseState.tier === "PAID_DWY") {
    return;
  }

  if (!canSelfAdvance(caseState, stageKey)) {
    throw new PortalPolicyError(
      "Upgrade to paid required — this stage cannot be self-advanced on the free plan",
    );
  }
}

export function canPortalSubmit(caseState: CaseState, stageKey: string): boolean {
  try {
    assertPortalSubmit(caseState, stageKey);
    return true;
  } catch {
    return false;
  }
}
