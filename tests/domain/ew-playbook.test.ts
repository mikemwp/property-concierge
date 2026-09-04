import { describe, it, expect } from "vitest";
import { ewMarketPack, getStageTemplate } from "../../src/domain/market-packs/ew";
import {
  ewPlaybooks,
  ewStagePlaybook,
} from "../../src/domain/market-packs/ew-playbook";

describe("ew stage playbooks", () => {
  it("covers every stage key in the market pack, in order", () => {
    const stageKeys = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS").map(
      (s) => s.key,
    );
    expect(ewPlaybooks("RETURNER_OVERSEAS").map((p) => p.stageKey)).toEqual(
      stageKeys,
    );
  });

  it("gives every stage real operating depth", () => {
    for (const playbook of ewPlaybooks("RETURNER_IN_UK")) {
      expect(playbook.objective.length).toBeGreaterThan(20);
      expect(playbook.actions.length).toBeGreaterThanOrEqual(2);
      expect(playbook.evidenceStandard.length).toBeGreaterThanOrEqual(1);
      expect(playbook.escalation.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("branches money and move steps on entry context", () => {
    const overseasMoney = ewStagePlaybook("money_readiness", "RETURNER_OVERSEAS");
    const domesticMoney = ewStagePlaybook("money_readiness", "UK_RESIDENT_SPEED");
    expect(
      overseasMoney?.actions.some((a) => /fx|transfer/i.test(a.action)),
    ).toBe(true);
    expect(
      domesticMoney?.actions.some((a) => /fx|transfer/i.test(a.action)),
    ).toBe(false);

    const overseasMove = ewStagePlaybook("move_logistics", "RETURNER_OVERSEAS");
    const domesticMove = ewStagePlaybook("move_logistics", "UK_RESIDENT_SPEED");
    expect(
      overseasMove?.actions.some((a) => /container|vehicle/i.test(a.action)),
    ).toBe(true);
    expect(
      domesticMove?.actions.some((a) => /container|vehicle/i.test(a.action)),
    ).toBe(false);
  });

  it("returns null for unknown stage keys", () => {
    expect(ewStagePlaybook("chain_free_matching", "RETURNER_IN_UK")).toBeNull();
  });
});
