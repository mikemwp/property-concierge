import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cockpit = readFileSync(
  path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
  "utf8",
);
const panel = readFileSync(
  path.resolve(process.cwd(), "src/components/SellerMilestonePanel.tsx"),
  "utf8",
);

describe("seller milestone cockpit surface", () => {
  it("renders the advisor panel only when the overlay is on", () => {
    expect(cockpit).toMatch(/canUseSellerMilestones/);
    expect(cockpit).toMatch(/SellerMilestonePanel/);
    expect(cockpit).toMatch(/assertSellerMilestonesVisible/);
    expect(panel).toMatch(/issueSellerShareAction/);
    expect(panel).toMatch(/revokeSellerShareAction/);
    expect(panel).toMatch(/exportCopy/);
    expect(panel).not.toMatch(/seller login|inventory|introduce the buyer/i);
  });
});
