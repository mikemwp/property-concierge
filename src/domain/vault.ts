import { isPartnerActorRole, type ActorRole, type Tier } from "./types";

export const VAULT_DOCUMENT_STATUSES = ["ACTIVE", "RESET"] as const;
export type VaultDocumentStatus = (typeof VAULT_DOCUMENT_STATUSES)[number];

export function isVaultDocumentStatus(value: string): value is VaultDocumentStatus {
  return (VAULT_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export type VaultErrorCode =
  | "VAULT_DISABLED"
  | "VAULT_REQUIRED"
  | "ONE_TIME_UPLOAD"
  | "FORBIDDEN"
  | "FREE_TIER"
  | "INVALID_FILE"
  | "NOT_FOUND";

export class VaultError extends Error {
  constructor(
    public code: VaultErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VaultError";
  }
}

export type VaultDocumentRecord = {
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
  status: VaultDocumentStatus;
  createdAt: string;
};

export type VaultActor = {
  role: ActorRole;
  userId: string;
};

export type VaultPermission = "NONE" | "READ" | "UPLOAD" | "RESET";

export type VaultSubmitContext = {
  vaultEnabled: boolean;
  hasActiveDocument: boolean;
  kind: string;
};

export const VAULT_EVENT_TYPES = {
  UPLOADED: "VAULT_DOCUMENT_UPLOADED",
  RESET: "VAULT_DOCUMENT_RESET",
} as const;

export type VaultEventPayload = {
  documentId: string;
  evidenceKind: string;
  stageKey: string;
  filename: string;
  reason?: string;
};

export const MIN_VAULT_RESET_REASON_LENGTH = 8;
export const VAULT_MAX_BYTES = 10 * 1024 * 1024;
export const VAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function vaultPermission(input: { role: ActorRole; tier: Tier }): VaultPermission {
  if (input.role === "ADVISOR") {
    return "RESET";
  }
  if (input.tier !== "PAID_DWY") {
    return "NONE";
  }
  if (input.role === "CLIENT" || isPartnerActorRole(input.role)) {
    return "UPLOAD";
  }
  return "NONE";
}

export function canResetVaultDocument(role: ActorRole): boolean {
  return role === "ADVISOR";
}

export function canUploadVaultDocument(input: {
  role: ActorRole;
  tier: Tier;
  stageOwnerRole: ActorRole;
  assigned: boolean;
  evidenceKind: string;
  requiredKinds: readonly string[];
}): boolean {
  if (input.tier !== "PAID_DWY") {
    return false;
  }
  if (!input.assigned) {
    return false;
  }
  if (!input.requiredKinds.includes(input.evidenceKind)) {
    return false;
  }
  if (input.role === "CLIENT") {
    return input.stageOwnerRole === "CLIENT";
  }
  if (isPartnerActorRole(input.role)) {
    return input.stageOwnerRole === input.role;
  }
  return false;
}

export function partnerReadStageKeys(input: {
  stages: ReadonlyArray<{ key: string; ownerRole: ActorRole }>;
  partnerRole: ActorRole;
  assigned: boolean;
  hasActiveReferral: boolean;
}): string[] {
  if (!isPartnerActorRole(input.partnerRole)) {
    return [];
  }
  if (!input.assigned && !input.hasActiveReferral) {
    return [];
  }
  return input.stages.filter((stage) => stage.ownerRole === input.partnerRole).map((stage) => stage.key);
}

export function documentVisibleTo(
  doc: VaultDocumentRecord,
  viewer: {
    role: ActorRole;
    userId: string;
    tier: Tier;
    readStageKeys: readonly string[];
  },
): boolean {
  if (viewer.role === "ADVISOR") {
    return true;
  }
  if (viewer.tier !== "PAID_DWY") {
    return false;
  }
  if (viewer.role === "CLIENT") {
    return doc.uploadedByUserId === viewer.userId;
  }
  if (isPartnerActorRole(viewer.role)) {
    return viewer.readStageKeys.includes(doc.stageKey);
  }
  return false;
}

export function assertOneTimeUpload(existing: VaultDocumentRecord | null): void {
  if (existing && existing.status === "ACTIVE") {
    throw new VaultError(
      "ONE_TIME_UPLOAD",
      "A vault file is already attached; advisor must reset before replace",
    );
  }
}

export function assertVaultAttachedForSubmit(ctx: VaultSubmitContext): void {
  if (!ctx.vaultEnabled) {
    return;
  }
  if (!ctx.hasActiveDocument) {
    throw new VaultError(
      "VAULT_REQUIRED",
      `Vault document required for evidence kind: ${ctx.kind}`,
    );
  }
}

export function sanitizeVaultFilename(name: string): string {
  const clipped = name.replace(/[/\\]/g, "").replace(/\0/g, "").trim().slice(0, 200);
  if (!clipped || clipped === "." || clipped === "..") {
    throw new VaultError("INVALID_FILE", "Filename is not allowed");
  }
  return clipped;
}

export function assertValidVaultFile(input: {
  originalFilename: string;
  mimeType: string;
  byteSize: number;
}): void {
  sanitizeVaultFilename(input.originalFilename);
  if (!(VAULT_ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new VaultError("INVALID_FILE", `MIME type is not allowed: ${input.mimeType}`);
  }
  if (input.byteSize <= 0 || input.byteSize > VAULT_MAX_BYTES) {
    throw new VaultError("INVALID_FILE", `File size must be between 1 and ${VAULT_MAX_BYTES} bytes`);
  }
}

export function vaultStorageKey(caseId: string, documentId: string): string {
  if (!SAFE_ID.test(caseId) || !SAFE_ID.test(documentId)) {
    throw new VaultError("INVALID_FILE", "Storage key ids must be alphanumeric");
  }
  return `${caseId}/${documentId}`;
}

export function assertSafeStorageKey(storageKey: string): void {
  const parts = storageKey.split("/");
  if (parts.length !== 2 || parts.some((part) => !SAFE_ID.test(part))) {
    throw new VaultError("INVALID_FILE", "Storage key is not safe");
  }
}

export function assertResetReason(reason: string): void {
  if (reason.trim().length < MIN_VAULT_RESET_REASON_LENGTH) {
    throw new VaultError(
      "INVALID_FILE",
      `Reset reason must be at least ${MIN_VAULT_RESET_REASON_LENGTH} characters`,
    );
  }
}

export function encodeVaultEventPayload(payload: VaultEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeVaultEventPayload(raw: string | undefined): VaultEventPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<VaultEventPayload>;
    if (
      typeof parsed.documentId !== "string" ||
      typeof parsed.evidenceKind !== "string" ||
      typeof parsed.stageKey !== "string" ||
      typeof parsed.filename !== "string"
    ) {
      return null;
    }
    return {
      documentId: parsed.documentId,
      evidenceKind: parsed.evidenceKind,
      stageKey: parsed.stageKey,
      filename: parsed.filename,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch {
    return null;
  }
}
