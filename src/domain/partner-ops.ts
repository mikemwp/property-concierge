import {
  getFocusStage,
  StageEngineError,
  type CaseState,
} from "./stage-engine";
import { isPartnerActorRole, type ActorRole } from "./types";

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function requireAdvisor(actorRole: ActorRole, what: string): void {
  if (actorRole !== "ADVISOR") {
    throw new StageEngineError("FORBIDDEN_ROLE", `Only advisors may ${what}`);
  }
}

/** Spec §8: "Partner non-response → nudge + scorecard hit + advisor re-route". The nudge is a ledger event. */
export function nudgePartner(
  caseState: CaseState,
  input: { actorRole: ActorRole; now?: Date },
): CaseState {
  requireAdvisor(input.actorRole, "nudge a partner");

  const focus = getFocusStage(caseState);
  if (!focus) {
    throw new StageEngineError("NO_ACTIVE_STAGE", "No focus stage to nudge");
  }
  if (!isPartnerActorRole(focus.ownerRole)) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Nudges apply only to partner-owned stages",
    );
  }

  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: "PARTNER_NUDGED",
        stageKey: focus.key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: focus.ownerRole,
      },
    ],
  };
}

export function reroutePartner(
  caseState: CaseState,
  input: {
    roleType: ActorRole;
    fromPartnerId: string | null;
    toPartnerId: string;
    actorRole: ActorRole;
    now?: Date;
  },
): CaseState {
  requireAdvisor(input.actorRole, "re-route a partner");

  if (!isPartnerActorRole(input.roleType)) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Re-route applies to partner roles only",
    );
  }
  if (input.fromPartnerId === input.toPartnerId) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Cannot re-route to the same partner",
    );
  }

  const focus = getFocusStage(caseState);
  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: "PARTNER_REROUTED",
        stageKey: focus?.key ?? caseState.stages[0].key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: JSON.stringify({
          roleType: input.roleType,
          fromPartnerId: input.fromPartnerId,
          toPartnerId: input.toPartnerId,
        }),
      },
    ],
  };
}
