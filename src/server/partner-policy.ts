import type { CaseState } from "../domain/stage-engine";
import { getFocusStage } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";
import { canUseWarmIntro } from "../domain/freemium";
import { isModuleEnabled } from "../domain/market-packs/types";
import { casePack } from "../lib/case-pack";

export class PartnerPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerPolicyError";
  }
}

const PARTNER_ROLES: ActorRole[] = [
  "MORTGAGE_PARTNER",
  "CONVEYANCER",
  "MOVE_PARTNER",
];

export function isPartnerRole(role: ActorRole): boolean {
  return PARTNER_ROLES.includes(role);
}

export function assertPartnerSubmit(
  caseState: CaseState,
  role: ActorRole,
  stageKey: string,
): void {
  if (!isPartnerRole(role)) {
    throw new PartnerPolicyError("Forbidden: not a partner role");
  }

  const focus = getFocusStage(caseState);
  if (!focus || focus.key !== stageKey) {
    throw new PartnerPolicyError(
      "Forbidden: evidence submit only on current focus stage",
    );
  }

  if (focus.ownerRole !== role) {
    throw new PartnerPolicyError(
      `Forbidden: stage owner is ${focus.ownerRole}, not ${role}`,
    );
  }

  if (focus.status !== "ACTIVE" && focus.status !== "BLOCKED") {
    throw new PartnerPolicyError(
      "Forbidden: partner may submit only on ACTIVE or BLOCKED focus stages",
    );
  }
}

export function canPartnerSubmit(
  caseState: CaseState,
  role: ActorRole,
  stageKey: string,
): boolean {
  try {
    assertPartnerSubmit(caseState, role, stageKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spec §9 Phase 2. Rails need the market to have them (pack flag) and the household
 * to be paying for orchestration (tier). Nothing here produces a client guarantee.
 */
export function canUseSpeedRails(caseState: CaseState): boolean {
  if (!canUseWarmIntro(caseState)) {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "partner_speed_rails");
  } catch {
    return false;
  }
}

export function assertSpeedRails(caseState: CaseState): void {
  if (!canUseWarmIntro(caseState)) {
    throw new PartnerPolicyError("Partner speed rails require a paid Done-With-You case");
  }
  if (!isModuleEnabled(casePack(caseState).flags, "partner_speed_rails")) {
    throw new PartnerPolicyError(
      `Partner speed rails are not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}
