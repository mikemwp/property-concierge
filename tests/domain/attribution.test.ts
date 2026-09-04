import { describe, it, expect } from "vitest";
import {
  DEFAULT_ATTRIBUTION,
  isDiasporaLead,
  isLeadSource,
  parseAttribution,
  sanitiseTag,
} from "../../src/domain/attribution";

describe("sanitiseTag", () => {
  it("slugifies, lowercases, and drops empty values", () => {
    expect(sanitiseTag("  Poms In Oz!! ")).toBe("poms-in-oz");
    expect(sanitiseTag("")).toBeNull();
    expect(sanitiseTag(undefined)).toBeNull();
    expect(sanitiseTag(null)).toBeNull();
  });

  it("caps tag length at 64 characters", () => {
    expect(sanitiseTag("x".repeat(200))?.length).toBe(64);
  });
});

describe("parseAttribution", () => {
  it("defaults to DIRECT when no params are present", () => {
    expect(parseAttribution({})).toEqual(DEFAULT_ATTRIBUTION);
  });

  it("maps known diaspora community sources", () => {
    expect(parseAttribution({ utm_source: "poms-in-oz" }).leadSource).toBe(
      "DIASPORA_AU_UK",
    );
    expect(parseAttribution({ utm_source: "Brits-In-America" }).leadSource).toBe(
      "DIASPORA_US_UK",
    );
  });

  it("prefers the diaspora source over a referral code", () => {
    const parsed = parseAttribution({ utm_source: "au-uk", ref: "Sarah W" });
    expect(parsed.leadSource).toBe("DIASPORA_AU_UK");
    expect(parsed.leadReferrer).toBe("sarah-w");
  });

  it("treats a community medium as a community referral", () => {
    expect(
      parseAttribution({ utm_source: "expat-forum", utm_medium: "community" })
        .leadSource,
    ).toBe("COMMUNITY_REFERRAL");
  });

  it("treats a bare referral code as a partner referral", () => {
    expect(parseAttribution({ ref: "conveyancer-x" }).leadSource).toBe(
      "PARTNER_REFERRAL",
    );
  });

  it("treats unknown sources as organic and keeps the campaign", () => {
    const parsed = parseAttribution({
      utm_source: "some-blog",
      utm_campaign: "Autumn 2026",
    });
    expect(parsed.leadSource).toBe("ORGANIC");
    expect(parsed.leadCampaign).toBe("autumn-2026");
  });

  it("flags diaspora leads for the community validation metric", () => {
    expect(isDiasporaLead("DIASPORA_AU_UK")).toBe(true);
    expect(isDiasporaLead("DIASPORA_US_UK")).toBe(true);
    expect(isDiasporaLead("COMMUNITY_REFERRAL")).toBe(true);
    expect(isDiasporaLead("ORGANIC")).toBe(false);
    expect(isDiasporaLead("DIRECT")).toBe(false);
  });

  it("recognises persisted lead source strings", () => {
    expect(isLeadSource("DIASPORA_US_UK")).toBe(true);
    expect(isLeadSource("nonsense")).toBe(false);
  });
});
