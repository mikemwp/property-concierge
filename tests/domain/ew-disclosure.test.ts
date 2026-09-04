import { describe, it, expect } from "vitest";
import { ewMarketPack } from "../../src/domain/market-packs/ew";

const disclose = ewMarketPack.disclosureText;

describe("England & Wales disclosure copy", () => {
  it("states introducer-only and no advice for mortgage partners", () => {
    const text = disclose({
      role: "MORTGAGE_PARTNER",
      partnerName: "Priya Nair",
      partnerFirm: "Northstar Mortgages",
    });
    expect(text).toContain("Priya Nair (Northstar Mortgages)");
    expect(text).toMatch(/introducer only/i);
    expect(text).toMatch(/do not give mortgage advice/i);
    expect(text).toMatch(/free to use any mortgage adviser/i);
  });

  it("discloses a referral fee and freedom to instruct for conveyancers", () => {
    const text = disclose({
      role: "CONVEYANCER",
      partnerName: "Lena Okoro",
      partnerFirm: null,
    });
    expect(text).toContain("Lena Okoro");
    expect(text).not.toContain("(");
    expect(text).toMatch(/referral fee/i);
    expect(text).toMatch(/free to instruct any conveyancer/i);
  });

  it("discloses commission for move partners", () => {
    const text = disclose({
      role: "MOVE_PARTNER",
      partnerName: "Dan Whitfield",
      partnerFirm: "Compass Removals",
    });
    expect(text).toMatch(/commission/i);
    expect(text).toMatch(/free to use any removals/i);
  });

  it("never promises outcomes and rejects non-partner roles", () => {
    for (const role of ["MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"] as const) {
      const text = disclose({ role, partnerName: "X", partnerFirm: null });
      expect(text).not.toMatch(/guarantee/i);
    }
    expect(() =>
      disclose({ role: "CLIENT", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles/i);
  });
});

describe("the region prompt is pack copy", () => {
  it("names England & Wales in the ew pack only", () => {
    expect(ewMarketPack.copy.region_prompt).toBe("Where in England & Wales are you buying?");
  });
});
