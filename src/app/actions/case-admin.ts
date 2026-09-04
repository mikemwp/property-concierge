"use server";

import { setEntryContext, upgradeToPaid } from "@/domain/case-admin";
import { StageEngineError } from "@/domain/stage-engine";
import type { EntryContext } from "@/domain/types";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import { revalidatePath } from "next/cache";

export type CaseAdminActionResult = { ok: true } | { ok: false; error: string };

const ENTRY_CONTEXTS: EntryContext[] = [
  "RETURNER_OVERSEAS",
  "RETURNER_IN_UK",
  "UK_RESIDENT_SPEED",
];

function mapError(err: unknown): string {
  if (err instanceof StageEngineError || err instanceof CaseAccessError) {
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
  revalidatePath("/cockpit/funnel");
  revalidatePath(`/portal/cases/${caseId}`);
}

export async function upgradeCaseAction(
  caseId: string,
): Promise<CaseAdminActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    caseState = upgradeToPaid(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function setEntryContextAction(
  caseId: string,
  entryContext: string,
): Promise<CaseAdminActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }

  if (!ENTRY_CONTEXTS.includes(entryContext as EntryContext)) {
    return { ok: false, error: "Unknown entry context" };
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    caseState = setEntryContext(caseState, {
      entryContext: entryContext as EntryContext,
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
