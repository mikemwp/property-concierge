import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { performSellerShareAction, sellerSharePath, signSellerShare } from "../../src/server/seller-milestones";

const source = readFileSync(
  path.resolve(process.cwd(), "src/app/actions/seller-milestones.ts"),
  "utf8",
);

describe("seller milestone actions", () => {
  it("are advisor-only mutations that persist through saveCase", () => {
    expect(source).toMatch(/export async function issueSellerShareAction/);
    expect(source).toMatch(/export async function revokeSellerShareAction/);
    expect(source).toMatch(/role !== "ADVISOR"/);
    expect(source).toMatch(/performSellerShareAction/);
    expect(source).toMatch(/saveCase/);
    expect(source).toMatch(/sharePath/);
    expect(source).not.toMatch(/SELLER_ROLE|"SELLER"/);
  });

  it("returns the signed path after a live issue", () => {
    const caseState = createCase({
      id: "sma1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    const live = performSellerShareAction(caseState, {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
    });
    expect(live.events.some((event) => event.type === "SELLER_VIEW_SHARE_ISSUED")).toBe(true);
    expect(sellerSharePath("sma1", signSellerShare("sma1"))).toMatch(/^\/share\/milestones\/sma1\//);
  });
});
