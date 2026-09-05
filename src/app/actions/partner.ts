"use server";

import { auth } from "@/lib/auth";
import { StageEngineError } from "@/domain/stage-engine";
import { openTicketForRole } from "@/domain/partner-activity";
import type { ActorRole } from "@/domain/types";
import { partnerPortForCase } from "@/lib/partner-adapters/registry";
import { PartnerPortError } from "@/lib/partner-port";
import {
  CaseAccessError,
  loadCaseForUser,
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
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    assertPartnerSubmit(caseState, role, stageKey);
    const ticket = openTicketForRole(caseState, role);
    const port = partnerPortForCase(caseState, role);
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
    const message =
      err instanceof PartnerPolicyError ||
      err instanceof StageEngineError ||
      err instanceof PartnerPortError ||
      err instanceof CaseAccessError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Submit failed";
    return { ok: false, error: message };
  }
}
