import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import { isMilestoneForRole, milestonesForRole } from "../../src/domain/market-packs/types";
import { makeFixturePack } from "../support/fixture-pack";

describe("partner milestones come from the pack", () => {
  it("gives England & Wales its own conveyancing and mortgage vocabulary", () => {
    expect(milestonesForRole(ewMarketPack, "CONVEYANCER").map((m) => m.key)).toEqual([
      "client_care_sent",
      "searches_ordered",
      "enquiries_raised",
      "report_issued",
    ]);
    expect(milestonesForRole(ewMarketPack, "MORTGAGE_PARTNER").map((m) => m.key)).toEqual([
      "fact_find_booked",
      "dip_submitted",
      "lender_decision",
    ]);
    expect(milestonesForRole(ewMarketPack, "MOVE_PARTNER").map((m) => m.key)).toEqual([
      "survey_booked",
      "quote_issued",
      "date_held",
    ]);
  });

  it("gives no milestones to non-partner roles or to the disabled stub pack", () => {
    expect(milestonesForRole(ewMarketPack, "CLIENT")).toEqual([]);
    expect(milestonesForRole(ewMarketPack, "ADVISOR")).toEqual([]);
    expect(milestonesForRole(auStubPack, "CONVEYANCER")).toEqual([]);
  });

  it("validates a milestone against the role in that pack only, and labels it locally", () => {
    expect(isMilestoneForRole(ewMarketPack, "CONVEYANCER", "searches_ordered")).toBe(true);
    expect(isMilestoneForRole(ewMarketPack, "MORTGAGE_PARTNER", "searches_ordered")).toBe(false);
    expect(isMilestoneForRole(makeFixturePack(), "CONVEYANCER", "searches_ordered")).toBe(false);
    expect(isMilestoneForRole(makeFixturePack(), "CONVEYANCER", "settlement_lodged")).toBe(true);
    expect(milestonesForRole(ewMarketPack, "CONVEYANCER")[1].label).toBe("Searches ordered");
  });
});
