import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { usUkMarketPack } from "../../src/domain/market-packs/us-uk";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import {
  getStageTemplate,
  isModuleEnabled,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("us_uk corridor pack", () => {
  it("is an enabled United States → England & Wales destination pack", () => {
    expect(usUkMarketPack.id).toBe("us_uk");
    expect(usUkMarketPack.enabled).toBe(true);
    expect(usUkMarketPack.jurisdiction).toBe("england_wales");
    expect(usUkMarketPack.locale).toEqual(ewMarketPack.locale);
    expect(usUkMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
      document_vault: true,
    });
    expect(isModuleEnabled(usUkMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(usUkMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(usUkMarketPack.flags, "hard_client_sla")).toBe(false);
  });

  it("reuses the E&W legal spine without the chain-free overlay", () => {
    expect(getStageTemplate(usUkMarketPack, "RETURNER_OVERSEAS").map((s) => s.key)).toEqual([
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

  it("requires USD→GBP FX and US departure evidence for an overseas household", () => {
    const stages = getStageTemplate(usUkMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(stages.find((s) => s.key === "move_logistics")?.requiredEvidenceKinds).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
  });

  it("names the US→E&W corridor in profile and move playbooks", () => {
    const profile = stagePlaybook(usUkMarketPack, "purchase_profile", "RETURNER_OVERSEAS");
    expect(profile?.objective).toMatch(/United States/);
    expect(profile?.actions.some((a) => /corridor_intent/i.test(a.action))).toBe(true);
    const money = stagePlaybook(usUkMarketPack, "money_readiness", "UK_RESIDENT_SPEED");
    expect(money?.actions.some((a) => /USD to GBP/i.test(a.action))).toBe(true);
    const keys = getStageTemplate(usUkMarketPack, "RETURNER_IN_UK").map((s) => s.key);
    expect(usUkMarketPack.buildPlaybooks("RETURNER_IN_UK").map((p) => p.stageKey)).toEqual(keys);
  });

  it("can back a live case on the existing engine", () => {
    const created = createCase({
      id: "usuk1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      marketPackId: "us_uk",
    });
    expect(created.marketPackId).toBe("us_uk");
    expect(created.stages.some((s) => s.key === "mortgage_path")).toBe(true);
    expect(created.stages.some((s) => s.key === "chain_free_matching")).toBe(false);
  });
});
