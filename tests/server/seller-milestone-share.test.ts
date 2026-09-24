import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import {
  buildSellerMilestoneSummary,
  sellerFacingCopy,
} from "../../src/domain/seller-milestones";
import { performSellerShareAction } from "../../src/server/seller-milestones";

const page = readFileSync(
  path.resolve(process.cwd(), "src/app/share/milestones/[caseId]/[signature]/page.tsx"),
  "utf8",
);
const card = readFileSync(
  path.resolve(process.cwd(), "src/components/SellerMilestoneShareCard.tsx"),
  "utf8",
);
const middleware = readFileSync(path.resolve(process.cwd(), "src/middleware.ts"), "utf8");

describe("public seller milestone share page", () => {
  it("is an unauthenticated read-only projection", () => {
    expect(page).toMatch(/verifySellerShare/);
    expect(page).toMatch(/loadCase/);
    expect(page).toMatch(/notFound/);
    expect(page).not.toMatch(/auth\(/);
    expect(page).not.toMatch(/login|password|SELLER/);
    expect(card).toMatch(/Buyer progress on this purchase/);
    expect(card).toMatch(/not an introduction/);
    expect(middleware).toMatch(/\/portal\/:path\*/);
    expect(middleware).not.toMatch(/\/share/);
  });

  it("hides public copy unless the share is live", () => {
    const paid = createCase({
      id: "sms1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(sellerFacingCopy(buildSellerMilestoneSummary({ caseState: paid, moduleEnabled: true }))).not.toBeNull();
    const live = performSellerShareAction(paid, {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
    });
    expect(buildSellerMilestoneSummary({ caseState: live, moduleEnabled: true }).shareStatus).toBe("LIVE");
  });
});
