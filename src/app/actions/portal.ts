"use server";

import { auth } from "@/lib/auth";
import {
  attestEvidence,
  submitEvidence,
  StageEngineError,
} from "@/domain/stage-engine";
import { VaultError } from "@/domain/vault";
import {
  CaseAccessError,
  loadCaseForUser,
  saveCase,
} from "@/server/cases";
import {
  assertPortalSubmit,
  PortalPolicyError,
} from "@/server/portal-policy";
import {
  assertVaultSubmitAllowed,
  canUseVault,
  prismaVaultPresenceLookup,
} from "@/server/vault";
import { revalidatePath } from "next/cache";

export type SubmitEvidenceResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
): Promise<SubmitEvidenceResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return { ok: false, error: "Forbidden" };
  }

  try {
    let caseState = await loadCaseForUser(
      session.user.id,
      "CLIENT",
      caseId,
    );
    assertPortalSubmit(caseState, stageKey);

    if (caseState.tier === "PAID_DWY") {
      await assertVaultSubmitAllowed(caseState, stageKey, kind);
      const vaultEnabled = canUseVault(caseState);
      const hasActiveDocument = vaultEnabled
        ? await prismaVaultPresenceLookup.hasActiveDocument(caseId, stageKey, kind)
        : false;
      caseState = submitEvidence(caseState, {
        stageKey,
        kind,
        actorRole: "CLIENT",
        vault: vaultEnabled ? { enabled: true, hasActiveDocument } : undefined,
      });
    } else {
      caseState = attestEvidence(caseState, {
        stageKey,
        kind,
        actorRole: "CLIENT",
      });
    }

    await saveCase(caseState);
    revalidatePath(`/portal/cases/${caseId}`);
    revalidatePath("/portal");
    revalidatePath(`/cockpit/cases/${caseId}`);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof PortalPolicyError ||
      err instanceof StageEngineError ||
      err instanceof CaseAccessError ||
      err instanceof VaultError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Submit failed";
    return { ok: false, error: message };
  }
}
