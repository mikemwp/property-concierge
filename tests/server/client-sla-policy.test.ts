import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ClientSlaError } from "../../src/domain/client-sla";
import {
  assertClientSlaVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";
import { assertClientSla, canUseClientSla } from "../../src/server/client-sla";

function paid() {
  return createCase({ id: "slap1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("client SLA module gate", () => {
  it("is open for any tier on the England & Wales pack", () => {
    expect(canUseClientSla(paid())).toBe(true);
    expect(
      canUseClientSla(
        createCase({ id: "slap2", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" }),
      ),
    ).toBe(true);
    expect(() => assertClientSla(paid())).not.toThrow();
  });

  it("is closed when the resolved pack does not enable the module", () => {
    const other = { ...paid(), marketPackId: "au" };
    expect(canUseClientSla(other)).toBe(false);
    expect(() => assertClientSla(other)).toThrow(ClientSlaError);
  });
});

describe("SLA publish-panel visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertClientSlaVisible("ADVISOR")).not.toThrow();
    expect(() => assertClientSlaVisible("CLIENT")).toThrow(CockpitPolicyError);
    expect(() => assertClientSlaVisible("CONVEYANCER")).toThrow(/advisor-only/i);
  });
});

describe("cockpit wiring contract", () => {
  it("keeps the publish panel import off the portal page", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    expect(portal).not.toContain("ClientSlaPublishPanel");
    expect(portal).not.toContain("advisorSlaView");
    expect(portal).not.toContain("assertClientSlaVisible");
  });
});
