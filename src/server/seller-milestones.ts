import { createHmac, timingSafeEqual } from "node:crypto";
import { isModuleEnabled } from "../domain/market-packs/types";
import {
  advisorSellerView,
  applySellerShareAction,
  buildSellerMilestoneSummary,
  SellerMilestoneError,
  type AdvisorSellerView,
  type SellerShareAction,
} from "../domain/seller-milestones";
import type { CaseState } from "../domain/stage-engine";
import { casePack } from "../lib/case-pack";

export function canUseSellerMilestones(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "seller_milestone_views");
  } catch {
    return false;
  }
}

export function assertSellerMilestonesEnabled(caseState: CaseState): void {
  if (!canUseSellerMilestones(caseState)) {
    throw new SellerMilestoneError(
      "MODULE_OFF",
      `Seller milestone views are not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export function sellerViewShareSecret(): string {
  return process.env.SELLER_VIEW_SHARE_SECRET ?? "dev-seller-view-secret";
}

export function signSellerShare(caseId: string, secret: string = sellerViewShareSecret()): string {
  return createHmac("sha256", secret).update(caseId).digest("hex");
}

export function verifySellerShare(
  caseId: string,
  signature: string,
  secret: string = sellerViewShareSecret(),
): boolean {
  const expected = signSellerShare(caseId, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function sellerSharePath(caseId: string, signature: string): string {
  return `/share/milestones/${caseId}/${signature}`;
}

export function loadSellerMilestoneView(caseState: CaseState): AdvisorSellerView {
  return advisorSellerView(
    buildSellerMilestoneSummary({
      caseState,
      moduleEnabled: canUseSellerMilestones(caseState),
    }),
  );
}

export function performSellerShareAction(
  caseState: CaseState,
  input: { action: SellerShareAction; reason: string; now?: Date },
): CaseState {
  assertSellerMilestonesEnabled(caseState);
  return applySellerShareAction(caseState, {
    action: input.action,
    reason: input.reason,
    actorRole: "ADVISOR",
    moduleEnabled: true,
    now: input.now,
  });
}
