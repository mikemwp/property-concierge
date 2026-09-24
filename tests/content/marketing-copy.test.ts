import { describe, it, expect } from "vitest";
import {
  CASE_THREAD_HOOK,
  SELLER_VIEW_HOOK,
  CHAIN_FREE_HOOK,
  CLIENT_SLA_HOOK,
  ENTRY_STORIES,
  FORBIDDEN_CLAIM_PATTERNS,
  FORBIDDEN_INVENTORY_PATTERNS,
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

describe("chain-free beachhead hook", () => {
  it("names chain-free as positioning and paid orchestration as the product", () => {
    const blob = `${CHAIN_FREE_HOOK.eyebrow} ${CHAIN_FREE_HOOK.headline} ${CHAIN_FREE_HOOK.body}`;
    expect(blob).toMatch(/chain-free/i);
    expect(blob).toMatch(/orchestrat/i);
    expect(blob).not.toMatch(/guarantee/i);
    for (const pattern of FORBIDDEN_INVENTORY_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
  });

  it("keeps inventory, private seller intros and listing-feed claims out of every sales string", () => {
    for (const text of marketingClaimStrings()) {
      for (const pattern of FORBIDDEN_INVENTORY_PATTERNS) {
        expect(pattern.test(text), `"${text}" matches ${pattern}`).toBe(false);
      }
    }
  });
});

describe("client SLA hook is a target, not a promise", () => {
  it("names published targets and carve-outs without guarantee or listings language", () => {
    const blob = `${CLIENT_SLA_HOOK.eyebrow} ${CLIENT_SLA_HOOK.headline} ${CLIENT_SLA_HOOK.body}`;
    expect(blob).toMatch(/target/i);
    expect(blob).toMatch(/working toward/i);
    expect(blob).toMatch(/carve-out/i);
    expect(blob).not.toMatch(/guarante/i);
    expect(blob).not.toMatch(/rightmove|zoopla/i);
    expect(blob).not.toMatch(/complete in \d+/i);
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
    for (const pattern of FORBIDDEN_INVENTORY_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
  });

  it("keeps the footer disclosure on planning targets", () => {
    expect(REGULATORY_DISCLOSURES.some((line) => /planning targets/i.test(line))).toBe(true);
    expect(REGULATORY_DISCLOSURES.some((line) => /carve-out/i.test(line))).toBe(true);
  });
});

describe("case thread hook is an audit trail, not live chat", () => {
  it("names the append-only thread and forbids realtime or guarantee language", () => {
    const blob = `${CASE_THREAD_HOOK.eyebrow} ${CASE_THREAD_HOOK.headline} ${CASE_THREAD_HOOK.body}`;
    expect(blob).toMatch(/thread/i);
    expect(blob).toMatch(/append-only/i);
    expect(blob).toMatch(/refresh/i);
    expect(blob.replace(/not a live chat/gi, "")).not.toMatch(/live chat/i);
    expect(blob).toMatch(/not a live chat/i);
    expect(blob).not.toMatch(/websocket|real-?time|pusher|ably/i);
    expect(blob).not.toMatch(/guarante/i);
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
    for (const pattern of FORBIDDEN_INVENTORY_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
  });

  it("keeps the case thread out of free features and states the withhold", () => {
    expect(FREE_PLAN.limits.some((line) => /case thread/i.test(line))).toBe(true);
    for (const feature of FREE_PLAN.features) {
      expect(/case thread/i.test(feature), feature).toBe(false);
    }
  });
});

describe("seller milestone hook is a buyer ledger snapshot", () => {
  it("names advisor-shared buyer progress without inventory or introductions", () => {
    const blob = `${SELLER_VIEW_HOOK.eyebrow} ${SELLER_VIEW_HOOK.headline} ${SELLER_VIEW_HOOK.body}`;
    expect(blob).toMatch(/buyer/i);
    expect(blob).toMatch(/ledger|progress/i);
    expect(blob).toMatch(/advisor/i);
    expect(blob.replace(/not a seller login/gi, "")).not.toMatch(/seller login/i);
    expect(blob.replace(/not a listing/gi, "")).not.toMatch(/inventory|listing feed/i);
    expect(blob.replace(/not an introduction/gi, "")).not.toMatch(/introduc/i);
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
    for (const pattern of FORBIDDEN_INVENTORY_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
  });
});
