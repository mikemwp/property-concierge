import { describe, it, expect } from "vitest";
import { casePack, stageSlaDays } from "../../src/lib/case-pack";
import { createCase } from "../../src/domain/stage-engine";
import { MarketPackError } from "../../src/domain/market-packs/types";

const base = { id: "cp_1", entryContext: "RETURNER_OVERSEAS", tier: "PAID_DWY" } as const;

describe("case pack resolution", () => {
  it("resolves the pack and per-stage SLA from the case, not from a constant", () => {
    const caseState = createCase({ ...base });
    expect(casePack(caseState).id).toBe("ew");
    expect(stageSlaDays(caseState, "diligence")).toBe(21);
    expect(stageSlaDays(caseState, "offer_instruct")).toBe(5);
  });

  it("uses the pack SLA for chain_free_matching and falls back for unknown keys", () => {
    const caseState = createCase({ ...base });
    expect(stageSlaDays(caseState, "chain_free_matching")).toBe(7);
    expect(stageSlaDays(caseState, "unknown_overlay_stage")).toBe(7);
  });

  it("fails closed when the stored pack id is not resolvable", () => {
    const caseState = { ...createCase({ ...base }), marketPackId: "zz" };
    expect(() => casePack(caseState)).toThrow(MarketPackError);
  });
});
