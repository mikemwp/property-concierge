import { describe, it, expect } from "vitest";
import { ewMarketPack, getStageTemplate } from "../../src/domain/market-packs/ew";

describe("ew market pack", () => {
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
});
