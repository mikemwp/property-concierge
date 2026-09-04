import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import {
  DEFAULT_MARKET_PACK_ID,
  findMarketPack,
  listMarketPacks,
  resolveMarketPack,
} from "../../src/domain/market-packs/registry";
import {
  getStageTemplate,
  isModuleEnabled,
  MarketPackError,
  packEvidenceKinds,
} from "../../src/domain/market-packs/types";

describe("market pack registry", () => {
  it("defaults to the England & Wales pack", () => {
    expect(DEFAULT_MARKET_PACK_ID).toBe("ew");
    expect(resolveMarketPack(DEFAULT_MARKET_PACK_ID).id).toBe("ew");
  });

  it("lists every registered pack, enabled or not, sorted by id", () => {
    expect(listMarketPacks().map((p) => [p.id, p.enabled])).toEqual([
      ["au", false],
      ["ew", true],
    ]);
  });

  it("fails closed on an unknown pack id", () => {
    expect(() => resolveMarketPack("zz")).toThrow(MarketPackError);
    expect(() => resolveMarketPack("zz")).toThrow(/Unknown market pack: zz/);
    expect(findMarketPack("zz")).toBeNull();
  });

  it("fails closed on a registered but disabled pack", () => {
    expect(findMarketPack("au")?.id).toBe("au");
    expect(() => resolveMarketPack("au")).toThrow(MarketPackError);
    expect(() => resolveMarketPack("au")).toThrow(/not enabled/i);
  });
});

describe("au stub pack", () => {
  it("is a configuration stub, not an AU product", () => {
    expect(auStubPack.enabled).toBe(false);
    expect(auStubPack.jurisdiction).toBe("australia");
    expect(auStubPack.locale.currencyCode).toBe("AUD");
    expect(auStubPack.locale.regionNoun).toBe("state");
    expect(auStubPack.buildPlaybooks("RETURNER_OVERSEAS")).toEqual([]);
    expect(packEvidenceKinds(auStubPack)).toEqual([]);
    for (const key of ["fx_deposit", "corridor_inbound", "chain_free_inventory"] as const) {
      expect(isModuleEnabled(auStubPack.flags, key)).toBe(false);
    }
  });

  it("proves stage keys are pack data, not engine constants", () => {
    const keys = getStageTemplate(auStubPack, "RETURNER_OVERSEAS").map((s) => s.key);
    expect(keys).toContain("finance_path");
    expect(keys).not.toContain("mortgage_path");
    expect(keys).toHaveLength(9);
  });

  it("gives free users nothing until the pack has local content", () => {
    for (const template of getStageTemplate(auStubPack, "UK_RESIDENT_SPEED")) {
      expect(template.freeVisible).toBe(false);
      expect(template.freeCanSelfAdvance).toBe(false);
      expect(template.requiredEvidenceKinds).toEqual([]);
    }
  });
});
