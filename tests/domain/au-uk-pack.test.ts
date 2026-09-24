import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { auUkMarketPack } from "../../src/domain/market-packs/au-uk";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import {
  getStageTemplate,
  isModuleEnabled,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("au_uk corridor pack", () => {
  it("is an enabled Australia → England & Wales destination pack", () => {
    expect(auUkMarketPack.id).toBe("au_uk");
    expect(auUkMarketPack.enabled).toBe(true);
    expect(auUkMarketPack.jurisdiction).toBe("england_wales");
    expect(auUkMarketPack.locale).toEqual(ewMarketPack.locale);
    expect(auUkMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(isModuleEnabled(auUkMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(auUkMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(auUkMarketPack.flags, "hard_client_sla")).toBe(false);
  });

  it("reuses the E&W legal spine without the chain-free overlay", () => {
    const stages = getStageTemplate(auUkMarketPack, "RETURNER_OVERSEAS");
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
    expect(stages.some((s) => s.key === "chain_free_matching")).toBe(false);
    expect(getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS").map((s) => s.key)).toContain(
      "chain_free_matching",
    );
  });

  it("requires corridor evidence on profile, money and move for an overseas household", () => {
    const stages = getStageTemplate(auUkMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "purchase_profile")?.requiredEvidenceKinds).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);
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

  it("still requires FX for a UK-resident speed-seeker on this corridor", () => {
    const money = getStageTemplate(auUkMarketPack, "UK_RESIDENT_SPEED").find(
      (s) => s.key === "money_readiness",
    );
    expect(money?.requiredEvidenceKinds).toEqual(["source_of_funds", "fx_plan"]);
    const move = getStageTemplate(auUkMarketPack, "UK_RESIDENT_SPEED").find(
      (s) => s.key === "move_logistics",
    );
    expect(move?.requiredEvidenceKinds).toEqual(["move_quote", "departure_plan"]);
  });

  it("covers every stage with a real playbook and names the AU→E&W corridor in profile and move", () => {
    for (const entry of ["RETURNER_OVERSEAS", "RETURNER_IN_UK", "UK_RESIDENT_SPEED"] as const) {
      const keys = getStageTemplate(auUkMarketPack, entry).map((s) => s.key);
      expect(auUkMarketPack.buildPlaybooks(entry).map((p) => p.stageKey)).toEqual(keys);
      for (const key of keys) {
        expect(stagePlaybook(auUkMarketPack, key, entry)?.stageKey).toBe(key);
      }
    }
    const profile = stagePlaybook(auUkMarketPack, "purchase_profile", "RETURNER_OVERSEAS");
    expect(profile?.objective).toMatch(/Australia/);
    expect(profile?.actions.some((a) => /corridor_intent/i.test(a.action))).toBe(true);
    const move = stagePlaybook(auUkMarketPack, "move_logistics", "RETURNER_OVERSEAS");
    expect(move?.actions.some((a) => /departure_plan/i.test(a.action))).toBe(true);
    const blob = JSON.stringify(auUkMarketPack.buildPlaybooks("RETURNER_OVERSEAS"));
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/guaranteed completion/i);
  });

  it("reuses England & Wales disclosure and can back a live case", () => {
    const text = auUkMarketPack.disclosureText({
      role: "MORTGAGE_PARTNER",
      partnerName: "Priya Nair",
      partnerFirm: "Northstar Mortgages",
    });
    expect(text).toMatch(/introducer only/i);
    const created = createCase({
      id: "auuk1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      marketPackId: "au_uk",
    });
    expect(created.marketPackId).toBe("au_uk");
    expect(created.stages).toHaveLength(9);
    expect(created.stages[0]?.key).toBe("purchase_profile");
  });
});
