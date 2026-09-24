"use server";

import { SellerMilestoneError } from "@/domain/seller-milestones";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import {
  performSellerShareAction,
  sellerSharePath,
  signSellerShare,
} from "@/server/seller-milestones";
import { revalidatePath } from "next/cache";

export type SellerShareIssueResult =
  | { ok: true; sharePath: string }
  | { ok: false; error: string };
export type SellerShareRevokeResult = { ok: true } | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof SellerMilestoneError ||
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
}

export async function issueSellerShareAction(
  caseId: string,
  reason: string,
): Promise<SellerShareIssueResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) return authResult;
  try {
    const caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const next = performSellerShareAction(caseState, { action: "ISSUE", reason });
    await saveCase(next);
    revalidateCasePaths(caseId);
    return { ok: true, sharePath: sellerSharePath(caseId, signSellerShare(caseId)) };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function revokeSellerShareAction(
  caseId: string,
  reason: string,
): Promise<SellerShareRevokeResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) return authResult;
  try {
    const caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const next = performSellerShareAction(caseState, { action: "REVOKE", reason });
    await saveCase(next);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
