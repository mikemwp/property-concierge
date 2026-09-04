"use server";

import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError } from "@/server/cases";
import { CockpitPolicyError } from "@/server/cockpit-policy";
import { PartnerNetworkError, setPanelMemberActive } from "@/server/panel";
import { revalidatePath } from "next/cache";

export type PartnerNetworkActionResult =
  | { ok: true }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof PartnerNetworkError ||
    err instanceof CockpitPolicyError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}

async function requireAdvisor(): Promise<
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
  revalidatePath("/cockpit/panel");
  revalidatePath(`/portal/cases/${caseId}`);
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
}

export async function setPanelActiveAction(
  panelMemberId: string,
  active: boolean,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    await setPanelMemberActive(panelMemberId, active);
    revalidatePath("/cockpit/panel");
    revalidatePath("/cockpit/cases");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
