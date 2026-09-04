import type { LeadAttribution } from "../domain/attribution";
import { createCase, getFocusStage, type CaseState } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";
import type { EntryContext, Tier } from "../domain/types";
import { prisma } from "../lib/db";
import { assertCaseAccess, CaseAccessError } from "./case-access";
import {
  eventCreateInput,
  stageCreateInput,
  stageUpdateInput,
  toCaseState,
  type CaseWithRelations,
} from "./mappers";

export { CaseAccessError, assertCaseAccess } from "./case-access";
export { attachPartnerParticipant } from "./case-access";

const caseInclude = {
  stages: { include: { evidence: true }, orderBy: { sortOrder: "asc" as const } },
  events: true,
} as const;

function toCaseWithRelations(record: {
  id: string;
  marketPackId: string;
  entryContext: string;
  tier: string;
  title: string;
  leadSource: string;
  leadCampaign: string | null;
  leadReferrer: string | null;
  createdAt: Date;
  updatedAt: Date;
  stages: Array<{
    id: string;
    caseId: string;
    key: string;
    title: string;
    sortOrder: number;
    status: string;
    ownerRole: string;
    dueAt: Date | null;
    activatedAt: Date | null;
    completedAt: Date | null;
    blockedReason: string | null;
    evidence: Array<{ id: string; stageId: string; kind: string; note: string | null; accepted: boolean; createdAt: Date }>;
  }>;
  events: Array<{
    id: string;
    caseId: string;
    stageKey: string;
    type: string;
    actorRole: string;
    payload: string | null;
    createdAt: Date;
  }>;
}): CaseWithRelations {
  return record;
}

export async function createCaseRecord(input: {
  title: string;
  entryContext: EntryContext;
  tier: Tier;
  clientUserId: string;
  advisorUserId: string;
  marketPackId?: string;
  attribution?: LeadAttribution;
}): Promise<CaseState> {
  const marketPackId = input.marketPackId ?? "ew";
  const initialState = createCase({
    id: "pending",
    entryContext: input.entryContext,
    tier: input.tier,
    marketPackId,
    attribution: input.attribution,
  });

  const record = await prisma.case.create({
    data: {
      marketPackId,
      entryContext: input.entryContext,
      tier: input.tier,
      title: input.title,
      leadSource: initialState.attribution.leadSource,
      leadCampaign: initialState.attribution.leadCampaign,
      leadReferrer: initialState.attribution.leadReferrer,
      participants: {
        create: [
          { userId: input.clientUserId, role: "CLIENT" },
          { userId: input.advisorUserId, role: "ADVISOR" },
        ],
      },
      stages: {
        create: initialState.stages.map((stage) => stageCreateInput(stage)),
      },
      events: {
        create: initialState.events.map((event) => ({
          type: event.type,
          stageKey: event.stageKey,
          actorRole: event.actorRole,
          payload: event.payload ?? null,
          createdAt: new Date(event.at),
        })),
      },
    },
    include: caseInclude,
  });

  return toCaseState(toCaseWithRelations(record));
}

export async function loadCase(caseId: string): Promise<CaseState> {
  const record = await prisma.case.findUniqueOrThrow({
    where: { id: caseId },
    include: caseInclude,
  });

  return toCaseState(toCaseWithRelations(record));
}

export async function loadCaseForUser(
  userId: string,
  role: ActorRole,
  caseId: string,
): Promise<CaseState> {
  await assertCaseAccess(userId, role, caseId);
  return loadCase(caseId);
}

export async function saveCase(caseState: CaseState): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseState.id },
      data: {
        marketPackId: caseState.marketPackId,
        entryContext: caseState.entryContext,
        tier: caseState.tier,
      },
    });

    for (const stage of caseState.stages) {
      const dbStage = await tx.stage.update({
        where: {
          caseId_key: {
            caseId: caseState.id,
            key: stage.key,
          },
        },
        data: stageUpdateInput(stage),
        include: { evidence: true },
      });

      for (const kind of stage.requiredEvidenceKinds) {
        const accepted = stage.acceptedEvidenceKinds.includes(kind);
        const submitted = stage.submittedEvidenceKinds.includes(kind);
        const existing = dbStage.evidence.find((row) => row.kind === kind);

        if (existing) {
          if (existing.accepted !== accepted) {
            await tx.evidence.update({
              where: { id: existing.id },
              data: { accepted },
            });
          }
          continue;
        }

        if (accepted || submitted) {
          await tx.evidence.create({
            data: {
              stageId: dbStage.id,
              kind,
              accepted,
            },
          });
        }
      }
    }

    const existingEvents = await tx.stageEvent.findMany({
      where: { caseId: caseState.id },
      orderBy: { createdAt: "asc" },
    });
    const newEvents = caseState.events.slice(existingEvents.length);
    if (newEvents.length > 0) {
      await tx.stageEvent.createMany({
        data: newEvents.map((event) => eventCreateInput(caseState.id, event)),
      });
    }
  });
}

export async function listCasesForUser(
  userId: string,
): Promise<Array<{ id: string; title: string; tier: string }>> {
  const participants = await prisma.caseParticipant.findMany({
    where: { userId },
    include: { case: true },
    orderBy: { case: { updatedAt: "desc" } },
  });

  return participants.map((participant) => ({
    id: participant.case.id,
    title: participant.case.title,
    tier: participant.case.tier,
  }));
}

export async function listCasesForPartnerRole(
  userId: string,
  partnerRole: ActorRole,
): Promise<
  Array<{ id: string; title: string; tier: string; focusStageKey: string }>
> {
  const participants = await prisma.caseParticipant.findMany({
    where: { userId },
    include: {
      case: {
        include: caseInclude,
      },
    },
    orderBy: { case: { updatedAt: "desc" } },
  });

  return participants
    .map((participant) => {
      const caseState = toCaseState(toCaseWithRelations(participant.case));
      const focus = getFocusStage(caseState);
      if (!focus || focus.ownerRole !== partnerRole) {
        return null;
      }
      return {
        id: participant.case.id,
        title: participant.case.title,
        tier: participant.case.tier,
        focusStageKey: focus.key,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
