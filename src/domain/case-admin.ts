import { ewMarketPack, getStageTemplate } from "./market-packs/ew";
import {
  getFocusStage,
  StageEngineError,
  type CaseState,
} from "./stage-engine";
import type { ActorRole, EntryContext } from "./types";

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function requireAdvisor(actorRole: ActorRole, what: string): void {
  if (actorRole !== "ADVISOR") {
    throw new StageEngineError("FORBIDDEN_ROLE", `Only advisors may ${what}`);
  }
}

export function upgradeToPaid(
  caseState: CaseState,
  input: { actorRole: ActorRole; now?: Date },
): CaseState {
  requireAdvisor(input.actorRole, "upgrade a case");

  if (caseState.tier === "PAID_DWY") {
    throw new StageEngineError(
      "ALREADY_PAID",
      "Case is already on the paid Done-With-You tier",
    );
  }

  const focus = getFocusStage(caseState);
  return {
    ...caseState,
    tier: "PAID_DWY",
    events: [
      ...caseState.events,
      {
        type: "CASE_UPGRADED",
        stageKey: focus?.key ?? caseState.stages[0].key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: "FREE_DIY->PAID_DWY",
      },
    ],
  };
}

export function setEntryContext(
  caseState: CaseState,
  input: { entryContext: EntryContext; actorRole: ActorRole; now?: Date },
): CaseState {
  requireAdvisor(input.actorRole, "change the entry context");

  if (caseState.entryContext === input.entryContext) {
    return caseState;
  }

  const offerStage = caseState.stages.find((s) => s.key === "offer_instruct");
  if (offerStage && offerStage.status !== "PENDING") {
    throw new StageEngineError(
      "ENTRY_LOCKED",
      "Entry context is locked once the offer stage has started",
    );
  }

  const templates = getStageTemplate(ewMarketPack, input.entryContext);

  const stages = caseState.stages.map((stage) => {
    const template = templates.find((t) => t.key === stage.key);
    if (!template) {
      return stage;
    }
    const required = [...template.requiredEvidenceKinds];
    return {
      ...stage,
      requiredEvidenceKinds: required,
      acceptedEvidenceKinds: stage.acceptedEvidenceKinds.filter((kind) =>
        required.includes(kind),
      ),
      submittedEvidenceKinds: stage.submittedEvidenceKinds.filter((kind) =>
        required.includes(kind),
      ),
    };
  });

  const focus = getFocusStage(caseState);

  return {
    ...caseState,
    entryContext: input.entryContext,
    stages,
    events: [
      ...caseState.events,
      {
        type: "ENTRY_CONTEXT_CHANGED",
        stageKey: focus?.key ?? caseState.stages[0].key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: `${caseState.entryContext}->${input.entryContext}`,
      },
    ],
  };
}
