import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VaultDocument } from "@prisma/client";
import type { ActorRole } from "../domain/types";
import {
  assertSafeStorageKey,
  isVaultDocumentStatus,
  type VaultDocumentRecord,
} from "../domain/vault";
import { prisma } from "../lib/db";

export function vaultRoot(): string {
  return process.env.VAULT_ROOT ?? path.join(process.cwd(), "var", "vault");
}

export function toVaultDocumentRecord(row: VaultDocument): VaultDocumentRecord {
  if (!isVaultDocumentStatus(row.status)) {
    throw new Error(`Unknown vault status: ${row.status}`);
  }
  return {
    id: row.id,
    caseId: row.caseId,
    stageKey: row.stageKey,
    evidenceKind: row.evidenceKind,
    uploadedByRole: row.uploadedByRole as ActorRole,
    uploadedByUserId: row.uploadedByUserId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    storageKey: row.storageKey,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function absolutePath(storageKey: string): string {
  assertSafeStorageKey(storageKey);
  return path.join(vaultRoot(), ...storageKey.split("/"));
}

export function writeVaultBytes(storageKey: string, bytes: Uint8Array): void {
  const full = absolutePath(storageKey);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, bytes);
}

export function readVaultBytes(storageKey: string): Uint8Array {
  return new Uint8Array(readFileSync(absolutePath(storageKey)));
}

export async function findActiveVaultDocument(
  caseId: string,
  stageKey: string,
  evidenceKind: string,
): Promise<VaultDocumentRecord | null> {
  const row = await prisma.vaultDocument.findFirst({
    where: { caseId, stageKey, evidenceKind, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return row ? toVaultDocumentRecord(row) : null;
}

export async function listVaultDocuments(caseId: string): Promise<VaultDocumentRecord[]> {
  const rows = await prisma.vaultDocument.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toVaultDocumentRecord);
}

export async function insertVaultDocument(input: {
  id: string;
  caseId: string;
  stageKey: string;
  evidenceKind: string;
  uploadedByRole: ActorRole;
  uploadedByUserId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
}): Promise<VaultDocumentRecord> {
  const row = await prisma.vaultDocument.create({
    data: {
      id: input.id,
      caseId: input.caseId,
      stageKey: input.stageKey,
      evidenceKind: input.evidenceKind,
      uploadedByRole: input.uploadedByRole,
      uploadedByUserId: input.uploadedByUserId,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      storageKey: input.storageKey,
      status: "ACTIVE",
    },
  });
  return toVaultDocumentRecord(row);
}

export async function markVaultDocumentReset(documentId: string): Promise<VaultDocumentRecord> {
  const row = await prisma.vaultDocument.update({
    where: { id: documentId },
    data: { status: "RESET" },
  });
  return toVaultDocumentRecord(row);
}

export async function getVaultDocumentById(documentId: string): Promise<VaultDocumentRecord | null> {
  const row = await prisma.vaultDocument.findUnique({ where: { id: documentId } });
  return row ? toVaultDocumentRecord(row) : null;
}
