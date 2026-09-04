import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
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
  });

  it("lists every module with its state and every stage in order", () => {
    expect(summary.modules).toHaveLength(MARKET_MODULE_KEYS.length);
    expect(summary.modules.find((m) => m.key === "fx_deposit")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "chain_free_inventory")?.enabled).toBe(false);
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

  it("summarises a disabled pack without enabling it", () => {
    const stub = marketPackSummary(auStubPack, "UK_RESIDENT_SPEED");
    expect(stub.enabled).toBe(false);
    expect(stub.locale.currencyCode).toBe("AUD");
    expect(stub.stages.map((s) => s.key)).toContain("finance_path");
    expect(stub.playbookStageKeys).toEqual([]);
    expect(stub.evidenceKinds).toEqual([]);
  });
});
