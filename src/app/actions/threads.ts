"use server";

import { ThreadError } from "@/domain/threads";
import type { ActorRole } from "@/domain/types";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import { partnerThreadFlags, performPostMessage } from "@/server/threads";
import { revalidatePath } from "next/cache";

export type ThreadActionResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (err instanceof ThreadError || err instanceof CaseAccessError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Thread action failed";
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/portal/cases/${caseId}`);
  revalidatePath("/portal");
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath("/cockpit/cases");
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
}

export async function postCaseMessageAction(
  caseId: string,
  body: string,
): Promise<ThreadActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Forbidden" };
  }
  const role = session.user.role as ActorRole;
  try {
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    const flags = await partnerThreadFlags(caseId, role);
    const posted = await performPostMessage({
      caseState,
      actor: { role, userId: session.user.id },
      body,
      assigned: flags.assigned,
      hasActiveReferral: flags.hasActiveReferral,
    });
    revalidateCasePaths(caseId);
    return { ok: true, messageId: posted.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
