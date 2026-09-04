import type { ActorRole, EntryContext, StageStatus, Tier } from "./types";
import { ewMarketPack, getStageTemplate } from "./market-packs/ew";
import type { MarketPack, StageTemplate } from "./market-packs/types";

export type StageState = {
  key: string;
  title: string;
  sortOrder: number;
  status: StageStatus;
  ownerRole: ActorRole;
  dueAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
  acceptedEvidenceKinds: string[];
};

export type CaseState = {
  id: string;
  marketPackId: string;
  entryContext: EntryContext;
  tier: Tier;
  stages: StageState[];
  events: Array<{
    type: string;
    stageKey: string;
    actorRole: ActorRole;
    at: string;
    payload?: string;
  }>;
};

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function resolveMarketPack(marketPackId: string): MarketPack {
  if (marketPackId === "ew") {
    return ewMarketPack;
  }
  throw new Error(`Unknown market pack: ${marketPackId}`);
}

export function createCase(input: {
  id: string;
  entryContext: EntryContext;
  tier: Tier;
  marketPackId?: string;
  now?: Date;
}): CaseState {
  const marketPackId = input.marketPackId ?? "ew";
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const pack = resolveMarketPack(marketPackId);
  const templates = getStageTemplate(pack, input.entryContext);

  const stages: StageState[] = templates.map((template, index) => {
    const isFirst = index === 0;
    return {
      key: template.key,
      title: template.title,
      sortOrder: index,
      status: isFirst ? "ACTIVE" : "PENDING",
      ownerRole: template.defaultOwnerRole,
      dueAt: isFirst ? addDays(nowIso, template.slaDays) : null,
      activatedAt: isFirst ? nowIso : null,
      completedAt: null,
      blockedReason: null,
      requiredEvidenceKinds: [...template.requiredEvidenceKinds],
      freeVisible: template.freeVisible,
      freeCanSelfAdvance: template.freeCanSelfAdvance,
      acceptedEvidenceKinds: [],
    };
  });

  return {
    id: input.id,
    marketPackId,
    entryContext: input.entryContext,
    tier: input.tier,
    stages,
    events: [
      {
        type: "CASE_CREATED",
        stageKey: stages[0].key,
        actorRole: stages[0].ownerRole,
        at: nowIso,
      },
    ],
  };
}

export function getCurrentStage(caseState: CaseState): StageState | null {
  return caseState.stages.find((s) => s.status === "ACTIVE") ?? null;
}

export type StageEngineErrorCode =
  | "NO_ACTIVE_STAGE"
  | "EVIDENCE_INCOMPLETE"
  | "FORBIDDEN_ROLE"
  | "ALREADY_ACCEPTED"
  | "MULTIPLE_ACTIVE";

export class StageEngineError extends Error {
  constructor(
    public code: StageEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StageEngineError";
  }
}

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function findStage(caseState: CaseState, stageKey: string): StageState | undefined {
  return caseState.stages.find((s) => s.key === stageKey);
}

function getStageTemplateForCase(
  caseState: CaseState,
  stageKey: string,
): StageTemplate | undefined {
  const pack = resolveMarketPack(caseState.marketPackId);
  return getStageTemplate(pack, caseState.entryContext).find((t) => t.key === stageKey);
}

export function assertSingleActive(caseState: CaseState): void {
  const activeCount = caseState.stages.filter((s) => s.status === "ACTIVE").length;
  if (activeCount !== 1) {
    throw new StageEngineError(
      "MULTIPLE_ACTIVE",
      `Expected exactly one ACTIVE stage, found ${activeCount}`,
    );
  }
}

function canSubmitEvidence(caseState: CaseState, actorRole: ActorRole): boolean {
  return caseState.tier === "PAID_DWY" && actorRole === "CLIENT";
}

function canAcceptEvidence(stage: StageState, actorRole: ActorRole): boolean {
  if (actorRole === "ADVISOR") {
    return true;
  }
  return actorRole === stage.ownerRole && actorRole !== "CLIENT";
}

function canAdvanceStage(stage: StageState, actorRole: ActorRole): boolean {
  if (actorRole === "ADVISOR") {
    return true;
  }
  if (stage.freeCanSelfAdvance && actorRole === "CLIENT") {
    return true;
  }
  return actorRole === stage.ownerRole && actorRole !== "CLIENT";
}

function evidenceComplete(stage: StageState): boolean {
  return stage.requiredEvidenceKinds.every((kind) =>
    stage.acceptedEvidenceKinds.includes(kind),
  );
}

function appendEvent(
  caseState: CaseState,
  event: CaseState["events"][number],
): CaseState["events"] {
  return [...caseState.events, event];
}

function updateStage(
  caseState: CaseState,
  stageKey: string,
  updater: (stage: StageState) => StageState,
): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) =>
      stage.key === stageKey ? updater(stage) : stage,
    ),
  };
}

export function submitEvidence(
  caseState: CaseState,
  input: {
    stageKey: string;
    kind: string;
    actorRole: ActorRole;
    now?: Date;
  },
): CaseState {
  const stage = findStage(caseState, input.stageKey);
  if (!stage) {
    throw new StageEngineError("NO_ACTIVE_STAGE", `Stage not found: ${input.stageKey}`);
  }
  if (!canSubmitEvidence(caseState, input.actorRole)) {
    throw new StageEngineError("FORBIDDEN_ROLE", "Only PAID_DWY clients may submit evidence");
  }
  if (!stage.requiredEvidenceKinds.includes(input.kind)) {
    throw new StageEngineError(
      "EVIDENCE_INCOMPLETE",
      `Evidence kind not required for stage: ${input.kind}`,
    );
  }

  const at = nowIso(input.now);
  return {
    ...caseState,
    events: appendEvent(caseState, {
      type: "EVIDENCE_SUBMITTED",
      stageKey: input.stageKey,
      actorRole: input.actorRole,
      at,
      payload: input.kind,
    }),
  };
}

export function acceptEvidence(
  caseState: CaseState,
  input: {
    stageKey: string;
    kind: string;
    actorRole: ActorRole;
    now?: Date;
  },
): CaseState {
  const stage = findStage(caseState, input.stageKey);
  if (!stage) {
    throw new StageEngineError("NO_ACTIVE_STAGE", `Stage not found: ${input.stageKey}`);
  }
  if (!canAcceptEvidence(stage, input.actorRole)) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Only advisor or matching partner may accept evidence",
    );
  }
  if (!stage.requiredEvidenceKinds.includes(input.kind)) {
    throw new StageEngineError(
      "EVIDENCE_INCOMPLETE",
      `Evidence kind not required for stage: ${input.kind}`,
    );
  }
  if (stage.acceptedEvidenceKinds.includes(input.kind)) {
    throw new StageEngineError("ALREADY_ACCEPTED", `Evidence already accepted: ${input.kind}`);
  }

  const at = nowIso(input.now);
  const updated = updateStage(caseState, input.stageKey, (s) => ({
    ...s,
    acceptedEvidenceKinds: [...s.acceptedEvidenceKinds, input.kind],
  }));

  return {
    ...updated,
    events: appendEvent(updated, {
      type: "EVIDENCE_ACCEPTED",
      stageKey: input.stageKey,
      actorRole: input.actorRole,
      at,
      payload: input.kind,
    }),
  };
}

export function advanceStage(
  caseState: CaseState,
  input: { actorRole: ActorRole; now?: Date },
): CaseState {
  const current = getCurrentStage(caseState);
  if (!current) {
    throw new StageEngineError("NO_ACTIVE_STAGE", "No active stage to advance");
  }
  if (!canAdvanceStage(current, input.actorRole)) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Only advisor or authorized role may advance this stage",
    );
  }
  if (!evidenceComplete(current)) {
    throw new StageEngineError(
      "EVIDENCE_INCOMPLETE",
      "Cannot advance: required evidence not all accepted",
    );
  }

  const currentIndex = caseState.stages.findIndex((s) => s.key === current.key);
  const next = caseState.stages[currentIndex + 1];
  if (!next) {
    throw new StageEngineError("NO_ACTIVE_STAGE", "No next stage to activate");
  }

  const template = getStageTemplateForCase(caseState, next.key);
  if (!template) {
    throw new StageEngineError("NO_ACTIVE_STAGE", `Template not found for stage: ${next.key}`);
  }

  const at = nowIso(input.now);
  const stages = caseState.stages.map((stage, index) => {
    if (index === currentIndex) {
      return {
        ...stage,
        status: "DONE" as StageStatus,
        completedAt: at,
      };
    }
    if (index === currentIndex + 1) {
      return {
        ...stage,
        status: "ACTIVE" as StageStatus,
        ownerRole: template.defaultOwnerRole,
        activatedAt: at,
        dueAt: addDays(at, template.slaDays),
        blockedReason: null,
      };
    }
    return stage;
  });

  const nextState: CaseState = {
    ...caseState,
    stages,
    events: appendEvent(caseState, {
      type: "STAGE_ADVANCED",
      stageKey: next.key,
      actorRole: input.actorRole,
      at,
      payload: current.key,
    }),
  };

  assertSingleActive(nextState);
  return nextState;
}

export function blockStage(
  caseState: CaseState,
  input: { reason: string; actorRole: ActorRole; now?: Date },
): CaseState {
  const current = getCurrentStage(caseState);
  if (!current) {
    throw new StageEngineError("NO_ACTIVE_STAGE", "No active stage to block");
  }

  const at = nowIso(input.now);
  const updated = updateStage(caseState, current.key, (stage) => ({
    ...stage,
    status: "BLOCKED",
    blockedReason: input.reason,
  }));

  return {
    ...updated,
    events: appendEvent(updated, {
      type: "STAGE_BLOCKED",
      stageKey: current.key,
      actorRole: input.actorRole,
      at,
      payload: input.reason,
    }),
  };
}

export function pauseStage(
  caseState: CaseState,
  input: { reason: string; actorRole: ActorRole; now?: Date },
): CaseState {
  return blockStage(caseState, {
    ...input,
    reason: input.reason.startsWith("PAUSED:") ? input.reason : `PAUSED:${input.reason}`,
  });
}
