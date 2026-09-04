import { describe, it, expect } from "vitest";
import { formatMoney } from "../../src/domain/market-packs/locale";
import {
  getStageTemplate,
  isModuleEnabled,
  MARKET_COPY_KEYS,
  MARKET_MODULE_KEYS,
  packEvidenceKinds,
  partnerRoleLabel,
  stageTemplateFor,
} from "../../src/domain/market-packs/types";
import { EW_LOCALE } from "../../src/domain/market-packs/ew-config";
import { makeFixturePack } from "../support/fixture-pack";

describe("pack-parametric helpers", () => {
  const pack = makeFixturePack();

  it("reads stage templates through the pack, whatever the stage keys are", () => {
    expect(getStageTemplate(pack, "RETURNER_OVERSEAS").map((s) => s.key)).toEqual([
      "local_profile",
      "local_settlement",
    ]);
    expect(stageTemplateFor(pack, "RETURNER_OVERSEAS", "local_settlement")?.slaDays).toBe(11);
    expect(stageTemplateFor(pack, "RETURNER_OVERSEAS", "mortgage_path")).toBeNull();
  });

  it("unions evidence kinds across every entry context, sorted and deduped", () => {
    expect(packEvidenceKinds(pack)).toEqual([
      "profile_complete",
      "settlement_booked",
      "transfer_plan",
    ]);
  });

  it("treats an omitted module flag as off", () => {
    expect(isModuleEnabled(pack.flags, "corridor_inbound")).toBe(true);
    expect(isModuleEnabled(pack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled({}, "fx_deposit")).toBe(false);
  });

  it("labels partner roles from the pack, not from a hardcoded map", () => {
    expect(partnerRoleLabel(pack, "CONVEYANCER")).toBe("settlement agent");
    expect(partnerRoleLabel(pack, "MOVE_PARTNER")).toBe("removalist");
  });

  it("keeps the module and copy key sets closed", () => {
    expect(MARKET_MODULE_KEYS).toContain("chain_free_inventory");
    expect(MARKET_MODULE_KEYS).toContain("hard_client_sla");
    expect(MARKET_COPY_KEYS).toEqual([
      "jurisdiction_scope",
      "mortgage_posture",
      "region_prompt",
      "directory_intro",
    ]);
  });
});

describe("locale money formatting", () => {
  it("formats whole units in the pack's own currency", () => {
    expect(formatMoney(EW_LOCALE, 1000)).toBe("£1,000");
    expect(formatMoney(makeFixturePack().locale, 1000)).toBe("$1,000");
  });
});
