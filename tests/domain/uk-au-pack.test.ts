import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { ukAuMarketPack } from "../../src/domain/market-packs/uk-au";
import {
  getStageTemplate,
  isModuleEnabled,
  packEvidenceKinds,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("uk_au corridor pack", () => {
  it("is the live UK → Australia product; the au stub stays disabled", () => {
    expect(ukAuMarketPack.id).toBe("uk_au");
    expect(ukAuMarketPack.enabled).toBe(true);
    expect(ukAuMarketPack.jurisdiction).toBe("australia");
    expect(ukAuMarketPack.locale).toEqual({
      bcp47: "en-AU",
      currencyCode: "AUD",
      addressFieldKeys: ["line1", "line2", "suburb", "state", "postcode"],
      regionNoun: "state",
    });
    expect(ukAuMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(auStubPack.enabled).toBe(false);
    expect(packEvidenceKinds(auStubPack)).toEqual([]);
    expect(isModuleEnabled(ukAuMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(ukAuMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(ukAuMarketPack.flags, "hard_client_sla")).toBe(false);
    expect(isModuleEnabled(ukAuMarketPack.flags, "case_threads")).toBe(false);
    expect(isModuleEnabled(ukAuMarketPack.flags, "document_vault")).toBe(false);
  });

  it("uses the AU legal spine, not mortgage_path or exchange_complete", () => {
    const keys = getStageTemplate(ukAuMarketPack, "RETURNER_OVERSEAS").map((s) => s.key);
    expect(keys).toEqual([
      "purchase_profile",
      "money_readiness",
      "finance_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "settlement_complete",
      "settle_light",
    ]);
    expect(keys).not.toContain("mortgage_path");
    expect(keys).not.toContain("exchange_complete");
    expect(keys).not.toContain("chain_free_matching");
  });

  it("uses AU evidence kinds and corridor overlays", () => {
    const stages = getStageTemplate(ukAuMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "finance_path")).toMatchObject({
      title: "Finance path",
      requiredEvidenceKinds: ["pre_approval"],
      defaultOwnerRole: "MORTGAGE_PARTNER",
    });
    expect(stages.find((s) => s.key === "settlement_complete")).toMatchObject({
      title: "Settlement → complete",
      requiredEvidenceKinds: ["settlement_confirmed"],
    });
    expect(stages.find((s) => s.key === "purchase_profile")?.requiredEvidenceKinds).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
  });

  it("ships real playbooks and AU partner labels", () => {
    expect(ukAuMarketPack.partnerRoleLabels.MORTGAGE_PARTNER).toBe("mortgage broker");
    expect(ukAuMarketPack.partnerRoleLabels.MOVE_PARTNER).toBe("removalist");
    const finance = stagePlaybook(ukAuMarketPack, "finance_path", "UK_RESIDENT_SPEED");
    expect(finance?.objective.length).toBeGreaterThan(20);
    expect(finance?.actions.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(finance)).toMatch(/pre_approval/);
    expect(JSON.stringify(finance)).not.toMatch(/dip_aip/);
    const keys = getStageTemplate(ukAuMarketPack, "RETURNER_IN_UK").map((s) => s.key);
    expect(ukAuMarketPack.buildPlaybooks("RETURNER_IN_UK").map((p) => p.stageKey)).toEqual(keys);
    const blob = JSON.stringify(ukAuMarketPack.buildPlaybooks("RETURNER_OVERSEAS"));
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
  });

  it("uses Australian disclosure and can back a live case", () => {
    expect(
      ukAuMarketPack.disclosureText({
        role: "MORTGAGE_PARTNER",
        partnerName: "Mia Chen",
        partnerFirm: "Harbour Brokers",
      }),
    ).toMatch(/credit assistance/i);
    const created = createCase({
      id: "ukau1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      marketPackId: "uk_au",
    });
    expect(created.stages.some((s) => s.key === "finance_path")).toBe(true);
    expect(created.stages.some((s) => s.key === "settlement_complete")).toBe(true);
  });
});
