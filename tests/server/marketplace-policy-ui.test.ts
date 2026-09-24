import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  path.resolve(process.cwd(), "src/app/cockpit/market-packs/page.tsx"),
  "utf8",
);

describe("market pack inspector partner policy", () => {
  it("renders curated-vs-open policy from the summary", () => {
    expect(page).toMatch(/marketplacePolicy/);
    expect(page).toMatch(/curated panel/);
    expect(page).toMatch(/open marketplace off/);
    expect(page).not.toMatch(/href=["']\/marketplace/);
    expect(page).not.toMatch(/Browse partners/);
  });
});
