"use server";

import { nudgePartner, reroutePartner } from "@/domain/partner-ops";
import { isFeeStatus } from "@/domain/referral";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import {
  attachPartnerParticipant,
  detachPartnerParticipant,
} from "@/server/case-access";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import { assertReroute, CockpitPolicyError } from "@/server/cockpit-policy";
import {
  assertPanelMemberInMarket,
  getPanelMember,
  PartnerNetworkError,
  setPanelMemberActive,
} from "@/server/panel";
import {
  createReferral,
  setReferralFeeStatus,
  supersedeActiveReferrals,
} from "@/server/referrals";
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

export async function markReferralAction(
  caseId: string,
  panelMemberId: string,
  feeStatus: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }
  if (!isFeeStatus(feeStatus)) {
    return { ok: false, error: "Unknown fee status" };
  }

  try {
    await loadCaseForUser(authResult.userId, "ADVISOR", caseId);

    const member = await getPanelMember(panelMemberId);
    if (member) {
      await supersedeActiveReferrals(caseId, member.roleType);
    }

    await createReferral({
      caseId,
      partnerId: panelMemberId,
      source: "ADVISOR_MARK",
      feeStatus,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function setFeeStatusAction(
  caseId: string,
  referralId: string,
  feeStatus: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }
  if (!isFeeStatus(feeStatus)) {
    return { ok: false, error: "Unknown fee status" };
  }

  try {
    await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    await setReferralFeeStatus(referralId, feeStatus, caseId);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function nudgePartnerAction(
  caseId: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    caseState = nudgePartner(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function reroutePartnerAction(
  caseId: string,
  panelMemberId: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    assertReroute(caseState);

    const next = await getPanelMember(panelMemberId);
    if (!next || !next.active) {
      return { ok: false, error: "Panel member is not available for re-route" };
    }
    assertPanelMemberInMarket(next, caseState.marketPackId);

    const previous = await supersedeActiveReferrals(caseId, next.roleType);
    caseState = reroutePartner(caseState, {
      roleType: next.roleType,
      fromPartnerId: previous?.partnerId ?? null,
      toPartnerId: next.id,
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);
    await createReferral({ caseId, partnerId: next.id, source: "REROUTE" });

    if (previous) {
      const previousMember = await getPanelMember(previous.partnerId);
      if (previousMember?.userId && previousMember.userId !== next.userId) {
        await detachPartnerParticipant(caseId, previousMember.userId);
      }
    }
    if (next.userId) {
      await attachPartnerParticipant(caseId, next.roleType, next.userId);
    }

    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
