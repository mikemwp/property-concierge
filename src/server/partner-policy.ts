import type { CaseState } from "../domain/stage-engine";
import { getFocusStage } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";

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
