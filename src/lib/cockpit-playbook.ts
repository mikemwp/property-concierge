import {
  ewStagePlaybook,
  type StagePlaybook,
} from "@/domain/market-packs/ew-playbook";
import type { CaseState } from "@/domain/stage-engine";

/**
 * Advisor operating IP. Callers must be inside an advisor-gated surface —
 * guard with assertPlaybookVisible before rendering.
 */
export function advisorPlaybook(
  caseState: CaseState,
  stageKey: string,
): StagePlaybook | null {
  return ewStagePlaybook(stageKey, caseState.entryContext);
}

export type { StagePlaybook };
