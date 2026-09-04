import { describe, it, expect } from "vitest";
import {
  canTransitionFee,
  defaultFeeStatus,
  disclosureTextFor,
  FEE_STATUSES,
  isFeeStatus,
} from "../../src/domain/referral";
import { isPartnerActorRole, PARTNER_ROLES } from "../../src/domain/types";

describe("partner roles", () => {
  it("identifies the three typed partner roles", () => {
    expect(PARTNER_ROLES).toEqual(["MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"]);
    expect(isPartnerActorRole("CONVEYANCER")).toBe(true);
    expect(isPartnerActorRole("CLIENT")).toBe(false);
    expect(isPartnerActorRole("ADVISOR")).toBe(false);
  });
});

describe("fee status", () => {
  it("guards the closed set", () => {
    for (const status of FEE_STATUSES) {
      expect(isFeeStatus(status)).toBe(true);
    }
    expect(isFeeStatus("PAID")).toBe(false);
  });

  it("defaults to EXPECTED for partner roles and NONE otherwise", () => {
    expect(defaultFeeStatus("MORTGAGE_PARTNER")).toBe("EXPECTED");
    expect(defaultFeeStatus("CONVEYANCER")).toBe("EXPECTED");
    expect(defaultFeeStatus("MOVE_PARTNER")).toBe("EXPECTED");
    expect(defaultFeeStatus("CLIENT")).toBe("NONE");
  });

  it("only allows forward transitions and treats RECEIVED / WAIVED as terminal", () => {
    expect(canTransitionFee("NONE", "EXPECTED")).toBe(true);
    expect(canTransitionFee("NONE", "WAIVED")).toBe(true);
    expect(canTransitionFee("EXPECTED", "RECEIVED")).toBe(true);
    expect(canTransitionFee("EXPECTED", "WAIVED")).toBe(true);
    expect(canTransitionFee("EXPECTED", "NONE")).toBe(false);
    expect(canTransitionFee("RECEIVED", "WAIVED")).toBe(false);
    expect(canTransitionFee("WAIVED", "EXPECTED")).toBe(false);
    expect(canTransitionFee("EXPECTED", "EXPECTED")).toBe(false);
  });
});

describe("disclosureTextFor (England & Wales)", () => {
  it("states introducer-only and no advice for mortgage partners", () => {
    const text = disclosureTextFor({
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
    const text = disclosureTextFor({
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
    const text = disclosureTextFor({
      role: "MOVE_PARTNER",
      partnerName: "Dan Whitfield",
      partnerFirm: "Compass Removals",
    });
    expect(text).toMatch(/commission/i);
    expect(text).toMatch(/free to use any removals/i);
  });

  it("never promises outcomes and rejects non-partner roles", () => {
    for (const role of ["MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"] as const) {
      const text = disclosureTextFor({ role, partnerName: "X", partnerFirm: null });
      expect(text).not.toMatch(/guarantee/i);
    }
    expect(() =>
      disclosureTextFor({ role: "CLIENT", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles/i);
  });
});
