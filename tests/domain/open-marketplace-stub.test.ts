import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listMarketPacks } from "../../src/domain/market-packs/registry";
import { marketPackSummary } from "../../src/domain/market-packs/inspector";
import { isModuleEnabled, marketplacePolicy } from "../../src/domain/market-packs/types";

describe("open marketplace is an architecture stub", () => {
  it("lists curated_panel for every registered pack, including the au stub", () => {
    const packs = listMarketPacks();
    expect(packs.map((pack) => pack.id).sort()).toEqual([
      "au",
      "au_uk",
      "ew",
      "uk_au",
      "uk_us",
      "us_uk",
    ]);
    for (const pack of packs) {
      expect(isModuleEnabled(pack.flags, "open_marketplace")).toBe(false);
      expect(marketplacePolicy(pack.flags)).toBe("curated_panel");
      expect(marketPackSummary(pack, "UK_RESIDENT_SPEED").marketplacePolicy).toBe("curated_panel");
    }
  });

  it("does not ship a third-party browse route", () => {
    const root = process.cwd();
    expect(existsSync(path.join(root, "src/app/marketplace"))).toBe(false);
    expect(existsSync(path.join(root, "src/app/(marketing)/marketplace"))).toBe(false);
    expect(existsSync(path.join(root, "src/app/(marketing)/partners/browse"))).toBe(false);
  });
});
