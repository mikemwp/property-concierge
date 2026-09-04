"use server";

import { getFocusStage } from "@/domain/stage-engine";
import { openTicketForRole } from "@/domain/partner-activity";
import { auth } from "@/lib/auth";
import { partnerPortForCase } from "@/lib/partner-adapters/registry";
import {
  CaseAccessError,
  loadCaseForUser,
} from "@/server/cases";
import {
  assertSpeedRails,
  isPartnerRole,
  PartnerPolicyError,
} from "@/server/partner-policy";
import { PartnerPortError } from "@/lib/partner-port";
import { activeReferralForRole } from "@/server/referrals";
import { revalidatePath } from "next/cache";
import type { PartnerActionResult } from "./partner";
import type { ActorRole } from "@/domain/types";

function mapError(err: unknown): string {
  if (
    err instanceof PartnerPolicyError ||
    err instanceof PartnerPortError ||
    err instanceof CaseAccessError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath(`/portal/cases/${caseId}`);
}

async function resolvePanelContext(caseId: string, role: ActorRole, caseState: Awaited<ReturnType<typeof loadCaseForUser>>) {
  const referral = await activeReferralForRole(caseId, role);
  if (referral) {
    return {
      panelMemberId: referral.partnerId,
      panelMemberName: referral.partnerName,
    };
  }
  const ticket = openTicketForRole(caseState, role);
  if (ticket) {
    return {
      panelMemberId: ticket.panelMemberId,
      panelMemberName: ticket.panelMemberName,
    };
  }
  return { panelMemberId: null, panelMemberName: null };
}

export async function acknowledgeCaseAction(
  caseId: string,
  note?: string,
): Promise<PartnerActionResult> {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!session?.user || !role || !isPartnerRole(role)) {
    return { ok: false, error: "Forbidden" };
  }

  try {
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    assertSpeedRails(caseState);
    const { panelMemberId, panelMemberName } = await resolvePanelContext(caseId, role, caseState);
    const port = partnerPortForCase(caseState, role);
    await port.acknowledgeCase({
      caseId,
      role,
      panelMemberId,
      panelMemberName,
      note,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function reportMilestoneAction(
  caseId: string,
  milestoneKey: string,
  note?: string,
): Promise<PartnerActionResult> {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!session?.user || !role || !isPartnerRole(role)) {
    return { ok: false, error: "Forbidden" };
  }

  try {
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    assertSpeedRails(caseState);
    const { panelMemberId, panelMemberName } = await resolvePanelContext(caseId, role, caseState);
    const port = partnerPortForCase(caseState, role);
    await port.reportMilestone({
      caseId,
      role,
      panelMemberId,
      panelMemberName,
      milestoneKey,
      note,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function syncPartnerStatusAction(
  caseId: string,
): Promise<PartnerActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    return { ok: false, error: "Forbidden" };
  }

  try {
    const caseState = await loadCaseForUser(session.user.id, "ADVISOR", caseId);
    assertSpeedRails(caseState);
    const focus = getFocusStage(caseState);
    if (!focus || !isPartnerRole(focus.ownerRole)) {
      return { ok: false, error: "Focus stage is not owned by a partner role" };
    }
    const role = focus.ownerRole;
    const { panelMemberId, panelMemberName } = await resolvePanelContext(caseId, role, caseState);
    const port = partnerPortForCase(caseState, role);
    await port.syncStatus({
      caseId,
      role,
      panelMemberId,
      panelMemberName,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
