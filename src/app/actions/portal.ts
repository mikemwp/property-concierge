"use server";

import { auth } from "@/lib/auth";
import { canSelfAdvance } from "@/domain/freemium";
import {
  submitEvidence,
  StageEngineError,
  type CaseState,
} from "@/domain/stage-engine";
import { loadCase, saveCase } from "@/server/cases";
import {
  assertPortalSubmit,
  PortalPolicyError,
} from "@/server/portal-policy";
import { revalidatePath } from "next/cache";

function clientAttestEvidence(
  caseState: CaseState,
  input: { stageKey: string; kind: string; now?: Date },
): CaseState {
  const at = (input.now ?? new Date()).toISOString();
  const stage = caseState.stages.find((s) => s.key === input.stageKey);
  if (!stage) {
    throw new PortalPolicyError("Stage not found");
  }
  if (!canSelfAdvance(caseState, input.stageKey)) {
    throw new PortalPolicyError("Free attestation not allowed on this stage");
  }
  if (!stage.requiredEvidenceKinds.includes(input.kind)) {
    throw new PortalPolicyError(`Evidence kind not required: ${input.kind}`);
  }
  if (stage.acceptedEvidenceKinds.includes(input.kind)) {
    throw new PortalPolicyError(`Evidence already accepted: ${input.kind}`);
  }

  return {
    ...caseState,
    stages: caseState.stages.map((s) =>
      s.key === input.stageKey
        ? {
            ...s,
            acceptedEvidenceKinds: [...s.acceptedEvidenceKinds, input.kind],
          }
        : s,
    ),
    events: [
      ...caseState.events,
      {
        type: "EVIDENCE_ATTESTED",
        stageKey: input.stageKey,
        actorRole: "CLIENT" as const,
        at,
        payload: input.kind,
      },
    ],
  };
}

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
    let caseState = await loadCase(caseId);
    assertPortalSubmit(caseState, stageKey);

    if (caseState.tier === "PAID_DWY") {
      caseState = submitEvidence(caseState, {
        stageKey,
        kind,
        actorRole: "CLIENT",
      });
    } else {
      caseState = clientAttestEvidence(caseState, { stageKey, kind });
    }

    await saveCase(caseState);
    revalidatePath(`/portal/cases/${caseId}`);
    revalidatePath("/portal");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof PortalPolicyError || err instanceof StageEngineError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Submit failed";
    return { ok: false, error: message };
  }
}
