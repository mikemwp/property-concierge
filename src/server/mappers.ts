import type { Case, Evidence, Stage, StageEvent } from "@prisma/client";
import { DEFAULT_ATTRIBUTION, isLeadSource, type LeadAttribution } from "../domain/attribution";
import type { CaseState, StageState } from "../domain/stage-engine";
import { ewMarketPack, getStageTemplate } from "../domain/market-packs/ew";
import type { ActorRole, EntryContext, StageStatus, Tier } from "../domain/types";

export type CaseWithRelations = Case & {
  stages: (Stage & { evidence: Evidence[] })[];
  events: StageEvent[];
};

function resolveTemplates(marketPackId: string, entryContext: EntryContext) {
  if (marketPackId !== "ew") {
    throw new Error(`Unknown market pack: ${marketPackId}`);
  }
  return getStageTemplate(ewMarketPack, entryContext);
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toAttribution(record: {
  leadSource: string;
  leadCampaign: string | null;
  leadReferrer: string | null;
}): LeadAttribution {
  return {
    leadSource: isLeadSource(record.leadSource)
      ? record.leadSource
      : DEFAULT_ATTRIBUTION.leadSource,
    leadCampaign: record.leadCampaign,
    leadReferrer: record.leadReferrer,
  };
}

export function toStageState(
  stage: Stage & { evidence: Evidence[] },
  templateByKey: Map<string, { requiredEvidenceKinds: string[]; freeVisible: boolean; freeCanSelfAdvance: boolean }>,
): StageState {
  const template = templateByKey.get(stage.key);
  const acceptedEvidenceKinds = stage.evidence.filter((row) => row.accepted).map((row) => row.kind);
  const submittedEvidenceKinds = stage.evidence
    .filter((row) => !row.accepted)
    .map((row) => row.kind);

  return {
    key: stage.key,
    title: stage.title,
    sortOrder: stage.sortOrder,
    status: stage.status as StageStatus,
    ownerRole: stage.ownerRole as ActorRole,
    dueAt: toIso(stage.dueAt),
    activatedAt: toIso(stage.activatedAt),
    completedAt: toIso(stage.completedAt),
    blockedReason: stage.blockedReason,
    requiredEvidenceKinds: template ? [...template.requiredEvidenceKinds] : [],
    freeVisible: template?.freeVisible ?? false,
    freeCanSelfAdvance: template?.freeCanSelfAdvance ?? false,
    acceptedEvidenceKinds,
    submittedEvidenceKinds,
  };
}

export function toCaseState(record: CaseWithRelations): CaseState {
  const entryContext = record.entryContext as EntryContext;
  const templates = resolveTemplates(record.marketPackId, entryContext);
  const templateByKey = new Map(
    templates.map((template) => [
      template.key,
      {
        requiredEvidenceKinds: template.requiredEvidenceKinds,
        freeVisible: template.freeVisible,
        freeCanSelfAdvance: template.freeCanSelfAdvance,
      },
    ]),
  );

  return {
    id: record.id,
    marketPackId: record.marketPackId,
    entryContext,
    tier: record.tier as Tier,
    attribution: toAttribution(record),
    stages: [...record.stages]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((stage) => toStageState(stage, templateByKey)),
    events: [...record.events]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((event) => ({
        type: event.type,
        stageKey: event.stageKey,
        actorRole: event.actorRole as ActorRole,
        at: event.createdAt.toISOString(),
        payload: event.payload ?? undefined,
      })),
  };
}

export function stageCreateInput(stage: StageState) {
  return {
    key: stage.key,
    title: stage.title,
    sortOrder: stage.sortOrder,
    status: stage.status,
    ownerRole: stage.ownerRole,
    dueAt: stage.dueAt ? new Date(stage.dueAt) : null,
    activatedAt: stage.activatedAt ? new Date(stage.activatedAt) : null,
    completedAt: stage.completedAt ? new Date(stage.completedAt) : null,
    blockedReason: stage.blockedReason,
    evidence: {
      create: stage.acceptedEvidenceKinds.map((kind) => ({
        kind,
        accepted: true,
      })),
    },
  };
}

export function stageUpdateInput(stage: StageState) {
  return {
    status: stage.status,
    ownerRole: stage.ownerRole,
    dueAt: stage.dueAt ? new Date(stage.dueAt) : null,
    activatedAt: stage.activatedAt ? new Date(stage.activatedAt) : null,
    completedAt: stage.completedAt ? new Date(stage.completedAt) : null,
    blockedReason: stage.blockedReason,
  };
}

export function eventCreateInput(caseId: string, event: CaseState["events"][number]) {
  return {
    caseId,
    type: event.type,
    stageKey: event.stageKey,
    actorRole: event.actorRole,
    payload: event.payload ?? null,
    createdAt: new Date(event.at),
  };
}
