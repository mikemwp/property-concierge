import { describe, it, expect } from "vitest";
import { usDisclosureText } from "../../src/domain/market-packs/us-disclosure";

describe("United States destination disclosure", () => {
  it("states introducer-only and no mortgage advice for brokers", () => {
    const text = usDisclosureText({
      role: "MORTGAGE_PARTNER",
      partnerName: "Jordan Hale",
      partnerFirm: "Liberty Lending",
    });
    expect(text).toContain("Jordan Hale (Liberty Lending)");
    expect(text).toMatch(/introducer only/i);
    expect(text).toMatch(/do not give mortgage advice/i);
    expect(text).toMatch(/free to use any mortgage broker/i);
  });

  it("discloses a referral fee for closing attorneys and commission for movers", () => {
    expect(
      usDisclosureText({
        role: "CONVEYANCER",
        partnerName: "Riley Cho",
        partnerFirm: null,
      }),
    ).toMatch(/free to instruct any closing attorney or escrow company/i);
    expect(
      usDisclosureText({
        role: "MOVE_PARTNER",
        partnerName: "Pat Nguyen",
        partnerFirm: "Atlantic Movers",
      }),
    ).toMatch(/free to use any movers/i);
  });

  it("refuses client and advisor roles", () => {
    expect(() =>
      usDisclosureText({ role: "ADVISOR", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles only/i);
  });
});
