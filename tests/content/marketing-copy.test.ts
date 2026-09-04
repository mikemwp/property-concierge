import { describe, it, expect } from "vitest";
import {
  ENTRY_STORIES,
  FORBIDDEN_CLAIM_PATTERNS,
  FREE_PLAN,
  OUT_OF_SCOPE_GEO_PATTERNS,
  PAID_ONLY_CAPABILITY_PATTERNS,
  PAID_PLAN,
  PLAN_ORDER,
  REGULATORY_DISCLOSURES,
  marketingClaimStrings,
  storyBySlug,
} from "../../src/content/marketing";
import type { EntryContext } from "../../src/domain/types";

describe("freemium discipline in marketing copy", () => {
  it("makes paid the primary plan and shows it first", () => {
    expect(PAID_PLAN.primary).toBe(true);
    expect(FREE_PLAN.primary).toBe(false);
    expect(PLAN_ORDER[0].slug).toBe("paid");
  });

  it("never advertises paid-only capabilities as free features", () => {
    for (const feature of FREE_PLAN.features) {
      for (const pattern of PAID_ONLY_CAPABILITY_PATTERNS) {
        expect(
          pattern.test(feature),
          `free feature "${feature}" matches paid-only ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it("states what free withholds", () => {
    expect(FREE_PLAN.limits.length).toBeGreaterThanOrEqual(3);
    expect(PAID_PLAN.features.length).toBeGreaterThanOrEqual(4);
  });
});

describe("regulatory and scope discipline", () => {
  it("makes no forbidden claims anywhere in the sales copy", () => {
    for (const text of marketingClaimStrings()) {
      for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        expect(pattern.test(text), `"${text}" matches ${pattern}`).toBe(false);
      }
    }
  });

  it("stays inside England & Wales", () => {
    const claims = marketingClaimStrings();
    for (const text of claims) {
      for (const pattern of OUT_OF_SCOPE_GEO_PATTERNS) {
        expect(pattern.test(text), `"${text}" matches ${pattern}`).toBe(false);
      }
    }
    expect(claims.some((text) => /England & Wales/.test(text))).toBe(true);
  });

  it("discloses introducer-only mortgages and referral fees", () => {
    const joined = REGULATORY_DISCLOSURES.join(" ");
    expect(joined).toMatch(/introducer/i);
    expect(joined).toMatch(/referral fee/i);
    expect(joined).toMatch(/England & Wales/);
  });
});

describe("entry stories", () => {
  it("covers every entry context with unique slugs", () => {
    const covered = new Set(ENTRY_STORIES.map((s) => s.entryContext));
    const expected: EntryContext[] = [
      "RETURNER_OVERSEAS",
      "RETURNER_IN_UK",
      "UK_RESIDENT_SPEED",
    ];
    for (const entry of expected) {
      expect(covered.has(entry)).toBe(true);
    }
    const slugs = ENTRY_STORIES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("looks stories up by slug", () => {
    expect(storyBySlug("returning-from-australia")?.entryContext).toBe(
      "RETURNER_OVERSEAS",
    );
    expect(storyBySlug("not-a-story")).toBeNull();
  });
});
