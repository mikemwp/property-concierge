import { canUseWarmIntro } from "../domain/freemium";
import type { CaseState } from "../domain/stage-engine";

export class CockpitPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CockpitPolicyError";
  }
}

export function assertWarmIntro(caseState: CaseState): void {
  if (!canUseWarmIntro(caseState)) {
    throw new CockpitPolicyError("Warm intro requires a paid tier");
  }
}
