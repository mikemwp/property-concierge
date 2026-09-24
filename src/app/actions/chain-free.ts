"use server";

import {
  type ChainFreeOverrideAction,
  ChainFreeError,
} from "@/domain/chain-free";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import {
  loadCertification,
  performCertificationOverride,
} from "@/server/chain-free";
import { revalidatePath } from "next/cache";

export type ChainFreeActionResult = { ok: true } | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof ChainFreeError ||
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

async function runOverride(
  caseId: string,
  action: ChainFreeOverrideAction,
  reason: string,
): Promise<ChainFreeActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }
  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const loaded = await loadCertification(caseState);
    caseState = performCertificationOverride(caseState, {
      action,
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

export async function certifyChainFreeAction(
  caseId: string,
  reason: string,
): Promise<ChainFreeActionResult> {
  return runOverride(caseId, "CERTIFY", reason);
}

export async function markChainFreeIneligibleAction(
  caseId: string,
  reason: string,
): Promise<ChainFreeActionResult> {
  return runOverride(caseId, "INELIGIBLE", reason);
}

export async function resetChainFreeAction(
  caseId: string,
  reason: string,
): Promise<ChainFreeActionResult> {
  return runOverride(caseId, "RESET", reason);
}
