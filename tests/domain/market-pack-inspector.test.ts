import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { auUkMarketPack } from "../../src/domain/market-packs/au-uk";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import { ukAuMarketPack } from "../../src/domain/market-packs/uk-au";
import { marketPackSummary } from "../../src/domain/market-packs/inspector";
import { MARKET_MODULE_KEYS } from "../../src/domain/market-packs/types";

describe("market pack summary", () => {
  const summary = marketPackSummary(ewMarketPack, "RETURNER_OVERSEAS");

  it("describes the active pack as configuration", () => {
    expect(summary.id).toBe("ew");
    expect(summary.name).toBe("England & Wales");
    expect(summary.jurisdiction).toBe("england_wales");
    expect(summary.enabled).toBe(true);
    expect(summary.entryContext).toBe("RETURNER_OVERSEAS");
    expect(summary.locale.currencyCode).toBe("GBP");
    expect(summary.marketplacePolicy).toBe("curated_panel");
  });

  it("lists every module with its state and every stage in order", () => {
    expect(summary.modules).toHaveLength(MARKET_MODULE_KEYS.length);
    expect(summary.modules.find((m) => m.key === "fx_deposit")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "chain_free_inventory")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "hard_client_sla")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "document_vault")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "case_threads")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "seller_milestone_views")?.enabled).toBe(true);
    expect(summary.stages.map((s) => s.key)).toEqual(
      ewMarketPack.buildStages("RETURNER_OVERSEAS").map((s) => s.key),
    );
    expect(summary.stages[1]).toMatchObject({
      key: "money_readiness",
      ownerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["source_of_funds", "fx_plan"],
    });
  });

  it("lists copy keys, role labels, evidence kinds and playbook coverage", () => {
    expect(summary.copy.map((row) => row.key)).toContain("region_prompt");
    expect(summary.partnerRoleLabels).toContainEqual({
      role: "CONVEYANCER",
      label: "conveyancer",
    });
    expect(summary.evidenceKinds).toContain("completion_confirmed");
    expect(summary.playbookStageKeys).toEqual(summary.stages.map((s) => s.key));
  });

  it("never carries playbook prose — PlaybookPanel stays the only playbook surface", () => {
    const serialised = JSON.stringify(summary);
    for (const playbook of ewMarketPack.buildPlaybooks("RETURNER_OVERSEAS")) {
      expect(serialised).not.toContain(playbook.objective);
      for (const step of playbook.actions) {
        expect(serialised).not.toContain(step.action);
      }
      for (const line of playbook.evidenceStandard) {
        expect(serialised).not.toContain(line);
      }
      for (const line of playbook.escalation) {
        expect(serialised).not.toContain(line);
      }
    }
  });

  it("lists partner milestone keys per role without leaking process prose", () => {
    const summary = marketPackSummary(ewMarketPack, "RETURNER_OVERSEAS");
    const conveyancer = summary.partnerMilestoneKeys.find((r) => r.role === "CONVEYANCER");
    expect(conveyancer?.keys).toContain("searches_ordered");
    expect(JSON.stringify(summary)).not.toContain("Searches ordered");
  });

  it("summarises a disabled pack without enabling it", () => {
    const stub = marketPackSummary(auStubPack, "UK_RESIDENT_SPEED");
    expect(stub.enabled).toBe(false);
    expect(stub.locale.currencyCode).toBe("AUD");
    expect(stub.stages.map((s) => s.key)).toContain("finance_path");
    expect(stub.playbookStageKeys).toEqual([]);
    expect(stub.evidenceKinds).toEqual([]);
    expect(stub.marketplacePolicy).toBe("curated_panel");
  });

  it("summarises a corridor pack without leaking playbook prose", () => {
    const inbound = marketPackSummary(auUkMarketPack, "RETURNER_OVERSEAS");
    expect(inbound.marketplacePolicy).toBe("curated_panel");
    expect(inbound.enabled).toBe(true);
    expect(inbound.modules.find((m) => m.key === "corridor_inbound")?.enabled).toBe(true);
    expect(inbound.modules.find((m) => m.key === "chain_free_inventory")?.enabled).toBe(false);
    expect(inbound.modules.find((m) => m.key === "document_vault")?.enabled).toBe(true);
    expect(inbound.modules.find((m) => m.key === "case_threads")?.enabled).toBe(false);
    expect(inbound.modules.find((m) => m.key === "seller_milestone_views")?.enabled).toBe(false);
    expect(inbound.modules.find((m) => m.key === "hard_client_sla")?.enabled).toBe(false);
    expect(inbound.stages.map((s) => s.key)).not.toContain("chain_free_matching");
    expect(inbound.playbookStageKeys).toEqual(inbound.stages.map((s) => s.key));

    const outbound = marketPackSummary(ukAuMarketPack, "UK_RESIDENT_SPEED");
    expect(outbound.locale.currencyCode).toBe("AUD");
    expect(outbound.stages.map((s) => s.key)).toContain("finance_path");
    expect(JSON.stringify(outbound)).not.toContain(
      ukAuMarketPack.buildPlaybooks("UK_RESIDENT_SPEED")[0]!.objective,
    );
  });
});
