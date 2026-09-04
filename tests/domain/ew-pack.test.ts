import { describe, it, expect } from "vitest";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import { getStageTemplate, stagePlaybook } from "../../src/domain/market-packs/types";

describe("ew market pack", () => {
  it("declares its locale, currency and address shape as data", () => {
    expect(ewMarketPack.locale).toEqual({
      bcp47: "en-GB",
      currencyCode: "GBP",
      addressFieldKeys: ["line1", "line2", "town", "county", "postcode"],
      regionNoun: "region",
    });
    expect(ewMarketPack.jurisdiction).toBe("england_wales");
    expect(ewMarketPack.enabled).toBe(true);
  });

  it("carries jurisdiction copy and partner-role labels on the pack", () => {
    expect(ewMarketPack.copy.region_prompt).toMatch(/England & Wales/);
    expect(ewMarketPack.copy.directory_intro).toMatch(/England & Wales/);
    expect(ewMarketPack.copy.mortgage_posture).toMatch(/introducer only/i);
    expect(ewMarketPack.partnerRoleLabels.CONVEYANCER).toBe("conveyancer");
    expect(ewMarketPack.partnerRoleLabels.MORTGAGE_PARTNER).toBe("mortgage adviser");
  });

  it("returns nine canonical stage keys in order", () => {
    const stages = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS");
    expect(stages.map((s) => s.key)).toEqual([
      "purchase_profile",
      "money_readiness",
      "mortgage_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "exchange_complete",
      "settle_light",
    ]);
  });

  it("does not use international-only stage titles", () => {
    const stages = getStageTemplate(ewMarketPack, "UK_RESIDENT_SPEED");
    expect(stages.every((s) => !/homecoming|international/i.test(s.title))).toBe(
      true,
    );
  });

  it("marks verified finance gates as not free-self-advanceable", () => {
    const stages = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS");
    const money = stages.find((s) => s.key === "money_readiness");
    expect(money?.freeCanSelfAdvance).toBe(false);
    expect(money?.freeVisible).toBe(true);
  });

  it("requires profile_complete evidence on purchase_profile", () => {
    const stages = getStageTemplate(ewMarketPack, "UK_RESIDENT_SPEED");
    const profile = stages.find((s) => s.key === "purchase_profile");
    expect(profile?.requiredEvidenceKinds).toContain("profile_complete");
  });

  it("exposes an entry-context playbook for every stage through the pack", () => {
    for (const entry of ["RETURNER_OVERSEAS", "RETURNER_IN_UK", "UK_RESIDENT_SPEED"] as const) {
      const stageKeys = getStageTemplate(ewMarketPack, entry).map((s) => s.key);
      expect(ewMarketPack.buildPlaybooks(entry).map((p) => p.stageKey)).toEqual(stageKeys);
      for (const key of stageKeys) {
        expect(stagePlaybook(ewMarketPack, key, entry)?.stageKey).toBe(key);
      }
    }
    expect(stagePlaybook(ewMarketPack, "chain_free_matching", "RETURNER_IN_UK")).toBeNull();
  });
});
