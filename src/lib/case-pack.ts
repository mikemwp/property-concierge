import { resolveMarketPack } from "@/domain/market-packs/registry";
import { stageTemplateFor, type MarketPack } from "@/domain/market-packs/types";
import type { CaseState } from "@/domain/stage-engine";

/** The one place a surface turns a case into its market pack. Throws MarketPackError. */
export function casePack(caseState: CaseState): MarketPack {
  return resolveMarketPack(caseState.marketPackId);
}

/** Falls back to a one-week cadence only for stage keys the pack does not define. */
export function stageSlaDays(caseState: CaseState, stageKey: string): number {
  return (
    stageTemplateFor(casePack(caseState), caseState.entryContext, stageKey)?.slaDays ?? 7
  );
}
