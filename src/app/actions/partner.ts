"use server";

import { auth } from "@/lib/auth";
import { isPartnerRole } from "@/server/partner-policy";
import type { CaseState } from "@/domain/stage-engine";
import type { ActorRole } from "@/domain/types";
import { loadCase, saveCase } from "@/server/cases";
import {
  assertPartnerSubmit,
  PartnerPolicyError,
} from "@/server/partner-policy";
import { revalidatePath } from "next/cache";

export type PartnerActionResult =
  | { ok: true }
  | { ok: false; error: string };

function appendPartnerEvidenceSubmit(
  caseState: CaseState,
  input: { stageKey: string; kind: string; actorRole: ActorRole },
): CaseState {
  const stage = caseState.stages.find((s) => s.key === input.stageKey);
  if (!stage) {
    throw new PartnerPolicyError("Stage not found");
  }
  if (!stage.requiredEvidenceKinds.includes(input.kind)) {
    throw new PartnerPolicyError(`Evidence kind not required: ${input.kind}`);
  }

  const at = new Date().toISOString();
  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: "EVIDENCE_SUBMITTED",
        stageKey: input.stageKey,
        actorRole: input.actorRole,
        at,
        payload: input.kind,
      },
    ],
  };
}

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
    let caseState = await loadCase(caseId);
    assertPartnerSubmit(caseState, role, stageKey);
    caseState = appendPartnerEvidenceSubmit(caseState, {
      stageKey,
      kind,
      actorRole: role,
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof PartnerPolicyError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Submit failed";
    return { ok: false, error: message };
  }
}
