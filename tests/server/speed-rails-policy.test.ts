import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertSpeedRails, canUseSpeedRails } from "../../src/server/partner-policy";

function paid() {
  return createCase({ id: "sr1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("speed rails gate", () => {
  it("is open for a paid case on the England & Wales pack", () => {
    expect(canUseSpeedRails(paid())).toBe(true);
    expect(() => assertSpeedRails(paid())).not.toThrow();
  });

  it("is closed on free DIY", () => {
    const free = createCase({ id: "sr2", entryContext: "UK_RESIDENT_SPEED", tier: "FREE_DIY" });
    expect(canUseSpeedRails(free)).toBe(false);
    expect(() => assertSpeedRails(free)).toThrow(/paid/i);
  });

  it("is closed for a pack with the module off", () => {
    const other = { ...paid(), marketPackId: "au" };
    expect(canUseSpeedRails(other)).toBe(false);
    expect(() => assertSpeedRails(other)).toThrow();
  });
});
