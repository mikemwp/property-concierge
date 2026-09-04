"use server";

import { auth } from "@/lib/auth";
import { submitPartnerEvidence, StageEngineError } from "@/domain/stage-engine";
import type { ActorRole } from "@/domain/types";
import {
  CaseAccessError,
  loadCaseForUser,
  saveCase,
} from "@/server/cases";
import {
  assertPartnerSubmit,
  isPartnerRole,
  PartnerPolicyError,
} from "@/server/partner-policy";
import { revalidatePath } from "next/cache";

export type PartnerActionResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath(`/portal/cases/${caseId}`);
}

export async function submitPartnerEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
): Promise<PartnerActionResult> {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!session?.user || !role || !isPartnerRole(role)) {
    return { ok: false, error: "Forbidden" };
  }

  try {
    let caseState = await loadCaseForUser(session.user.id, role, caseId);
    assertPartnerSubmit(caseState, role, stageKey);
    caseState = submitPartnerEvidence(caseState, {
      stageKey,
      kind,
      actorRole: role,
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof PartnerPolicyError ||
      err instanceof StageEngineError ||
      err instanceof CaseAccessError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Submit failed";
    return { ok: false, error: message };
  }
}
