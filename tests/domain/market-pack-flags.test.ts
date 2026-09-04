import { describe, it, expect } from "vitest";
import { listMarketPacks } from "../../src/domain/market-packs/registry";
import { moneyEvidenceKinds } from "../../src/domain/market-packs/ew-stages";
import { EW_FLAGS } from "../../src/domain/market-packs/ew-config";
import {
  isModuleEnabled,
  MARKET_MODULE_KEYS,
  packModules,
} from "../../src/domain/market-packs/types";

/** Spec §9: "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real." */
const GATED_MODULES = [
  "chain_free_inventory",
  "hard_client_sla",
  "corridor_inbound",
  "corridor_outbound",
  "document_vault",
  "partner_speed_rails",
] as const;

describe("module flags are pack data", () => {
  it("keeps every gated module off in every registered pack", () => {
    for (const pack of listMarketPacks()) {
      for (const key of GATED_MODULES) {
        expect(isModuleEnabled(pack.flags, key), `${pack.id}.${key}`).toBe(false);
      }
    }
  });

  it("enables FX for the deposit in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "fx_deposit"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
  });

  it("lists every module key with its resolved state for a pack", () => {
    const rows = packModules(listMarketPacks().find((p) => p.id === "ew")!);
    expect(rows).toHaveLength(MARKET_MODULE_KEYS.length);
    expect(rows.find((r) => r.key === "fx_deposit")?.enabled).toBe(true);
    expect(rows.find((r) => r.key === "hard_client_sla")?.enabled).toBe(false);
  });
});

describe("the fx_deposit module drives required evidence", () => {
  it("requires an FX plan only when the module is on and the entry needs currency work", () => {
    expect(moneyEvidenceKinds("RETURNER_OVERSEAS", EW_FLAGS)).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(moneyEvidenceKinds("UK_RESIDENT_SPEED", EW_FLAGS)).toEqual(["source_of_funds"]);
  });

  it("drops the FX plan entirely for a pack with the module off", () => {
    expect(moneyEvidenceKinds("RETURNER_OVERSEAS", {})).toEqual(["source_of_funds"]);
    expect(moneyEvidenceKinds("RETURNER_IN_UK", { fx_deposit: false })).toEqual([
      "source_of_funds",
    ]);
  });
});
