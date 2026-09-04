import { describe, it, expect } from "vitest";
import {
  canTransitionFee,
  defaultFeeStatus,
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
