import { describe, it, expect } from "vitest";
import { clientStageView, canViewPlaybook } from "../../src/domain/freemium";
import { createCase } from "../../src/domain/stage-engine";
import { ewPlaybooks } from "../../src/domain/market-packs/ew-playbook";
import {
  assertPlaybookVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";
import { advisorPlaybook } from "../../src/lib/cockpit-playbook";

describe("playbook visibility", () => {
  it("is advisor-only, whatever the tier", () => {
    expect(() => assertPlaybookVisible("ADVISOR")).not.toThrow();
    expect(() => assertPlaybookVisible("CLIENT")).toThrow(CockpitPolicyError);
    expect(() => assertPlaybookVisible("CONVEYANCER")).toThrow(/advisor-only/i);
  });

  it("keeps the freemium rule that free clients never unlock playbooks", () => {
    const free = createCase({
      id: "pb_free",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(canViewPlaybook(free, "money_readiness")).toBe(false);
  });

  it("still gives the advisor a playbook on free cases", () => {
    const free = createCase({
      id: "pb_free_2",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(advisorPlaybook(free, "money_readiness")?.stageKey).toBe(
      "money_readiness",
    );
  });

  it("never leaks playbook text into a client stage view", () => {
    const free = createCase({
      id: "pb_leak",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    const serialised = JSON.stringify(
      clientStageView(free, new Date("2026-09-04T10:00:00.000Z")),
    );

    for (const playbook of ewPlaybooks("RETURNER_OVERSEAS")) {
      expect(serialised).not.toContain(playbook.objective);
      for (const step of playbook.actions) {
        expect(serialised).not.toContain(step.action);
      }
      for (const standard of playbook.evidenceStandard) {
        expect(serialised).not.toContain(standard);
      }
    }
  });
});
