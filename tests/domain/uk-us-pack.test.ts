import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ukUsMarketPack } from "../../src/domain/market-packs/uk-us";
import {
  getStageTemplate,
  isModuleEnabled,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("uk_us corridor pack", () => {
  it("is an enabled United Kingdom → United States destination pack", () => {
    expect(ukUsMarketPack.id).toBe("uk_us");
    expect(ukUsMarketPack.enabled).toBe(true);
    expect(ukUsMarketPack.jurisdiction).toBe("united_states");
    expect(ukUsMarketPack.locale).toEqual({
      bcp47: "en-US",
      currencyCode: "USD",
      addressFieldKeys: ["line1", "line2", "city", "state", "zip"],
      regionNoun: "state",
    });
    expect(ukUsMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(ukUsMarketPack.partnerRoleLabels.CONVEYANCER).toBe("closing attorney");
    expect(ukUsMarketPack.partnerRoleLabels.MOVE_PARTNER).toBe("movers");
    expect(isModuleEnabled(ukUsMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(ukUsMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(ukUsMarketPack.flags, "hard_client_sla")).toBe(false);
  });

  it("uses the US legal spine with closing, not exchange_complete", () => {
    const keys = getStageTemplate(ukUsMarketPack, "RETURNER_OVERSEAS").map((s) => s.key);
    expect(keys).toEqual([
      "purchase_profile",
      "money_readiness",
      "finance_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "closing_complete",
      "settle_light",
    ]);
    expect(keys).not.toContain("mortgage_path");
    expect(keys).not.toContain("exchange_complete");
    expect(keys).not.toContain("settlement_complete");
    expect(keys).not.toContain("chain_free_matching");
  });

  it("uses US evidence kinds and corridor overlays", () => {
    const stages = getStageTemplate(ukUsMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "finance_path")?.requiredEvidenceKinds).toEqual([
      "pre_approval",
    ]);
    expect(stages.find((s) => s.key === "offer_instruct")?.requiredEvidenceKinds).toEqual([
      "closing_agent_instructed",
    ]);
    expect(stages.find((s) => s.key === "diligence")?.requiredEvidenceKinds).toEqual([
      "inspection_complete",
    ]);
    expect(stages.find((s) => s.key === "closing_complete")).toMatchObject({
      title: "Closing",
      requiredEvidenceKinds: ["closing_confirmed"],
    });
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
  });

  it("ships real playbooks that name closing and forbid seller introductions", () => {
    const close = stagePlaybook(ukUsMarketPack, "closing_complete", "UK_RESIDENT_SPEED");
    expect(close?.objective.length).toBeGreaterThan(20);
    expect(close?.actions.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(close)).toMatch(/closing_confirmed/);
    const keys = getStageTemplate(ukUsMarketPack, "RETURNER_IN_UK").map((s) => s.key);
    expect(ukUsMarketPack.buildPlaybooks("RETURNER_IN_UK").map((p) => p.stageKey)).toEqual(keys);
    const blob = JSON.stringify(ukUsMarketPack.buildPlaybooks("RETURNER_OVERSEAS"));
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/guaranteed completion/i);
  });

  it("uses US disclosure and can back a live case", () => {
    expect(
      ukUsMarketPack.disclosureText({
        role: "CONVEYANCER",
        partnerName: "Riley Cho",
        partnerFirm: "Harbor Title",
      }),
    ).toMatch(/closing attorney or escrow/i);
    const created = createCase({
      id: "ukus1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      marketPackId: "uk_us",
    });
    expect(created.stages.some((s) => s.key === "closing_complete")).toBe(true);
    expect(created.stages).toHaveLength(9);
  });
});
