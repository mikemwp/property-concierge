"use server";

import { auth } from "@/lib/auth";
import { ManualPartnerPort } from "@/lib/partner-port";
import {
  acceptEvidence,
  advanceStage,
  blockStage,
  StageEngineError,
} from "@/domain/stage-engine";
import type { ActorRole } from "@/domain/types";
import { loadCase, saveCase } from "@/server/cases";
import {
  assertWarmIntro,
  CockpitPolicyError,
} from "@/server/cockpit-policy";
import { revalidatePath } from "next/cache";

const partnerPort = new ManualPartnerPort();

export type CockpitActionResult =
  | { ok: true }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (err instanceof CockpitPolicyError || err instanceof StageEngineError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}

async function requireAdvisor(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true };
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath("/cockpit/cases");
  revalidatePath(`/portal/cases/${caseId}`);
}

export async function acceptEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
): Promise<CockpitActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCase(caseId);
    caseState = acceptEvidence(caseState, {
      stageKey,
      kind,
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function advanceAction(
  caseId: string,
): Promise<CockpitActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCase(caseId);
    caseState = advanceStage(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function blockAction(
  caseId: string,
  reason: string,
): Promise<CockpitActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  if (!reason.trim()) {
    return { ok: false, error: "Block reason is required" };
  }

  try {
    let caseState = await loadCase(caseId);
    caseState = blockStage(caseState, {
      reason: reason.trim(),
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function warmIntroAction(
  caseId: string,
  partnerType: ActorRole,
  note: string,
): Promise<CockpitActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    const caseState = await loadCase(caseId);
    assertWarmIntro(caseState);
    await partnerPort.requestWarmIntro({ caseId, partnerType, note });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
