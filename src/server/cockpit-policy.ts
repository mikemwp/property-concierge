import { canUseWarmIntro } from "../domain/freemium";
import type { CaseState } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";

export class CockpitPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CockpitPolicyError";
  }
}

export function assertWarmIntro(caseState: CaseState): void {
  if (!canUseWarmIntro(caseState)) {
    throw new CockpitPolicyError("Warm intro requires a paid tier");
  }
}

export function assertReroute(caseState: CaseState): void {
  if (!canUseWarmIntro(caseState)) {
    throw new CockpitPolicyError("Re-routing a partner requires a paid tier");
  }
}

export function assertPlaybookVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Stage playbooks are advisor-only operating IP",
    );
  }
}

export function assertCertificationVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Chain-free certification criteria are advisor-only operating IP",
    );
  }
}

export function assertPackInspectorVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "The market pack inspector is advisor-only operating IP",
    );
  }
}

export function assertClientSlaVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Client SLA publish controls are advisor-only operating IP",
    );
  }
}

export function assertSellerMilestonesVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Seller milestone share controls are advisor-only operating IP",
    );
  }
}
