import {
  applyClientSlaAction,
  assessClientSla,
  ClientSlaError,
  slaSignalsFrom,
  type ClientSlaAction,
  type ClientSlaCommitment,
  type SlaScorecardSignal,
} from "../domain/client-sla";
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { casePack } from "../lib/case-pack";
import { listReferralsForCase } from "./referrals";
import { loadPanelScorecards } from "./scorecards";

export type LoadedClientSla = {
  commitment: ClientSlaCommitment;
  partnerSignals: SlaScorecardSignal[];
};

export function canUseClientSla(caseState: CaseState): boolean {
  try {
    return isModuleEnabled(casePack(caseState).flags, "hard_client_sla");
  } catch {
    return false;
  }
}

export function assertClientSla(caseState: CaseState): void {
  if (!canUseClientSla(caseState)) {
    throw new ClientSlaError(
      "MODULE_OFF",
      `Client SLA overlay is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export async function loadClientSla(caseState: CaseState): Promise<LoadedClientSla> {
  const referrals = await listReferralsForCase(caseState.id);
  const rows = await loadPanelScorecards(new Date());
  const partnerSignals = slaSignalsFrom({
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
    commitment: assessClientSla({
      caseState,
      moduleEnabled: canUseClientSla(caseState),
      partnerSignals,
    }),
  };
}

export function performClientSlaAction(
  caseState: CaseState,
  input: {
    action: ClientSlaAction;
    targetDate: string | null;
    reason: string;
    partnerSignals: SlaScorecardSignal[];
    now?: Date;
  },
): CaseState {
  assertClientSla(caseState);
  return applyClientSlaAction(caseState, {
    action: input.action,
    targetDate: input.targetDate,
    reason: input.reason,
    actorRole: "ADVISOR",
    now: input.now,
    moduleEnabled: true,
    partnerSignals: input.partnerSignals,
  });
}
