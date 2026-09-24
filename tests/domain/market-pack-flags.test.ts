import { describe, it, expect } from "vitest";
import { CORRIDOR_PACK_IDS, listMarketPacks } from "../../src/domain/market-packs/registry";
import { moneyEvidenceKinds } from "../../src/domain/market-packs/ew-stages";
import { EW_FLAGS } from "../../src/domain/market-packs/ew-config";
import {
  isModuleEnabled,
  MARKET_MODULE_KEYS,
  packModules,
} from "../../src/domain/market-packs/types";

const GATED_MODULES = ["hard_client_sla"] as const;

describe("module flags are pack data", () => {
  it("keeps every globally gated module off in every registered pack", () => {
    for (const pack of listMarketPacks()) {
      for (const key of GATED_MODULES) {
        expect(isModuleEnabled(pack.flags, key), `${pack.id}.${key}`).toBe(false);
      }
    }
  });

  it("enables FX on the beachhead pack and on every registered corridor pack", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "fx_deposit"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["au_uk", "ew", "uk_au", "uk_us", "us_uk"]);
  });

  it("runs partner speed rails in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "partner_speed_rails"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
  });

  it("runs the chain-free overlay in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "chain_free_inventory"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "hard_client_sla"),
    ).toBe(false);
  });

  it("runs the document vault in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "document_vault"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "document_vault")).toBe(
      false,
    );
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au_uk")!.flags, "document_vault"),
    ).toBe(false);
    expect(isModuleEnabled(EW_FLAGS, "hard_client_sla")).toBe(false);
  });

  it("turns corridor modules on only for the four corridor packs", () => {
    const inbound = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "corridor_inbound"))
      .map((pack) => pack.id);
    const outbound = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "corridor_outbound"))
      .map((pack) => pack.id);
    expect(inbound).toEqual([...CORRIDOR_PACK_IDS]);
    expect(outbound).toEqual([...CORRIDOR_PACK_IDS]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "ew")!.flags, "corridor_inbound")).toBe(
      false,
    );
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "corridor_outbound")).toBe(
      false,
    );
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
