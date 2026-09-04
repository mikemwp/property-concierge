import type { ActorRole } from "../domain/types";
import { prisma } from "../lib/db";

export class CaseAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseAccessError";
  }
}

export async function assertCaseAccess(
  userId: string,
  role: ActorRole,
  caseId: string,
): Promise<void> {
  const participant = await prisma.caseParticipant.findUnique({
    where: {
      caseId_userId: {
        caseId,
        userId,
      },
    },
  });

  if (!participant) {
    throw new CaseAccessError("Forbidden: not a participant on this case");
  }

  if (participant.role !== role) {
    throw new CaseAccessError("Forbidden: participant role mismatch");
  }
}

export async function attachPartnerParticipant(
  caseId: string,
  partnerRole: ActorRole,
  preferredUserId?: string | null,
): Promise<void> {
  const user = preferredUserId
    ? await prisma.user.findFirst({
        where: { id: preferredUserId, role: partnerRole },
      })
    : await prisma.user.findFirst({ where: { role: partnerRole } });
  if (!user) {
    return;
  }

  await prisma.caseParticipant.upsert({
    where: {
      caseId_userId: {
        caseId,
        userId: user.id,
      },
    },
    create: {
      caseId,
      userId: user.id,
      role: partnerRole,
    },
    update: {},
  });
}

export async function detachPartnerParticipant(
  caseId: string,
  userId: string,
): Promise<void> {
  await prisma.caseParticipant.deleteMany({ where: { caseId, userId } });
}
