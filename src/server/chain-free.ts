import {
  applyCertificationOverride,
  assessCertification,
  ChainFreeError,
  partnerSignalsFrom,
  type ChainFreeCertification,
  type ChainFreeOverrideAction,
  type PartnerParticipationSignal,
} from "../domain/chain-free";
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { casePack } from "../lib/case-pack";
import { listReferralsForCase } from "./referrals";
import { loadPanelScorecards } from "./scorecards";

export type LoadedCertification = {
  certification: ChainFreeCertification;
  partnerSignals: PartnerParticipationSignal[];
};

export function canUseChainFree(caseState: CaseState): boolean {
  try {
    return isModuleEnabled(casePack(caseState).flags, "chain_free_inventory");
  } catch {
    return false;
  }
}

export function assertChainFree(caseState: CaseState): void {
  if (!canUseChainFree(caseState)) {
    throw new ChainFreeError(
      "MODULE_OFF",
      `Chain-free overlay is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export async function loadCertification(
  caseState: CaseState,
  now: Date = new Date(),
): Promise<LoadedCertification> {
  const referrals = await listReferralsForCase(caseState.id);
  const rows = await loadPanelScorecards(now);
  const partnerSignals = partnerSignalsFrom({
    caseState,
    referrals: referrals.map((row) => ({
      partnerId: row.partnerId,
      partnerRole: row.partnerRole,
      supersededAt: row.supersededAt,
    })),
    scorecards: rows.map((row) => ({
      partnerId: row.member.id,
      rating: row.scorecard.rating,
      participationRate: row.scorecard.participationRate,
    })),
  });
  return {
    partnerSignals,
    certification: assessCertification({
      caseState,
      moduleEnabled: canUseChainFree(caseState),
      partnerSignals,
    }),
  };
}

export function performCertificationOverride(
  caseState: CaseState,
  input: {
    action: ChainFreeOverrideAction;
    reason: string;
    partnerSignals: PartnerParticipationSignal[];
    now?: Date;
  },
): CaseState {
  assertChainFree(caseState);
  return applyCertificationOverride(caseState, {
    action: input.action,
    reason: input.reason,
    actorRole: "ADVISOR",
    now: input.now,
    moduleEnabled: true,
    partnerSignals: input.partnerSignals,
  });
}
