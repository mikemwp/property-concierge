"use server";

import { auth } from "@/lib/auth";
import { StageEngineError, submitEvidence } from "@/domain/stage-engine";
import type { ActorRole } from "@/domain/types";
import { VaultError } from "@/domain/vault";
import { partnerPortForCase } from "@/lib/partner-adapters/registry";
import { PartnerPortError } from "@/lib/partner-port";
import { openTicketForRole } from "@/domain/partner-activity";
import {
  CaseAccessError,
  loadCaseForUser,
  saveCase,
} from "@/server/cases";
import { assertPortalSubmit, PortalPolicyError } from "@/server/portal-policy";
import {
  assertPartnerSubmit,
  isPartnerRole,
  PartnerPolicyError,
} from "@/server/partner-policy";
import { performVaultReset, performVaultUpload } from "@/server/vault";
import { revalidatePath } from "next/cache";
import type { SubmitEvidenceResult } from "@/app/actions/portal";
import type { PartnerActionResult } from "@/app/actions/partner";

export type VaultActionResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof VaultError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError ||
    err instanceof PortalPolicyError ||
    err instanceof PartnerPolicyError ||
    err instanceof PartnerPortError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Vault action failed";
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/portal/cases/${caseId}`);
  revalidatePath("/portal");
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
}

async function readFormFile(formData: FormData): Promise<{
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
}> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new VaultError("INVALID_FILE", "Choose a file to upload");
  }
  return {
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export async function uploadVaultDocumentAction(
  caseId: string,
  stageKey: string,
  kind: string,
  formData: FormData,
): Promise<VaultActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Forbidden" };
  }
  const role = session.user.role as ActorRole;
  try {
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    const assigned = true;
    const file = await readFormFile(formData);
    const result = await performVaultUpload({
      caseState,
      actor: { role, userId: session.user.id },
      stageKey,
      evidenceKind: kind,
      assigned,
      file,
    });
    await saveCase(result.caseState);
    revalidateCasePaths(caseId);
    return { ok: true, documentId: result.document.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function uploadAndSubmitEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
  formData: FormData,
): Promise<SubmitEvidenceResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return { ok: false, error: "Forbidden" };
  }
  try {
    let caseState = await loadCaseForUser(session.user.id, "CLIENT", caseId);
    assertPortalSubmit(caseState, stageKey);
    const file = await readFormFile(formData);
    const uploaded = await performVaultUpload({
      caseState,
      actor: { role: "CLIENT", userId: session.user.id },
      stageKey,
      evidenceKind: kind,
      assigned: true,
      file,
    });
    caseState = uploaded.caseState;
    caseState = submitEvidence(caseState, {
      stageKey,
      kind,
      actorRole: "CLIENT",
      vault: { enabled: true, hasActiveDocument: true },
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function uploadAndSubmitPartnerEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
  formData: FormData,
): Promise<PartnerActionResult> {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!session?.user || !role || !isPartnerRole(role)) {
    return { ok: false, error: "Forbidden" };
  }
  try {
    let caseState = await loadCaseForUser(session.user.id, role, caseId);
    assertPartnerSubmit(caseState, role, stageKey);
    const file = await readFormFile(formData);
    const uploaded = await performVaultUpload({
      caseState,
      actor: { role, userId: session.user.id },
      stageKey,
      evidenceKind: kind,
      assigned: true,
      file,
    });
    await saveCase(uploaded.caseState);
    const ticket = openTicketForRole(uploaded.caseState, role);
    const port = partnerPortForCase(uploaded.caseState, role);
    await port.submitPartnerEvidence({
      caseId,
      role,
      panelMemberId: ticket?.panelMemberId ?? null,
      panelMemberName: ticket?.panelMemberName ?? null,
      stageKey,
      kind,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function resetVaultDocumentAction(
  caseId: string,
  documentId: string,
  reason: string,
): Promise<VaultActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    return { ok: false, error: "Forbidden" };
  }
  try {
    const caseState = await loadCaseForUser(session.user.id, "ADVISOR", caseId);
    const result = await performVaultReset({
      caseState,
      actor: { role: "ADVISOR", userId: session.user.id },
      documentId,
      reason,
    });
    await saveCase(result.caseState);
    revalidateCasePaths(caseId);
    return { ok: true, documentId: result.document.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
