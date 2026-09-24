import { randomUUID } from "node:crypto";
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { getFocusStage } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";
import {
  assertOneTimeUpload,
  assertResetReason,
  assertValidVaultFile,
  assertVaultAttachedForSubmit,
  canResetVaultDocument,
  canUploadVaultDocument,
  documentVisibleTo,
  encodeVaultEventPayload,
  partnerReadStageKeys,
  sanitizeVaultFilename,
  VAULT_EVENT_TYPES,
  VaultError,
  vaultStorageKey,
  type VaultActor,
  type VaultDocumentRecord,
} from "../domain/vault";
import { casePack } from "../lib/case-pack";
import {
  findActiveVaultDocument,
  getVaultDocumentById,
  insertVaultDocument,
  listVaultDocuments,
  markVaultDocumentReset,
  writeVaultBytes,
} from "./vault-store";

export type VaultPresenceLookup = {
  hasActiveDocument(caseId: string, stageKey: string, kind: string): Promise<boolean>;
};

export const prismaVaultPresenceLookup: VaultPresenceLookup = {
  async hasActiveDocument(caseId, stageKey, kind) {
    return (await findActiveVaultDocument(caseId, stageKey, kind)) !== null;
  },
};

export const allowAllVaultLookup: VaultPresenceLookup = {
  async hasActiveDocument() {
    return true;
  },
};

export const emptyVaultLookup: VaultPresenceLookup = {
  async hasActiveDocument() {
    return false;
  },
};

export function canUseVault(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "document_vault");
  } catch {
    return false;
  }
}

export function assertVaultEnabled(caseState: CaseState): void {
  if (!canUseVault(caseState)) {
    throw new VaultError(
      "VAULT_DISABLED",
      `Document vault is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export async function assertVaultSubmitAllowed(
  caseState: CaseState,
  stageKey: string,
  kind: string,
  lookup: VaultPresenceLookup = prismaVaultPresenceLookup,
): Promise<void> {
  if (!canUseVault(caseState)) {
    return;
  }
  const hasActiveDocument = await lookup.hasActiveDocument(caseState.id, stageKey, kind);
  assertVaultAttachedForSubmit({ vaultEnabled: true, hasActiveDocument, kind });
}

export function partnerScopeForCase(
  caseState: CaseState,
  partnerRole: ActorRole,
  flags: { assigned: boolean; hasActiveReferral: boolean },
): string[] {
  return partnerReadStageKeys({
    stages: caseState.stages,
    partnerRole,
    assigned: flags.assigned,
    hasActiveReferral: flags.hasActiveReferral,
  });
}

export function visibleVaultDocuments(
  documents: readonly VaultDocumentRecord[],
  viewer: {
    role: ActorRole;
    userId: string;
    tier: CaseState["tier"];
    readStageKeys: readonly string[];
  },
): VaultDocumentRecord[] {
  return documents.filter((doc) => documentVisibleTo(doc, viewer));
}

export type UploadedVaultFile = {
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export async function performVaultUpload(input: {
  caseState: CaseState;
  actor: VaultActor;
  stageKey: string;
  evidenceKind: string;
  file: UploadedVaultFile;
  assigned: boolean;
  now?: Date;
}): Promise<{ caseState: CaseState; document: VaultDocumentRecord }> {
  assertVaultEnabled(input.caseState);
  const stage =
    input.caseState.stages.find((row) => row.key === input.stageKey) ??
    getFocusStage(input.caseState);
  if (!stage || stage.key !== input.stageKey) {
    throw new VaultError("FORBIDDEN", "Unknown stage for vault upload");
  }
  if (
    !canUploadVaultDocument({
      role: input.actor.role,
      tier: input.caseState.tier,
      stageOwnerRole: stage.ownerRole,
      assigned: input.assigned,
      evidenceKind: input.evidenceKind,
      requiredKinds: stage.requiredEvidenceKinds,
    })
  ) {
    throw new VaultError("FORBIDDEN", "Not allowed to upload this vault document");
  }

  const filename = sanitizeVaultFilename(input.file.originalFilename);
  assertValidVaultFile({
    originalFilename: filename,
    mimeType: input.file.mimeType,
    byteSize: input.file.bytes.byteLength,
  });

  const existing = await findActiveVaultDocument(
    input.caseState.id,
    input.stageKey,
    input.evidenceKind,
  );
  assertOneTimeUpload(existing);

  const documentId = randomUUID().replace(/-/g, "").slice(0, 24);
  const storageKey = vaultStorageKey(input.caseState.id, documentId);
  writeVaultBytes(storageKey, input.file.bytes);
  const document = await insertVaultDocument({
    id: documentId,
    caseId: input.caseState.id,
    stageKey: input.stageKey,
    evidenceKind: input.evidenceKind,
    uploadedByRole: input.actor.role,
    uploadedByUserId: input.actor.userId,
    originalFilename: filename,
    mimeType: input.file.mimeType,
    byteSize: input.file.bytes.byteLength,
    storageKey,
  });

  const at = (input.now ?? new Date()).toISOString();
  const caseState: CaseState = {
    ...input.caseState,
    events: [
      ...input.caseState.events,
      {
        type: VAULT_EVENT_TYPES.UPLOADED,
        stageKey: input.stageKey,
        actorRole: input.actor.role,
        at,
        payload: encodeVaultEventPayload({
          documentId: document.id,
          evidenceKind: input.evidenceKind,
          stageKey: input.stageKey,
          filename,
        }),
      },
    ],
  };
  return { caseState, document };
}

export async function performVaultReset(input: {
  caseState: CaseState;
  actor: VaultActor;
  documentId: string;
  reason: string;
  now?: Date;
}): Promise<{ caseState: CaseState; document: VaultDocumentRecord }> {
  assertVaultEnabled(input.caseState);
  if (!canResetVaultDocument(input.actor.role)) {
    throw new VaultError("FORBIDDEN", "Only advisors may reset vault documents");
  }
  assertResetReason(input.reason);
  const existing = await getVaultDocumentById(input.documentId);
  if (!existing || existing.caseId !== input.caseState.id) {
    throw new VaultError("NOT_FOUND", "Vault document not found");
  }
  if (existing.status !== "ACTIVE") {
    throw new VaultError("NOT_FOUND", "Vault document is not active");
  }
  const document = await markVaultDocumentReset(input.documentId);
  const at = (input.now ?? new Date()).toISOString();
  const caseState: CaseState = {
    ...input.caseState,
    events: [
      ...input.caseState.events,
      {
        type: VAULT_EVENT_TYPES.RESET,
        stageKey: existing.stageKey,
        actorRole: input.actor.role,
        at,
        payload: encodeVaultEventPayload({
          documentId: document.id,
          evidenceKind: existing.evidenceKind,
          stageKey: existing.stageKey,
          filename: existing.originalFilename,
          reason: input.reason.trim(),
        }),
      },
    ],
  };
  return { caseState, document };
}

export { listVaultDocuments, findActiveVaultDocument, getVaultDocumentById } from "./vault-store";
