import { stagePlaybook, type StagePlaybook } from "@/domain/market-packs/types";
import { casePack } from "@/lib/case-pack";
import type { CaseState } from "@/domain/stage-engine";

/**
 * Advisor operating IP. Callers must be inside an advisor-gated surface —
 * guard with assertPlaybookVisible before rendering.
 */
export function advisorPlaybook(
  caseState: CaseState,
  stageKey: string,
): StagePlaybook | null {
  return stagePlaybook(casePack(caseState), stageKey, caseState.entryContext);
}

export type { StagePlaybook };
