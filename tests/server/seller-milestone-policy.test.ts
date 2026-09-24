import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { SellerMilestoneError } from "../../src/domain/seller-milestones";
import { CockpitPolicyError } from "../../src/server/cockpit-policy";
import {
  assertSellerMilestonesEnabled,
  canUseSellerMilestones,
  loadSellerMilestoneView,
  performSellerShareAction,
  sellerSharePath,
  sellerViewShareSecret,
  signSellerShare,
  verifySellerShare,
} from "../../src/server/seller-milestones";
import { assertSellerMilestonesVisible } from "../../src/server/cockpit-policy";

function paid(id = "smp1") {
  return createCase({ id, entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("seller milestone module gate", () => {
  it("is open for paid England & Wales and closed otherwise", () => {
    expect(canUseSellerMilestones(paid())).toBe(true);
    expect(canUseSellerMilestones({ ...paid(), marketPackId: "au_uk" })).toBe(false);
    expect(canUseSellerMilestones({ ...paid("smp2"), tier: "FREE_DIY" })).toBe(false);
    expect(() => assertSellerMilestonesEnabled(paid())).not.toThrow();
    expect(() => assertSellerMilestonesEnabled({ ...paid(), marketPackId: "au_uk" })).toThrow(
      SellerMilestoneError,
    );
  });
});

describe("HMAC share token", () => {
  it("signs caseId and rejects a tampered signature", () => {
    const secret = sellerViewShareSecret();
    const signature = signSellerShare("smp1", secret);
    expect(signature).toBe(createHmac("sha256", secret).update("smp1").digest("hex"));
    expect(verifySellerShare("smp1", signature, secret)).toBe(true);
    expect(verifySellerShare("smp1", "ab".repeat(32), secret)).toBe(false);
    expect(verifySellerShare("other", signature, secret)).toBe(false);
    expect(sellerSharePath("smp1", signature)).toBe(`/share/milestones/smp1/${signature}`);
  });
});

describe("load and perform", () => {
  it("builds the advisor view and issues a share only when the gate is open", () => {
    const view = loadSellerMilestoneView(paid());
    expect(view.summary.rows.length).toBeGreaterThan(0);
    expect(view.canIssueShare).toBe(true);
    const live = performSellerShareAction(paid(), {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
    });
    expect(loadSellerMilestoneView(live).canRevokeShare).toBe(true);
    expect(() =>
      performSellerShareAction({ ...paid(), marketPackId: "au_uk" }, {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
      }),
    ).toThrow(SellerMilestoneError);
  });
});

describe("cockpit visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertSellerMilestonesVisible("ADVISOR")).not.toThrow();
    expect(() => assertSellerMilestonesVisible("CLIENT")).toThrow(CockpitPolicyError);
  });
});
