import type { CaseMessage } from "@prisma/client";
import type { ActorRole } from "../domain/types";
import type { CaseMessageRecord } from "../domain/threads";
import { prisma } from "../lib/db";

export function toCaseMessageRecord(
  row: CaseMessage,
  authorName: string | null,
): CaseMessageRecord {
  return {
    id: row.id,
    caseId: row.caseId,
    authorUserId: row.authorUserId,
    authorRole: row.authorRole as ActorRole,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorName,
  };
}

async function namesFor(userIds: string[]): Promise<Map<string, string | null>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name ?? null]));
}

export async function insertCaseMessage(input: {
  id?: string;
  caseId: string;
  authorUserId: string;
  authorRole: ActorRole;
  body: string;
  createdAt?: Date;
}): Promise<CaseMessageRecord> {
  const row = await prisma.caseMessage.create({
    data: {
      id: input.id,
      caseId: input.caseId,
      authorUserId: input.authorUserId,
      authorRole: input.authorRole,
      body: input.body,
      createdAt: input.createdAt,
    },
  });
  const names = await namesFor([row.authorUserId]);
  return toCaseMessageRecord(row, names.get(row.authorUserId) ?? null);
}

export async function listCaseMessages(caseId: string): Promise<CaseMessageRecord[]> {
  const rows = await prisma.caseMessage.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });
  const names = await namesFor(rows.map((row) => row.authorUserId));
  return rows.map((row) => toCaseMessageRecord(row, names.get(row.authorUserId) ?? null));
}

export async function getCaseMessageById(id: string): Promise<CaseMessageRecord | null> {
  const row = await prisma.caseMessage.findUnique({ where: { id } });
  if (!row) {
    return null;
  }
  const names = await namesFor([row.authorUserId]);
  return toCaseMessageRecord(row, names.get(row.authorUserId) ?? null);
}
