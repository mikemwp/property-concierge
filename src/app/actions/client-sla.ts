"use server";

import { type ClientSlaAction, ClientSlaError } from "@/domain/client-sla";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import { loadClientSla, performClientSlaAction } from "@/server/client-sla";
import { revalidatePath } from "next/cache";

export type ClientSlaActionResult = { ok: true } | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof ClientSlaError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}

async function requireAdvisorSession(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true, userId: session.user.id };
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath("/cockpit/cases");
  revalidatePath(`/portal/cases/${caseId}`);
}

async function runAction(
  caseId: string,
  action: ClientSlaAction,
  targetDate: string | null,
  reason: string,
): Promise<ClientSlaActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }
  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const loaded = await loadClientSla(caseState);
    caseState = performClientSlaAction(caseState, {
      action,
      targetDate,
      reason,
      partnerSignals: loaded.partnerSignals,
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function publishClientSlaAction(
  caseId: string,
  targetDate: string,
  reason: string,
): Promise<ClientSlaActionResult> {
  return runAction(caseId, "PUBLISH", targetDate, reason);
}

export async function amendClientSlaAction(
  caseId: string,
  targetDate: string,
  reason: string,
): Promise<ClientSlaActionResult> {
  return runAction(caseId, "AMEND", targetDate, reason);
}

export async function withdrawClientSlaAction(
  caseId: string,
  reason: string,
): Promise<ClientSlaActionResult> {
  return runAction(caseId, "WITHDRAW", null, reason);
}
