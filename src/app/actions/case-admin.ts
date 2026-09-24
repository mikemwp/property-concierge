"use server";

import { setEntryContext, upgradeToPaid } from "@/domain/case-admin";
import { resolveMarketPack } from "@/domain/market-packs/registry";
import { MarketPackError } from "@/domain/market-packs/types";
import { StageEngineError } from "@/domain/stage-engine";
import { ENTRY_CONTEXTS, type EntryContext, type Tier } from "@/domain/types";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CaseAccessError, createCaseRecord, loadCaseForUser, saveCase } from "@/server/cases";
import { revalidatePath } from "next/cache";

export type CaseAdminActionResult = { ok: true } | { ok: false; error: string };

export type CreateAdvisorCaseResult =
  | { ok: true; caseId: string }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (err instanceof StageEngineError || err instanceof CaseAccessError) {
    return err.message;
  }
  if (err instanceof MarketPackError) {
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

export async function createAdvisorCaseAction(input: {
  clientEmail: string;
  title: string;
  entryContext: string;
  marketPackId: string;
  tier: string;
}): Promise<CreateAdvisorCaseResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }

  if (!ENTRY_CONTEXTS.includes(input.entryContext as EntryContext)) {
    return { ok: false, error: "Unknown entry context" };
  }

  const tier: Tier = input.tier === "FREE_DIY" ? "FREE_DIY" : "PAID_DWY";
  const title = input.title.trim();
  if (title.length === 0) {
    return { ok: false, error: "Give the case a title." };
  }

  try {
    resolveMarketPack(input.marketPackId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof MarketPackError ? err.message : "Unknown market pack",
    };
  }

  const client = await prisma.user.findUnique({
    where: { email: input.clientEmail.trim().toLowerCase() },
  });
  if (!client || client.role !== "CLIENT") {
    return { ok: false, error: "No client account exists for that email." };
  }

  try {
    const created = await createCaseRecord({
      title,
      entryContext: input.entryContext as EntryContext,
      tier,
      clientUserId: client.id,
      advisorUserId: authResult.userId,
      marketPackId: input.marketPackId,
    });
    revalidateCasePaths(created.id);
    return { ok: true, caseId: created.id };
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
