import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import {
  assertCertificationVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";
import {
  assertChainFree,
  canUseChainFree,
} from "../../src/server/chain-free";
import { ChainFreeError } from "../../src/domain/chain-free";

function paid() {
  return createCase({ id: "cfp1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("chain-free module gate", () => {
  it("is open for any tier on the England & Wales pack", () => {
    expect(canUseChainFree(paid())).toBe(true);
    expect(
      canUseChainFree(
        createCase({ id: "cfp2", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" }),
      ),
    ).toBe(true);
    expect(() => assertChainFree(paid())).not.toThrow();
  });

  it("is closed when the resolved pack does not enable the module", () => {
    const other = { ...paid(), marketPackId: "au" };
    expect(canUseChainFree(other)).toBe(false);
    expect(() => assertChainFree(other)).toThrow(ChainFreeError);
  });
});

describe("certification checklist visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertCertificationVisible("ADVISOR")).not.toThrow();
    expect(() => assertCertificationVisible("CLIENT")).toThrow(CockpitPolicyError);
    expect(() => assertCertificationVisible("CONVEYANCER")).toThrow(/advisor-only/i);
  });
});

describe("cockpit wiring", () => {
  it("renders the certification panel on the advisor case page and keeps checklist IP off the portal", () => {
    const cockpit = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    expect(cockpit).toContain("ChainFreeCertificationPanel");
    expect(cockpit).toContain("assertCertificationVisible");
    expect(cockpit).toContain("loadCertification");
    expect(portal).not.toContain("ChainFreeCertificationPanel");
    expect(portal).not.toContain("advisorCertificationView");
  });
});
