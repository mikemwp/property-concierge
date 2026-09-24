import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { isPartnerActorRole, type ActorRole } from "../domain/types";
import {
  assertCanPostThread,
  assertValidThreadBody,
  ThreadError,
  threadPermission,
  visibleCaseMessages,
  type CaseMessageRecord,
  type ThreadActor,
  type ThreadViewer,
} from "../domain/threads";
import { casePack } from "../lib/case-pack";
import { activeReferralForRole } from "./referrals";
import { insertCaseMessage, listCaseMessages } from "./thread-store";

export function canUseThreads(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "case_threads");
  } catch {
    return false;
  }
}

export function assertThreadsEnabled(caseState: CaseState): void {
  if (!canUseThreads(caseState)) {
    throw new ThreadError(
      "THREAD_DISABLED",
      `Case thread is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export function threadViewerFor(
  caseState: CaseState,
  actor: ThreadActor,
  flags: { assigned: boolean; hasActiveReferral: boolean },
): ThreadViewer {
  return {
    role: actor.role,
    userId: actor.userId,
    tier: caseState.tier,
    assigned: flags.assigned,
    hasActiveReferral: flags.hasActiveReferral,
  };
}

export async function partnerThreadFlags(
  caseId: string,
  role: ActorRole,
): Promise<{ assigned: boolean; hasActiveReferral: boolean }> {
  return {
    assigned: true,
    hasActiveReferral: isPartnerActorRole(role)
      ? (await activeReferralForRole(caseId, role)) !== null
      : false,
  };
}

export function listVisibleCaseMessages(
  messages: readonly CaseMessageRecord[],
  viewer: ThreadViewer,
): CaseMessageRecord[] {
  return visibleCaseMessages(messages, viewer);
}

export async function loadVisibleCaseMessages(
  caseState: CaseState,
  viewer: ThreadViewer,
): Promise<CaseMessageRecord[]> {
  if (!canUseThreads(caseState) || threadPermission(viewer) === "NONE") {
    return [];
  }
  return listVisibleCaseMessages(await listCaseMessages(caseState.id), viewer);
}

export async function performPostMessage(input: {
  caseState: CaseState;
  actor: ThreadActor;
  body: string;
  assigned: boolean;
  hasActiveReferral: boolean;
  now?: Date;
}): Promise<CaseMessageRecord> {
  const viewer = threadViewerFor(input.caseState, input.actor, {
    assigned: input.assigned,
    hasActiveReferral: input.hasActiveReferral,
  });
  assertCanPostThread(viewer);
  assertThreadsEnabled(input.caseState);
  const body = assertValidThreadBody(input.body);
  return insertCaseMessage({
    caseId: input.caseState.id,
    authorUserId: input.actor.userId,
    authorRole: input.actor.role,
    body,
    createdAt: input.now,
  });
}
