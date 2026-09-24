import { describe, it, expect } from "vitest";
import { auDisclosureText } from "../../src/domain/market-packs/au-disclosure";

describe("Australia destination disclosure", () => {
  it("states introducer-only and no credit advice for mortgage brokers", () => {
    const text = auDisclosureText({
      role: "MORTGAGE_PARTNER",
      partnerName: "Mia Chen",
      partnerFirm: "Harbour Brokers",
    });
    expect(text).toContain("Mia Chen (Harbour Brokers)");
    expect(text).toMatch(/introducer only/i);
    expect(text).toMatch(/do not give credit assistance or mortgage advice/i);
    expect(text).toMatch(/free to use any mortgage broker/i);
  });

  it("discloses a referral fee for conveyancers and commission for removalists", () => {
    expect(
      auDisclosureText({
        role: "CONVEYANCER",
        partnerName: "Owen Blake",
        partnerFirm: null,
      }),
    ).toMatch(/free to instruct any conveyancer or solicitor/i);
    expect(
      auDisclosureText({
        role: "MOVE_PARTNER",
        partnerName: "Sam Reid",
        partnerFirm: "Southern Cross Removalists",
      }),
    ).toMatch(/free to use any removalist/i);
  });

  it("refuses client and advisor roles", () => {
    expect(() =>
      auDisclosureText({ role: "CLIENT", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles only/i);
  });
});
