# Returner Acquisition Funnel & Paid Orchestration Ops Playbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working stage portal from Plan 1 into a self-serve returner acquisition funnel — a diaspora-led marketing site, a signup that creates a real `Case` with entry context, tier and lead attribution, advisor-only stage playbooks with real operating depth, and the advisor controls plus validation metrics needed to run 10–20 households through the paid product.

**Architecture:** Same Next.js App Router monolith. New public route group `(marketing)` (no auth, no middleware) renders copy from a pure, test-guarded content module and funnels visitors to `/start`, which calls a server action that validates intake in a pure domain module and creates `User(CLIENT)` + `Case` through the existing `createCaseRecord`. Lead attribution is parsed by a pure `src/domain/attribution.ts` and persisted as three columns on `Case`. Operating IP (stage playbooks) lives in the E&W market pack as data and is rendered only inside `/cockpit`. Advisor tier upgrade and entry-context edits are pure `CaseState` transitions layered on the existing stage engine, persisted by the existing `saveCase`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma + SQLite, Auth.js (NextAuth v5) credentials, bcryptjs, Tailwind CSS v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§1 v1 customer, §5 freemium discipline, §6 surfaces, §7 regulatory posture, §8 validation metrics, §13 sub-project 2)

**Builds on (already shipped, do not rebuild):** `docs/superpowers/plans/2026-09-04-core-stage-portal.md` — stage engine, freemium gating, Prisma persistence, Auth.js credentials login, portal/cockpit/partner surfaces, E&W market pack.

**Follow-on plans (not this plan):** partner scorecards + referral fee/disclosure ledger (sub-project 3), market-pack configuration layer, deep partner integrations, chain-free, additional corridors.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include this section.

- **Freemium discipline — paid is the product:** "Paid done-with-you is the default product in UX, copy, and outcomes." The paid CTA is always primary; free is never presented as an equivalent choice.
- **Free is a funnel, not a substitute:** free gets "Orientation, high-level stage map, education, a taste of accountability" and a "Partner directory (not warm intro)". It "must not give away operating IP that lets someone run the full purchase as a peer alternative."
- **IP behind paid:** "Detailed playbooks and evidence standards for verified gates; Partner routing logic and warm-intro threads; Escalation rules and advisor cockpit behaviours; Full 'who's blocking / what good looks like' operating system." Playbooks render in `/cockpit` only — never in `/portal`, never in marketing copy.
- **v1 paid promise only:** "Orchestration + warm intros to named mortgage / conveyancer / removals (and related) partners; advisor stays in the multi-party thread." No soft published timelines, no hard guarantee dates anywhere in copy.
- **Geography v1:** "Buy anywhere in England & Wales. Scotland and Northern Ireland out of scope for v1." `marketPackId` stays `"ew"`.
- **Entry context is metadata, not product identity:** `RETURNER_OVERSEAS | RETURNER_IN_UK | UK_RESIDENT_SPEED`. "Do not hard-code 'international only' into stage names or domain objects."
- **Regulatory posture:** "Mortgage: introducer only; no advice." "Conveyancing referrals: lawful if disclosed." "Buyer-side orchestrator: avoid estate-agency activity." "Hard guarantees only after legal review of carve-outs."
- **Validation metrics this plan must produce evidence for:** "~10–20 households through the real workflow" and "Become a default recommendation in 1–2 diaspora communities" — measured by "diaspora referral source" on the case.
- **Explicit non-goals in this plan:** partner scorecards, referral fee ledger, document vault binary uploads, chain-free anything, hard SLAs, real third-party APIs (FX/mortgage/removals), Rightmove/Zoopla search or scraping, CRM.
- **Engineering:** TDD (failing test → implement → pass → commit) per task; pure domain modules import no framework code; server actions follow the existing `{ ok: true } | { ok: false; error }` shape; DRY, YAGNI.

## File structure (locked)

```
prisma/
  schema.prisma                       # MODIFY: Case gains leadSource/leadCampaign/leadReferrer
  seed.ts                             # MODIFY: seeded cases carry attribution
src/
  content/
    marketing.ts                      # NEW: all marketing copy + compliance guard patterns (pure)
  domain/
    attribution.ts                    # NEW: utm/ref → LeadSource (pure)
    intake.ts                         # NEW: signup field validation → ParsedIntake (pure)
    case-admin.ts                     # NEW: upgradeToPaid / setEntryContext (pure)
    funnel.ts                         # NEW: diaspora funnel summary maths (pure)
    stage-engine.ts                   # MODIFY: CaseState.attribution + 2 error codes
    market-packs/
      ew-playbook.ts                  # NEW: advisor operating IP per stage per entry context
  lib/
    marketing-links.ts                # NEW: startHref / attributionParamsFrom (pure)
    cockpit-playbook.ts               # REWRITE: returns StagePlaybook, drops placeholder strings
  server/
    cases.ts                          # MODIFY: attribution on create, stale evidence cleanup, listFunnelRows
    mappers.ts                        # MODIFY: attribution mapping
    cockpit-policy.ts                 # MODIFY: assertPlaybookVisible
    signup.ts                         # NEW: createSelfServeCase
  app/
    page.tsx                          # DELETE (moves into the marketing route group)
    (marketing)/
      layout.tsx                      # NEW: public nav + regulatory footer
      page.tsx                        # NEW: returner story home
      pricing/page.tsx                # NEW: free vs paid, paid primary
      stories/[slug]/page.tsx         # NEW: per-entry-context story pages
      start/page.tsx                  # NEW: self-serve intake
    actions/
      signup.ts                       # NEW: signUpAction
      case-admin.ts                   # NEW: upgradeCaseAction / setEntryContextAction
    cockpit/
      layout.tsx                      # MODIFY: nav links
      cases/page.tsx                  # MODIFY: lead source badge
      cases/[caseId]/page.tsx         # MODIFY: playbook panel + admin controls
      funnel/page.tsx                 # NEW: diaspora validation metrics
  components/
    marketing/PlanCards.tsx           # NEW
    marketing/StartForm.tsx           # NEW (client)
    PlaybookPanel.tsx                 # NEW
    CaseAdminControls.tsx             # NEW (client)
tests/
  content/marketing-copy.test.ts      # NEW
  content/outreach-checklist.test.ts  # NEW
  domain/attribution.test.ts          # NEW
  domain/intake.test.ts               # NEW
  domain/ew-playbook.test.ts          # NEW
  domain/case-admin.test.ts           # NEW
  domain/funnel.test.ts               # NEW
  domain/stage-engine.test.ts         # MODIFY
  lib/marketing-links.test.ts         # NEW
  server/signup.test.ts               # NEW
  server/cockpit-playbook-policy.test.ts # NEW
  server/cases.roundtrip.test.ts      # MODIFY
docs/
  playbooks/diaspora-outreach-checklist.md          # NEW (founder content)
  superpowers/plans/demo-script-acquisition-funnel.md # NEW
vitest.config.ts                      # MODIFY: fileParallelism false (shared SQLite file)
README.md                             # MODIFY
```

---

### Task 1: Lead attribution domain module

**Files:**
- Create: `src/domain/attribution.ts`
- Test: `tests/domain/attribution.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports)
- Produces:
  - `type LeadSource = "DIASPORA_AU_UK" | "DIASPORA_US_UK" | "COMMUNITY_REFERRAL" | "PARTNER_REFERRAL" | "ORGANIC" | "DIRECT"`
  - `type LeadAttribution = { leadSource: LeadSource; leadCampaign: string | null; leadReferrer: string | null }`
  - `type RawAttributionParams = { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; ref?: string | null }`
  - `const DEFAULT_ATTRIBUTION: LeadAttribution`
  - `sanitiseTag(value?: string | null): string | null`
  - `parseAttribution(params: RawAttributionParams): LeadAttribution`
  - `isLeadSource(value: string): value is LeadSource`
  - `isDiasporaLead(source: LeadSource): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/attribution.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/attribution.test.ts`

Expected: FAIL — `Failed to resolve import "../../src/domain/attribution"`

- [ ] **Step 3: Implement the module**

Create `src/domain/attribution.ts`:

```ts
export type LeadSource =
  | "DIASPORA_AU_UK"
  | "DIASPORA_US_UK"
  | "COMMUNITY_REFERRAL"
  | "PARTNER_REFERRAL"
  | "ORGANIC"
  | "DIRECT";

export type LeadAttribution = {
  leadSource: LeadSource;
  leadCampaign: string | null;
  leadReferrer: string | null;
};

export type RawAttributionParams = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  ref?: string | null;
};

const LEAD_SOURCES: readonly LeadSource[] = [
  "DIASPORA_AU_UK",
  "DIASPORA_US_UK",
  "COMMUNITY_REFERRAL",
  "PARTNER_REFERRAL",
  "ORGANIC",
  "DIRECT",
];

export const DEFAULT_ATTRIBUTION: LeadAttribution = {
  leadSource: "DIRECT",
  leadCampaign: null,
  leadReferrer: null,
};

const MAX_TAG_LENGTH = 64;

/** Campaign tags we hand out to diaspora communities. Keep in sync with the outreach checklist. */
const SOURCE_MAP: Record<string, LeadSource> = {
  "au-uk": "DIASPORA_AU_UK",
  "poms-in-oz": "DIASPORA_AU_UK",
  "brits-in-australia": "DIASPORA_AU_UK",
  "us-uk": "DIASPORA_US_UK",
  "brits-in-america": "DIASPORA_US_UK",
  "brits-in-usa": "DIASPORA_US_UK",
  community: "COMMUNITY_REFERRAL",
  partner: "PARTNER_REFERRAL",
  google: "ORGANIC",
  organic: "ORGANIC",
  newsletter: "ORGANIC",
};

const COMMUNITY_MEDIUMS = new Set(["community", "group", "forum", "meetup"]);

export function sanitiseTag(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : null;
}

export function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

export function isDiasporaLead(source: LeadSource): boolean {
  return (
    source === "DIASPORA_AU_UK" ||
    source === "DIASPORA_US_UK" ||
    source === "COMMUNITY_REFERRAL"
  );
}

export function parseAttribution(params: RawAttributionParams): LeadAttribution {
  const source = sanitiseTag(params.utm_source);
  const medium = sanitiseTag(params.utm_medium);
  const leadCampaign = sanitiseTag(params.utm_campaign);
  const leadReferrer = sanitiseTag(params.ref);

  const mapped = source ? SOURCE_MAP[source] : undefined;

  let leadSource: LeadSource;
  if (mapped && mapped !== "ORGANIC") {
    leadSource = mapped;
  } else if (medium && COMMUNITY_MEDIUMS.has(medium)) {
    leadSource = "COMMUNITY_REFERRAL";
  } else if (leadReferrer) {
    leadSource = "PARTNER_REFERRAL";
  } else if (source) {
    leadSource = "ORGANIC";
  } else {
    leadSource = "DIRECT";
  }

  return { leadSource, leadCampaign, leadReferrer };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/attribution.test.ts`

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/attribution.ts tests/domain/attribution.test.ts
git commit -m "feat: parse utm and referral params into lead sources"
```

---

### Task 2: Persist lead attribution on the Case

**Files:**
- Modify: `prisma/schema.prisma` (model `Case`)
- Modify: `src/domain/stage-engine.ts` (`CaseState`, `createCase`)
- Modify: `src/server/mappers.ts` (`toCaseState`)
- Modify: `src/server/cases.ts` (`createCaseRecord`, `toCaseWithRelations`)
- Modify: `prisma/seed.ts`
- Test: `tests/domain/stage-engine.test.ts` (append), `tests/server/cases.roundtrip.test.ts` (append)

**Interfaces:**
- Consumes: `LeadAttribution`, `DEFAULT_ATTRIBUTION`, `isLeadSource` from `src/domain/attribution.ts`
- Produces:
  - `CaseState.attribution: LeadAttribution` (present on every case)
  - `createCase(input: { id; entryContext; tier; marketPackId?; attribution?: LeadAttribution; now? }): CaseState`
  - `createCaseRecord(input: { title; entryContext; tier; clientUserId; advisorUserId; marketPackId?; attribution?: LeadAttribution }): Promise<CaseState>`
  - Prisma `Case.leadSource: String @default("DIRECT")`, `Case.leadCampaign: String?`, `Case.leadReferrer: String?`
- Note: attribution is **write-once**. `saveCase` deliberately does not update it.

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/stage-engine.test.ts`:

```ts
describe("case attribution", () => {
  it("defaults to DIRECT attribution", () => {
    const c = createCase({
      id: "attr_1",
      entryContext: "RETURNER_IN_UK",
      tier: "PAID_DWY",
    });
    expect(c.attribution).toEqual({
      leadSource: "DIRECT",
      leadCampaign: null,
      leadReferrer: null,
    });
  });

  it("keeps supplied attribution on the case state", () => {
    const c = createCase({
      id: "attr_2",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      attribution: {
        leadSource: "DIASPORA_AU_UK",
        leadCampaign: "spring-return",
        leadReferrer: null,
      },
    });
    expect(c.attribution.leadSource).toBe("DIASPORA_AU_UK");
    expect(c.attribution.leadCampaign).toBe("spring-return");
  });
});
```

Append to `tests/server/cases.roundtrip.test.ts` inside the existing `describe("cases persistence", ...)` block:

```ts
  it("round-trips lead attribution on a case", async () => {
    const created = await createCaseRecord({
      title: "Diaspora signup",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
      attribution: {
        leadSource: "DIASPORA_AU_UK",
        leadCampaign: "poms-in-oz-sept",
        leadReferrer: "sarah-w",
      },
    });

    expect(created.attribution.leadSource).toBe("DIASPORA_AU_UK");

    const loaded = await loadCase(created.id);
    expect(loaded.attribution).toEqual({
      leadSource: "DIASPORA_AU_UK",
      leadCampaign: "poms-in-oz-sept",
      leadReferrer: "sarah-w",
    });
  });

  it("defaults existing cases without attribution to DIRECT", async () => {
    const created = await createCaseRecord({
      title: "No attribution",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "FREE_DIY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
    });
    const loaded = await loadCase(created.id);
    expect(loaded.attribution.leadSource).toBe("DIRECT");
    expect(loaded.attribution.leadCampaign).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/stage-engine.test.ts tests/server/cases.roundtrip.test.ts`

Expected: FAIL — `Property 'attribution' does not exist` / `expected undefined to equal ...`

- [ ] **Step 3: Add the columns and thread attribution through**

In `prisma/schema.prisma`, add three fields to `model Case` (after `title`):

```prisma
model Case {
  id            String   @id @default(cuid())
  marketPackId  String
  entryContext  String
  tier          String
  title         String
  leadSource    String   @default("DIRECT")
  leadCampaign  String?
  leadReferrer  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  stages        Stage[]
  participants  CaseParticipant[]
  events        StageEvent[]
}
```

Run: `npx prisma db push && npx prisma generate`

In `src/domain/stage-engine.ts`, add the import, extend `CaseState`, and extend `createCase`:

```ts
import { DEFAULT_ATTRIBUTION, type LeadAttribution } from "./attribution";
```

```ts
export type CaseState = {
  id: string;
  marketPackId: string;
  entryContext: EntryContext;
  tier: Tier;
  attribution: LeadAttribution;
  stages: StageState[];
  events: Array<{
    type: string;
    stageKey: string;
    actorRole: ActorRole;
    at: string;
    payload?: string;
  }>;
};
```

```ts
export function createCase(input: {
  id: string;
  entryContext: EntryContext;
  tier: Tier;
  marketPackId?: string;
  attribution?: LeadAttribution;
  now?: Date;
}): CaseState {
```

and in its returned object, add `attribution: input.attribution ?? DEFAULT_ATTRIBUTION,` directly after `tier: input.tier,`.

In `src/server/mappers.ts`, add the import and map the columns:

```ts
import { DEFAULT_ATTRIBUTION, isLeadSource, type LeadAttribution } from "../domain/attribution";
```

```ts
function toAttribution(record: {
  leadSource: string;
  leadCampaign: string | null;
  leadReferrer: string | null;
}): LeadAttribution {
  return {
    leadSource: isLeadSource(record.leadSource)
      ? record.leadSource
      : DEFAULT_ATTRIBUTION.leadSource,
    leadCampaign: record.leadCampaign,
    leadReferrer: record.leadReferrer,
  };
}
```

and inside `toCaseState`'s returned object add `attribution: toAttribution(record),` directly after `tier: record.tier as Tier,`.

In `src/server/cases.ts`:

1. Add `import type { LeadAttribution } from "../domain/attribution";`
2. Add the three fields to the structural parameter type of `toCaseWithRelations` (after `title: string;`):

```ts
  leadSource: string;
  leadCampaign: string | null;
  leadReferrer: string | null;
```

3. Extend `createCaseRecord` to accept and persist attribution:

```ts
export async function createCaseRecord(input: {
  title: string;
  entryContext: EntryContext;
  tier: Tier;
  clientUserId: string;
  advisorUserId: string;
  marketPackId?: string;
  attribution?: LeadAttribution;
}): Promise<CaseState> {
  const marketPackId = input.marketPackId ?? "ew";
  const initialState = createCase({
    id: "pending",
    entryContext: input.entryContext,
    tier: input.tier,
    marketPackId,
    attribution: input.attribution,
  });

  const record = await prisma.case.create({
    data: {
      marketPackId,
      entryContext: input.entryContext,
      tier: input.tier,
      title: input.title,
      leadSource: initialState.attribution.leadSource,
      leadCampaign: initialState.attribution.leadCampaign,
      leadReferrer: initialState.attribution.leadReferrer,
      participants: {
```

(the rest of the `create` call is unchanged)

In `prisma/seed.ts`, give the seeded cases realistic attribution and add a third case so the funnel view has data:

```ts
  await createCaseRecord({
    title: "Bloggs return (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    attribution: {
      leadSource: "DIASPORA_AU_UK",
      leadCampaign: "poms-in-oz-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Smith DIY journey",
    entryContext: "UK_RESIDENT_SPEED",
    tier: "FREE_DIY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    attribution: {
      leadSource: "ORGANIC",
      leadCampaign: null,
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Okafor US return (free)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "FREE_DIY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    attribution: {
      leadSource: "DIASPORA_US_UK",
      leadCampaign: "brits-in-america-sept",
      leadReferrer: null,
    },
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS — all existing suites plus the four new attribution assertions

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts src/domain/stage-engine.ts src/server/mappers.ts src/server/cases.ts tests/domain/stage-engine.test.ts tests/server/cases.roundtrip.test.ts
git commit -m "feat: persist lead attribution on cases for diaspora validation"
```

---

### Task 3: Marketing copy module with freemium and compliance guards

**Files:**
- Create: `src/content/marketing.ts`
- Test: `tests/content/marketing-copy.test.ts`

**Interfaces:**
- Consumes: `EntryContext`, `Tier` from `src/domain/types.ts`
- Produces:
  - `type PlanCopy = { tier: Tier; slug: "free" | "paid"; name: string; tagline: string; primary: boolean; price: string; features: string[]; limits: string[]; ctaLabel: string }`
  - `type EntryStory = { slug: string; entryContext: EntryContext; eyebrow: string; headline: string; subhead: string; proofPoints: string[]; firstMoves: string[] }`
  - `const HERO: { headline: string; subhead: string; primaryCta: string; secondaryCta: string }`
  - `const FREE_PLAN: PlanCopy`, `const PAID_PLAN: PlanCopy`, `const PLAN_ORDER: PlanCopy[]` (paid first)
  - `const ENTRY_STORIES: EntryStory[]`, `storyBySlug(slug: string): EntryStory | null`
  - `const REGULATORY_DISCLOSURES: string[]`
  - `const PAID_ONLY_CAPABILITY_PATTERNS: RegExp[]`, `const FORBIDDEN_CLAIM_PATTERNS: RegExp[]`, `const OUT_OF_SCOPE_GEO_PATTERNS: RegExp[]`
  - `marketingClaimStrings(): string[]` — every promise-bearing string except the disclosures, so the compliance test can scan them

- [ ] **Step 1: Write the failing test**

Create `tests/content/marketing-copy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: FAIL — `Failed to resolve import "../../src/content/marketing"`

- [ ] **Step 3: Implement the copy module**

Create `src/content/marketing.ts`:

```ts
import type { EntryContext, Tier } from "../domain/types";

export type PlanCopy = {
  tier: Tier;
  slug: "free" | "paid";
  name: string;
  tagline: string;
  primary: boolean;
  price: string;
  features: string[];
  limits: string[];
  ctaLabel: string;
};

export type EntryStory = {
  slug: string;
  entryContext: EntryContext;
  eyebrow: string;
  headline: string;
  subhead: string;
  proofPoints: string[];
  firstMoves: string[];
};

export const HERO = {
  headline: "Buy a home in England & Wales from 10,000 miles away.",
  subhead:
    "For UK and dual nationals coming home from Australia and the United States. One stage plan, one advisor who owns it, and a portal that always names who is holding things up.",
  primaryCta: "Start Done-With-You",
  secondaryCta: "See the free stage map",
};

export const PAID_PLAN: PlanCopy = {
  tier: "PAID_DWY",
  slug: "paid",
  name: "Done-With-You orchestration",
  tagline: "We run the purchase. You make the decisions.",
  primary: true,
  price: "Fixed fee, quoted on your first call",
  features: [
    "A named advisor who owns every stage from profile to completion",
    "Warm introductions to vetted mortgage, conveyancing and removals partners",
    "Your advisor stays in the thread with every partner, in your timezone",
    "We chase the blocker; you see the day counter and who owns it",
    "Evidence checked against our standard before a stage is marked done",
  ],
  limits: [],
  ctaLabel: "Start Done-With-You",
};

export const FREE_PLAN: PlanCopy = {
  tier: "FREE_DIY",
  slug: "free",
  name: "Free orientation",
  tagline: "See the map. Run it yourself.",
  primary: false,
  price: "£0",
  features: [
    "The full nine-stage purchase map for England & Wales",
    "A plain-English explainer of what each stage is for",
    "Tick off the starter stages yourself as you go",
    "A directory of the partner categories you will need to find",
  ],
  limits: [
    "No named owner or day counters once you reach a money or legal stage",
    "No introductions — you source, vet and brief every partner yourself",
    "Nobody chases when a stage stalls; the map waits for you",
  ],
  ctaLabel: "Take the free orientation",
};

export const PLAN_ORDER: PlanCopy[] = [PAID_PLAN, FREE_PLAN];

export const ENTRY_STORIES: EntryStory[] = [
  {
    slug: "returning-from-australia",
    entryContext: "RETURNER_OVERSEAS",
    eyebrow: "AU → UK",
    headline: "Coming back from Australia with a purchase to land.",
    subhead:
      "Deposit in AUD, a thin UK credit file, a container on the water and a lender who wants documents at 3am your time. That is the job we take off you.",
    proofPoints: [
      "Deposit timing planned around your transfer, not the other way round",
      "UK credit-file groundwork started months before you fly",
      "Container, vehicle and storage decisions sequenced against completion",
      "Your advisor holds the 3am conversations so you do not have to",
    ],
    firstMoves: [
      "Set your target region and realistic arrival window",
      "Start the money readiness pack while you are still earning offshore",
      "Get introduced to a mortgage partner who has done returner cases",
    ],
  },
  {
    slug: "returning-from-the-usa",
    entryContext: "RETURNER_OVERSEAS",
    eyebrow: "US → UK",
    headline: "Moving back from the States without losing a year to it.",
    subhead:
      "A US salary history that UK lenders read badly, a dollar deposit to move, and school dates that will not shift. One stage plan holds all three together.",
    proofPoints: [
      "Lender routes that understand US income and short UK address history",
      "Dollar deposit movement planned against exchange and completion dates",
      "School and term dates treated as fixed constraints in the plan",
      "Shipping and vehicle decisions sequenced, not guessed",
    ],
    firstMoves: [
      "Confirm your household constraints and target region",
      "Build the source-of-funds pack once, reuse it everywhere",
      "Get introduced to a mortgage partner before you start viewing",
    ],
  },
  {
    slug: "back-in-the-uk-with-family",
    entryContext: "RETURNER_IN_UK",
    eyebrow: "Already landed",
    headline: "Back in the UK, in the spare room, and stuck.",
    subhead:
      "You are here, the boxes are in storage, and every week in temporary accommodation costs money. The plan starts from where you actually are.",
    proofPoints: [
      "Finance verification first, so viewings are not wasted",
      "Buyer-ready status you can show an agent on day one",
      "Storage and move logistics timed to the legal stages",
      "A single portal instead of six email threads with family in the room",
    ],
    firstMoves: [
      "Confirm budget band and must-haves in the purchase profile",
      "Close out money readiness with verified evidence",
      "Move to search readiness with a buyer-ready position",
    ],
  },
  {
    slug: "buying-faster-at-home",
    entryContext: "UK_RESIDENT_SPEED",
    eyebrow: "Already here",
    headline: "Same engine, no international assumptions.",
    subhead:
      "You live here and you want the purchase run properly: one owner per stage, evidence checked once, and somebody chasing the party who is late.",
    proofPoints: [
      "The same nine-stage ledger, without the currency and shipping steps",
      "One owner at a time, with the day counter visible",
      "Conveyancer and survey stages actively chased, not tracked",
      "Everything in one portal with an audit trail",
    ],
    firstMoves: [
      "Set your target region and timeline in the purchase profile",
      "Complete money readiness to become a credible buyer",
      "Get introduced to a conveyancer before your offer is accepted",
    ],
  },
];

export function storyBySlug(slug: string): EntryStory | null {
  return ENTRY_STORIES.find((story) => story.slug === slug) ?? null;
}

export const REGULATORY_DISCLOSURES: string[] = [
  "Mortgages: we are an introducer only. We do not give mortgage advice — that comes from the FCA-authorised firm we introduce you to.",
  "We may receive a disclosed referral fee from partners you choose to use. It never changes what you pay them, and we tell you before the introduction.",
  "We act for buyers only, in England & Wales. We do not market property for sellers.",
  "Any dates you see in the portal are planning targets from our own stage ledger, not a promise of a completion date.",
];

/** Capabilities that must stay behind the paid tier in every free-facing list. */
export const PAID_ONLY_CAPABILITY_PATTERNS: RegExp[] = [
  /warm intro/i,
  /introduction/i,
  /named advisor/i,
  /named partner/i,
  /playbook/i,
  /evidence standard/i,
  /escalat/i,
  /\bsla\b/i,
  /we chase/i,
  /day counter/i,
];

/** Claims we must never make in v1 sales copy. */
export const FORBIDDEN_CLAIM_PATTERNS: RegExp[] = [
  /guarantee/i,
  /guaranteed/i,
  /mortgage advice/i,
  /we advise/i,
  /chain[- ]free/i,
  /rightmove/i,
  /zoopla/i,
];

export const OUT_OF_SCOPE_GEO_PATTERNS: RegExp[] = [
  /\bscotland\b/i,
  /northern ireland/i,
];

/** Every promise-bearing string, excluding the disclosures (which must name what we do not do). */
export function marketingClaimStrings(): string[] {
  const planStrings = PLAN_ORDER.flatMap((plan) => [
    plan.name,
    plan.tagline,
    plan.price,
    plan.ctaLabel,
    ...plan.features,
    ...plan.limits,
  ]);

  const storyStrings = ENTRY_STORIES.flatMap((story) => [
    story.eyebrow,
    story.headline,
    story.subhead,
    ...story.proofPoints,
    ...story.firstMoves,
  ]);

  return [
    HERO.headline,
    HERO.subhead,
    HERO.primaryCta,
    HERO.secondaryCta,
    ...planStrings,
    ...storyStrings,
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/content/marketing.ts tests/content/marketing-copy.test.ts
git commit -m "feat: returner marketing copy with freemium and compliance guards"
```

---

### Task 4: Public marketing site with paid-primary funnel

**Files:**
- Create: `src/lib/marketing-links.ts`, `src/components/marketing/PlanCards.tsx`, `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/pricing/page.tsx`, `src/app/(marketing)/stories/[slug]/page.tsx`
- Delete: `src/app/page.tsx` (its route moves into the `(marketing)` group — leaving both causes a duplicate `/` route error)
- Test: `tests/lib/marketing-links.test.ts`

**Interfaces:**
- Consumes: `src/content/marketing.ts`, `RawAttributionParams` from `src/domain/attribution.ts`, `EntryContext`
- Produces:
  - `startHref(input: { plan: "free" | "paid"; entryContext?: EntryContext; params?: RawAttributionParams }): string`
  - `attributionParamsFrom(searchParams: Record<string, string | string[] | undefined>): RawAttributionParams`
  - `<PlanCards params={RawAttributionParams} entryContext?={EntryContext} />`
  - Public routes `/`, `/pricing`, `/stories/[slug]` — unauthenticated (middleware only matches `/portal`, `/cockpit`, `/partner`)

- [ ] **Step 1: Write the failing test**

Create `tests/lib/marketing-links.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { attributionParamsFrom, startHref } from "../../src/lib/marketing-links";

describe("startHref", () => {
  it("always carries the chosen plan", () => {
    expect(startHref({ plan: "paid" })).toBe("/start?plan=paid");
    expect(startHref({ plan: "free" })).toBe("/start?plan=free");
  });

  it("carries entry context and attribution params through the funnel", () => {
    expect(
      startHref({
        plan: "paid",
        entryContext: "RETURNER_OVERSEAS",
        params: { utm_source: "poms-in-oz", utm_campaign: "sept", ref: "sarah" },
      }),
    ).toBe(
      "/start?plan=paid&entry=RETURNER_OVERSEAS&utm_source=poms-in-oz&utm_campaign=sept&ref=sarah",
    );
  });

  it("omits blank params", () => {
    expect(
      startHref({ plan: "free", params: { utm_source: "  ", ref: null } }),
    ).toBe("/start?plan=free");
  });
});

describe("attributionParamsFrom", () => {
  it("takes the first value of repeated params and nulls the rest", () => {
    expect(
      attributionParamsFrom({
        utm_source: ["au-uk", "ignored"],
        utm_campaign: "sept",
        plan: "paid",
      }),
    ).toEqual({
      utm_source: "au-uk",
      utm_medium: null,
      utm_campaign: "sept",
      ref: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/marketing-links.test.ts`

Expected: FAIL — `Failed to resolve import "../../src/lib/marketing-links"`

- [ ] **Step 3: Implement links, layout and pages**

Create `src/lib/marketing-links.ts`:

```ts
import type { RawAttributionParams } from "@/domain/attribution";
import type { EntryContext } from "@/domain/types";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "ref",
] as const;

export function startHref(input: {
  plan: "free" | "paid";
  entryContext?: EntryContext;
  params?: RawAttributionParams;
}): string {
  const query = new URLSearchParams();
  query.set("plan", input.plan);
  if (input.entryContext) {
    query.set("entry", input.entryContext);
  }

  const params = input.params ?? {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim() !== "") {
      query.set(key, value.trim());
    }
  }

  return `/start?${query.toString()}`;
}

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
}

export function attributionParamsFrom(
  searchParams: Record<string, string | string[] | undefined>,
): RawAttributionParams {
  return {
    utm_source: first(searchParams.utm_source),
    utm_medium: first(searchParams.utm_medium),
    utm_campaign: first(searchParams.utm_campaign),
    ref: first(searchParams.ref),
  };
}
```

Delete the old root page:

```bash
git rm src/app/page.tsx
```

Create `src/components/marketing/PlanCards.tsx`:

```tsx
import Link from "next/link";
import { PLAN_ORDER } from "@/content/marketing";
import type { RawAttributionParams } from "@/domain/attribution";
import type { EntryContext } from "@/domain/types";
import { startHref } from "@/lib/marketing-links";

type Props = {
  params: RawAttributionParams;
  entryContext?: EntryContext;
};

export function PlanCards({ params, entryContext }: Props) {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      {PLAN_ORDER.map((plan) => (
        <div
          key={plan.slug}
          className={
            plan.primary
              ? "rounded-xl border-2 border-indigo-500 bg-white p-6 shadow-sm"
              : "rounded-xl border border-slate-200 bg-white p-6"
          }
        >
          {plan.primary && (
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
              Recommended
            </span>
          )}
          <h3 className="mt-3 text-xl font-semibold text-slate-900">
            {plan.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
          <p className="mt-3 text-sm font-medium text-slate-900">{plan.price}</p>

          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {plan.features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>

          {plan.limits.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
              {plan.limits.map((limit) => (
                <li key={limit}>– {limit}</li>
              ))}
            </ul>
          )}

          <Link
            href={startHref({ plan: plan.slug, entryContext, params })}
            className={
              plan.primary
                ? "mt-6 block rounded bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                : "mt-6 block rounded border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            {plan.ctaLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}
```

Create `src/app/(marketing)/layout.tsx`:

```tsx
import Link from "next/link";
import { ENTRY_STORIES, REGULATORY_DISCLOSURES } from "@/content/marketing";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="font-semibold text-slate-900">
            Property Concierge
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {ENTRY_STORIES.map((story) => (
              <Link
                key={story.slug}
                href={`/stories/${story.slug}`}
                className="text-slate-600 hover:text-slate-900"
              >
                {story.eyebrow}
              </Link>
            ))}
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-xs text-slate-500">
          {REGULATORY_DISCLOSURES.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </footer>
    </div>
  );
}
```

Create `src/app/(marketing)/page.tsx`:

```tsx
import Link from "next/link";
import { PlanCards } from "@/components/marketing/PlanCards";
import { ENTRY_STORIES, HERO } from "@/content/marketing";
import { attributionParamsFrom, startHref } from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarketingHomePage({ searchParams }: Props) {
  const params = attributionParamsFrom(await searchParams);

  return (
    <div>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900">
        {HERO.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">{HERO.subhead}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={startHref({ plan: "paid", params })}
          className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {HERO.primaryCta}
        </Link>
        <Link
          href={startHref({ plan: "free", params })}
          className="rounded border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {HERO.secondaryCta}
        </Link>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-slate-900">
          Where are you starting from?
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ENTRY_STORIES.map((story) => (
            <Link
              key={story.slug}
              href={`/stories/${story.slug}`}
              className="rounded-lg border border-slate-200 p-5 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {story.eyebrow}
              </span>
              <h3 className="mt-2 font-medium text-slate-900">
                {story.headline}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{story.subhead}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-slate-900">
          Two ways in. Only one of them runs the purchase for you.
        </h2>
        <PlanCards params={params} />
      </section>
    </div>
  );
}
```

Create `src/app/(marketing)/pricing/page.tsx`:

```tsx
import { PlanCards } from "@/components/marketing/PlanCards";
import { attributionParamsFrom } from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PricingPage({ searchParams }: Props) {
  const params = attributionParamsFrom(await searchParams);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">
        What you get, and what you do yourself
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Done-With-You is the product: a named advisor, warm partner
        introductions, and someone chasing the blocker. The free orientation
        exists so you can see the shape of the job before you decide.
      </p>
      <PlanCards params={params} />
    </div>
  );
}
```

Create `src/app/(marketing)/stories/[slug]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanCards } from "@/components/marketing/PlanCards";
import { ENTRY_STORIES, storyBySlug } from "@/content/marketing";
import { attributionParamsFrom, startHref } from "@/lib/marketing-links";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return ENTRY_STORIES.map((story) => ({ slug: story.slug }));
}

export default async function StoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const story = storyBySlug(slug);
  if (!story) {
    notFound();
  }

  const attribution = attributionParamsFrom(await searchParams);

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
        {story.eyebrow}
      </span>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-900">
        {story.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">{story.subhead}</p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium text-slate-900">
            What we take off you
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {story.proofPoints.map((point) => (
              <li key={point}>• {point}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-medium text-slate-900">
            Your first three moves
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            {story.firstMoves.map((move, index) => (
              <li key={move}>
                {index + 1}. {move}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Link
        href={startHref({
          plan: "paid",
          entryContext: story.entryContext,
          params: attribution,
        })}
        className="mt-8 inline-block rounded bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Start Done-With-You
      </Link>

      <PlanCards params={attribution} entryContext={story.entryContext} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests and check the routes**

Run: `npx vitest run tests/lib/marketing-links.test.ts`

Expected: PASS — 4 tests

Run: `npm run build`

Expected: build succeeds with `/`, `/pricing`, `/stories/[slug]` listed and no duplicate-route error.

Manual: `npm run dev`, open `http://localhost:3000/?utm_source=poms-in-oz&utm_campaign=sept` — the primary CTA href must be `/start?plan=paid&utm_source=poms-in-oz&utm_campaign=sept`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing-links.ts src/components/marketing src/app/\(marketing\) tests/lib/marketing-links.test.ts
git rm --cached src/app/page.tsx
git commit -m "feat: returner marketing site with paid-primary funnel links"
```

---

### Task 5: Self-serve intake creating a client and case

**Files:**
- Create: `src/domain/intake.ts`, `src/server/signup.ts`, `src/app/actions/signup.ts`, `src/components/marketing/StartForm.tsx`, `src/app/(marketing)/start/page.tsx`
- Modify: `vitest.config.ts` (disable file parallelism — two suites now share `dev.db`)
- Test: `tests/domain/intake.test.ts`, `tests/server/signup.test.ts`

**Interfaces:**
- Consumes: `parseAttribution`, `LeadAttribution`, `createCaseRecord`, `EntryContext`, `Tier`
- Produces:
  - `type ParsedIntake = { name: string; email: string; password: string; entryContext: EntryContext; tier: Tier; targetRegion: string; caseTitle: string }`
  - `type IntakeResult = { ok: true; value: ParsedIntake } | { ok: false; errors: Record<string, string> }`
  - `parseIntake(fields: IntakeFields): IntakeResult` — **defaults to `PAID_DWY` unless the visitor explicitly picks `free`**
  - `caseTitleFor(name: string, targetRegion: string): string`
  - `const MIN_PASSWORD_LENGTH = 10`
  - `class SignupError extends Error { code: "EMAIL_TAKEN" | "NO_ADVISOR" }`
  - `createSelfServeCase(input: { intake: ParsedIntake; attribution: LeadAttribution }): Promise<{ userId: string; caseId: string; tier: Tier }>`
  - `signUpAction(formData: FormData): Promise<SignupActionResult>` where `SignupActionResult = { ok: true; caseId: string; email: string } | { ok: false; errors: Record<string, string> }`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/intake.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { caseTitleFor, parseIntake } from "../../src/domain/intake";

const valid = {
  name: "Bloggs household",
  email: "Jo@Example.com",
  password: "returning2026",
  entryContext: "RETURNER_OVERSEAS",
  plan: "paid",
  targetRegion: "Bristol",
};

describe("parseIntake", () => {
  it("normalises a valid submission", () => {
    const result = parseIntake(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("jo@example.com");
    expect(result.value.tier).toBe("PAID_DWY");
    expect(result.value.entryContext).toBe("RETURNER_OVERSEAS");
    expect(result.value.caseTitle).toBe("Bloggs household — Bristol");
  });

  it("defaults to the paid tier when no plan is supplied", () => {
    const result = parseIntake({ ...valid, plan: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe("PAID_DWY");
  });

  it("only drops to free when free is explicitly chosen", () => {
    const free = parseIntake({ ...valid, plan: "free" });
    expect(free.ok && free.value.tier).toBe("FREE_DIY");

    const junk = parseIntake({ ...valid, plan: "premium-plus" });
    expect(junk.ok && junk.value.tier).toBe("PAID_DWY");
  });

  it("collects field errors instead of throwing", () => {
    const result = parseIntake({
      name: "  ",
      email: "not-an-email",
      password: "short",
      entryContext: "MARS_RESIDENT",
      plan: "paid",
      targetRegion: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "email",
      "entryContext",
      "name",
      "password",
      "targetRegion",
    ]);
  });
});

describe("caseTitleFor", () => {
  it("builds a household case title", () => {
    expect(caseTitleFor(" Okafor household ", " Leeds ")).toBe(
      "Okafor household — Leeds",
    );
  });
});
```

Create `tests/server/signup.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { loadCase } from "../../src/server/cases";
import { createSelfServeCase, SignupError } from "../../src/server/signup";
import type { ParsedIntake } from "../../src/domain/intake";

const intake: ParsedIntake = {
  name: "Bloggs household",
  email: "signup-client@example.com",
  password: "returning2026",
  entryContext: "RETURNER_OVERSEAS",
  tier: "PAID_DWY",
  targetRegion: "Bristol",
  caseTitle: "Bloggs household — Bristol",
};

describe("createSelfServeCase", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: {
        id: "signup_advisor",
        email: "signup-advisor@example.com",
        role: "ADVISOR",
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a client user and an attributed paid case owned by the advisor", async () => {
    const created = await createSelfServeCase({
      intake,
      attribution: {
        leadSource: "DIASPORA_AU_UK",
        leadCampaign: "poms-in-oz-sept",
        leadReferrer: null,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: created.userId },
    });
    expect(user.role).toBe("CLIENT");
    expect(user.email).toBe("signup-client@example.com");
    expect(await bcrypt.compare("returning2026", user.passwordHash)).toBe(true);

    const caseState = await loadCase(created.caseId);
    expect(caseState.tier).toBe("PAID_DWY");
    expect(caseState.entryContext).toBe("RETURNER_OVERSEAS");
    expect(caseState.attribution.leadSource).toBe("DIASPORA_AU_UK");

    const participants = await prisma.caseParticipant.findMany({
      where: { caseId: created.caseId },
    });
    expect(participants.map((p) => p.role).sort()).toEqual([
      "ADVISOR",
      "CLIENT",
    ]);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      createSelfServeCase({
        intake,
        attribution: {
          leadSource: "DIRECT",
          leadCampaign: null,
          leadReferrer: null,
        },
      }),
    ).rejects.toThrow(SignupError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/intake.test.ts tests/server/signup.test.ts`

Expected: FAIL — both modules unresolved

- [ ] **Step 3: Implement intake, signup, action and page**

Create `src/domain/intake.ts`:

```ts
import type { EntryContext, Tier } from "./types";

export type IntakeFields = {
  name?: string | null;
  email?: string | null;
  password?: string | null;
  entryContext?: string | null;
  plan?: string | null;
  targetRegion?: string | null;
};

export type ParsedIntake = {
  name: string;
  email: string;
  password: string;
  entryContext: EntryContext;
  tier: Tier;
  targetRegion: string;
  caseTitle: string;
};

export type IntakeResult =
  | { ok: true; value: ParsedIntake }
  | { ok: false; errors: Record<string, string> };

export const MIN_PASSWORD_LENGTH = 10;
const MAX_TEXT_LENGTH = 80;

const ENTRY_CONTEXTS: EntryContext[] = [
  "RETURNER_OVERSEAS",
  "RETURNER_IN_UK",
  "UK_RESIDENT_SPEED",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function caseTitleFor(name: string, targetRegion: string): string {
  return `${name.trim()} — ${targetRegion.trim()}`;
}

function isEntryContext(value: string): value is EntryContext {
  return (ENTRY_CONTEXTS as string[]).includes(value);
}

/** Paid is the default product: only an explicit "free" choice downgrades the tier. */
function tierFromPlan(plan?: string | null): Tier {
  return typeof plan === "string" && plan.trim().toLowerCase() === "free"
    ? "FREE_DIY"
    : "PAID_DWY";
}

export function parseIntake(fields: IntakeFields): IntakeResult {
  const errors: Record<string, string> = {};

  const name = (fields.name ?? "").trim();
  if (name.length === 0) {
    errors.name = "Tell us what to call your household.";
  } else if (name.length > MAX_TEXT_LENGTH) {
    errors.name = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
  }

  const email = (fields.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const password = fields.password ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const targetRegion = (fields.targetRegion ?? "").trim();
  if (targetRegion.length === 0) {
    errors.targetRegion = "Where in England & Wales are you buying?";
  } else if (targetRegion.length > MAX_TEXT_LENGTH) {
    errors.targetRegion = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
  }

  const entryValue = (fields.entryContext ?? "").trim();
  if (!isEntryContext(entryValue)) {
    errors.entryContext = "Choose where you are starting from.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      password,
      entryContext: entryValue as EntryContext,
      tier: tierFromPlan(fields.plan),
      targetRegion,
      caseTitle: caseTitleFor(name, targetRegion),
    },
  };
}
```

Create `src/server/signup.ts`:

```ts
import bcrypt from "bcryptjs";
import type { LeadAttribution } from "../domain/attribution";
import type { ParsedIntake } from "../domain/intake";
import type { Tier } from "../domain/types";
import { prisma } from "../lib/db";
import { createCaseRecord } from "./cases";

export type SignupErrorCode = "EMAIL_TAKEN" | "NO_ADVISOR";

export class SignupError extends Error {
  constructor(
    public code: SignupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SignupError";
  }
}

export async function createSelfServeCase(input: {
  intake: ParsedIntake;
  attribution: LeadAttribution;
}): Promise<{ userId: string; caseId: string; tier: Tier }> {
  const email = input.intake.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new SignupError(
      "EMAIL_TAKEN",
      "An account already exists for that email — sign in instead.",
    );
  }

  const advisor = await prisma.user.findFirst({
    where: { role: "ADVISOR" },
    orderBy: { createdAt: "asc" },
  });
  if (!advisor) {
    throw new SignupError(
      "NO_ADVISOR",
      "No advisor is available to take this case yet. Try again shortly.",
    );
  }

  const passwordHash = await bcrypt.hash(input.intake.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.intake.name,
      role: "CLIENT",
      passwordHash,
    },
  });

  const caseState = await createCaseRecord({
    title: input.intake.caseTitle,
    entryContext: input.intake.entryContext,
    tier: input.intake.tier,
    clientUserId: user.id,
    advisorUserId: advisor.id,
    attribution: input.attribution,
  });

  return { userId: user.id, caseId: caseState.id, tier: input.intake.tier };
}
```

Create `src/app/actions/signup.ts`:

```ts
"use server";

import { parseAttribution } from "@/domain/attribution";
import { parseIntake } from "@/domain/intake";
import { createSelfServeCase, SignupError } from "@/server/signup";

export type SignupActionResult =
  | { ok: true; caseId: string; email: string }
  | { ok: false; errors: Record<string, string> };

function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

export async function signUpAction(
  formData: FormData,
): Promise<SignupActionResult> {
  const parsed = parseIntake({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    entryContext: field(formData, "entryContext"),
    plan: field(formData, "plan"),
    targetRegion: field(formData, "targetRegion"),
  });

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const attribution = parseAttribution({
    utm_source: field(formData, "utm_source"),
    utm_medium: field(formData, "utm_medium"),
    utm_campaign: field(formData, "utm_campaign"),
    ref: field(formData, "ref"),
  });

  try {
    const created = await createSelfServeCase({
      intake: parsed.value,
      attribution,
    });
    return { ok: true, caseId: created.caseId, email: parsed.value.email };
  } catch (err) {
    if (err instanceof SignupError) {
      return { ok: false, errors: { form: err.message } };
    }
    return {
      ok: false,
      errors: { form: "Could not create your case. Please try again." },
    };
  }
}
```

Create `src/components/marketing/StartForm.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/app/actions/signup";
import type { RawAttributionParams } from "@/domain/attribution";
import type { EntryContext } from "@/domain/types";

type Props = {
  plan: "free" | "paid";
  entryContext: EntryContext;
  attribution: RawAttributionParams;
};

const ENTRY_OPTIONS: Array<{ value: EntryContext; label: string }> = [
  { value: "RETURNER_OVERSEAS", label: "Still overseas, planning the move" },
  { value: "RETURNER_IN_UK", label: "Back in the UK, temporary set-up" },
  { value: "UK_RESIDENT_SPEED", label: "Living here, want a faster purchase" },
];

export function StartForm({ plan, entryContext, attribution }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const result = await signUpAction(formData);

    if (!result.ok) {
      setErrors(result.errors);
      setPending(false);
      return;
    }

    const signedIn = await signIn("credentials", {
      email: result.email,
      password,
      redirect: false,
    });

    if (signedIn?.error) {
      setErrors({ form: "Case created — please sign in to open it." });
      setPending(false);
      router.push("/login");
      return;
    }

    router.push(`/portal/cases/${result.caseId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-lg space-y-4">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="utm_source" value={attribution.utm_source ?? ""} />
      <input type="hidden" name="utm_medium" value={attribution.utm_medium ?? ""} />
      <input
        type="hidden"
        name="utm_campaign"
        value={attribution.utm_campaign ?? ""}
      />
      <input type="hidden" name="ref" value={attribution.ref ?? ""} />

      {errors.form && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors.form}
        </p>
      )}

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Household name</span>
        <input
          name="name"
          required
          defaultValue=""
          placeholder="Bloggs household"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.name && <span className="text-xs text-red-700">{errors.name}</span>}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.email && <span className="text-xs text-red-700">{errors.email}</span>}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.password && (
          <span className="text-xs text-red-700">{errors.password}</span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Where in England &amp; Wales are you buying?
        </span>
        <input
          name="targetRegion"
          required
          placeholder="Bristol"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.targetRegion && (
          <span className="text-xs text-red-700">{errors.targetRegion}</span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Where are you starting from?
        </span>
        <select
          name="entryContext"
          defaultValue={entryContext}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {ENTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.entryContext && (
          <span className="text-xs text-red-700">{errors.entryContext}</span>
        )}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending
          ? "Creating your case…"
          : plan === "paid"
            ? "Create my Done-With-You case"
            : "Create my free orientation case"}
      </button>
    </form>
  );
}
```

Create `src/app/(marketing)/start/page.tsx`:

```tsx
import Link from "next/link";
import { StartForm } from "@/components/marketing/StartForm";
import { FREE_PLAN, PAID_PLAN } from "@/content/marketing";
import type { EntryContext } from "@/domain/types";
import { attributionParamsFrom, startHref } from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ENTRY_VALUES: EntryContext[] = [
  "RETURNER_OVERSEAS",
  "RETURNER_IN_UK",
  "UK_RESIDENT_SPEED",
];

export default async function StartPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const attribution = attributionParamsFrom(resolved);

  const planParam = Array.isArray(resolved.plan) ? resolved.plan[0] : resolved.plan;
  const plan: "free" | "paid" = planParam === "free" ? "free" : "paid";

  const entryParam = Array.isArray(resolved.entry) ? resolved.entry[0] : resolved.entry;
  const entryContext: EntryContext = ENTRY_VALUES.includes(
    entryParam as EntryContext,
  )
    ? (entryParam as EntryContext)
    : "RETURNER_OVERSEAS";

  const chosen = plan === "free" ? FREE_PLAN : PAID_PLAN;

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">{chosen.name}</h1>
      <p className="mt-2 text-slate-600">{chosen.tagline}</p>

      {plan === "free" ? (
        <p className="mt-4 max-w-2xl rounded border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          The free orientation shows you the map and lets you tick off the
          starter stages. When you want the purchase actually run —{" "}
          <Link
            href={startHref({ plan: "paid", entryContext, params: attribution })}
            className="font-semibold underline"
          >
            switch to Done-With-You
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 max-w-2xl space-y-1 text-sm text-slate-700">
          {PAID_PLAN.features.map((feature) => (
            <li key={feature}>• {feature}</li>
          ))}
        </ul>
      )}

      <StartForm
        plan={plan}
        entryContext={entryContext}
        attribution={attribution}
      />
    </div>
  );
}
```

In `vitest.config.ts`, add `fileParallelism: false` so the two Prisma-backed suites do not truncate each other's tables:

```ts
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: "file:./dev.db" },
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS — including 5 intake tests and 2 signup tests

Manual: `npm run dev`, visit `/start?plan=paid&utm_source=poms-in-oz`, submit the form, land on `/portal/cases/<id>` signed in as the new client.

- [ ] **Step 5: Commit**

```bash
git add src/domain/intake.ts src/server/signup.ts src/app/actions/signup.ts src/components/marketing/StartForm.tsx src/app/\(marketing\)/start vitest.config.ts tests/domain/intake.test.ts tests/server/signup.test.ts
git commit -m "feat: self-serve intake creates attributed client cases"
```

---

### Task 6: Advisor-only stage playbooks with real operating depth

**Files:**
- Create: `src/domain/market-packs/ew-playbook.ts`, `src/components/PlaybookPanel.tsx`
- Rewrite: `src/lib/cockpit-playbook.ts`
- Modify: `src/server/cockpit-policy.ts`, `src/app/cockpit/cases/[caseId]/page.tsx`
- Test: `tests/domain/ew-playbook.test.ts`, `tests/server/cockpit-playbook-policy.test.ts`

**Interfaces:**
- Consumes: `getStageTemplate`, `ewMarketPack`, `EntryContext`, `ActorRole`, `CaseState`, `canViewPlaybook`
- Produces:
  - `type PlaybookAction = { day: number; owner: ActorRole; action: string }`
  - `type StagePlaybook = { stageKey: string; objective: string; actions: PlaybookAction[]; evidenceStandard: string[]; escalation: string[]; partnerScript: string | null }`
  - `ewPlaybooks(entry: EntryContext): StagePlaybook[]` — one per stage key in the pack, same order
  - `ewStagePlaybook(stageKey: string, entry: EntryContext): StagePlaybook | null`
  - `advisorPlaybook(caseState: CaseState, stageKey: string): StagePlaybook | null` (replaces `advisorPlaybookText`)
  - `assertPlaybookVisible(viewerRole: ActorRole): void` — throws `CockpitPolicyError` for any non-advisor
- Removed: `advisorPlaybookText(stageKey: string): string` and its placeholder strings (which were keyed on three stage keys that do not exist in the pack)

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/ew-playbook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ewMarketPack, getStageTemplate } from "../../src/domain/market-packs/ew";
import {
  ewPlaybooks,
  ewStagePlaybook,
} from "../../src/domain/market-packs/ew-playbook";

describe("ew stage playbooks", () => {
  it("covers every stage key in the market pack, in order", () => {
    const stageKeys = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS").map(
      (s) => s.key,
    );
    expect(ewPlaybooks("RETURNER_OVERSEAS").map((p) => p.stageKey)).toEqual(
      stageKeys,
    );
  });

  it("gives every stage real operating depth", () => {
    for (const playbook of ewPlaybooks("RETURNER_IN_UK")) {
      expect(playbook.objective.length).toBeGreaterThan(20);
      expect(playbook.actions.length).toBeGreaterThanOrEqual(2);
      expect(playbook.evidenceStandard.length).toBeGreaterThanOrEqual(1);
      expect(playbook.escalation.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("branches money and move steps on entry context", () => {
    const overseasMoney = ewStagePlaybook("money_readiness", "RETURNER_OVERSEAS");
    const domesticMoney = ewStagePlaybook("money_readiness", "UK_RESIDENT_SPEED");
    expect(
      overseasMoney?.actions.some((a) => /fx|transfer/i.test(a.action)),
    ).toBe(true);
    expect(
      domesticMoney?.actions.some((a) => /fx|transfer/i.test(a.action)),
    ).toBe(false);

    const overseasMove = ewStagePlaybook("move_logistics", "RETURNER_OVERSEAS");
    const domesticMove = ewStagePlaybook("move_logistics", "UK_RESIDENT_SPEED");
    expect(
      overseasMove?.actions.some((a) => /container|vehicle/i.test(a.action)),
    ).toBe(true);
    expect(
      domesticMove?.actions.some((a) => /container|vehicle/i.test(a.action)),
    ).toBe(false);
  });

  it("returns null for unknown stage keys", () => {
    expect(ewStagePlaybook("chain_free_matching", "RETURNER_IN_UK")).toBeNull();
  });
});
```

Create `tests/server/cockpit-playbook-policy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clientStageView, canViewPlaybook } from "../../src/domain/freemium";
import { createCase } from "../../src/domain/stage-engine";
import { ewPlaybooks } from "../../src/domain/market-packs/ew-playbook";
import {
  assertPlaybookVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";
import { advisorPlaybook } from "../../src/lib/cockpit-playbook";

describe("playbook visibility", () => {
  it("is advisor-only, whatever the tier", () => {
    expect(() => assertPlaybookVisible("ADVISOR")).not.toThrow();
    expect(() => assertPlaybookVisible("CLIENT")).toThrow(CockpitPolicyError);
    expect(() => assertPlaybookVisible("CONVEYANCER")).toThrow(/advisor-only/i);
  });

  it("keeps the freemium rule that free clients never unlock playbooks", () => {
    const free = createCase({
      id: "pb_free",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(canViewPlaybook(free, "money_readiness")).toBe(false);
  });

  it("still gives the advisor a playbook on free cases", () => {
    const free = createCase({
      id: "pb_free_2",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(advisorPlaybook(free, "money_readiness")?.stageKey).toBe(
      "money_readiness",
    );
  });

  it("never leaks playbook text into a client stage view", () => {
    const free = createCase({
      id: "pb_leak",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    const serialised = JSON.stringify(
      clientStageView(free, new Date("2026-09-04T10:00:00.000Z")),
    );

    for (const playbook of ewPlaybooks("RETURNER_OVERSEAS")) {
      expect(serialised).not.toContain(playbook.objective);
      for (const step of playbook.actions) {
        expect(serialised).not.toContain(step.action);
      }
      for (const standard of playbook.evidenceStandard) {
        expect(serialised).not.toContain(standard);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/ew-playbook.test.ts tests/server/cockpit-playbook-policy.test.ts`

Expected: FAIL — `ew-playbook` unresolved and `assertPlaybookVisible` / `advisorPlaybook` not exported

- [ ] **Step 3: Implement the playbooks**

Create `src/domain/market-packs/ew-playbook.ts`:

```ts
import type { ActorRole, EntryContext } from "../types";

export type PlaybookAction = {
  /** Working days from stage activation. */
  day: number;
  owner: ActorRole;
  action: string;
};

export type StagePlaybook = {
  stageKey: string;
  objective: string;
  actions: PlaybookAction[];
  evidenceStandard: string[];
  escalation: string[];
  partnerScript: string | null;
};

function isOverseas(entry: EntryContext): boolean {
  return entry === "RETURNER_OVERSEAS";
}

function needsCurrencyWork(entry: EntryContext): boolean {
  return entry !== "UK_RESIDENT_SPEED";
}

export function ewPlaybooks(entry: EntryContext): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective:
        "Lock the household constraints that every later stage is planned against: arrival window, target region, budget band, and who signs.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Run the 20-minute profile call in the client's timezone and write the constraints into the case title and notes.",
        },
        {
          day: 1,
          owner: "ADVISOR",
          action:
            "Sanity-check the stated budget band against the target region; flag it now if the two do not meet.",
        },
        ...(isOverseas(entry)
          ? [
              {
                day: 1,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Confirm the arrival window and whether the client will be in the UK for viewings or buying remotely.",
              },
            ]
          : []),
      ],
      evidenceStandard: [
        "profile_complete: target region named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
      ],
      escalation: [
        "Day 3: no profile call booked — advisor calls, does not email.",
        "Day 5: still unbooked — mark the stage blocked with reason 'client unavailable' so the ledger shows the true owner.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective:
        "Get the deposit provable and movable, and the credit position legible to a UK lender, before anyone views a property.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Issue the source-of-funds list: statements covering six months, evidence of any gift, and the account the deposit will settle from.",
        },
        ...(needsCurrencyWork(entry)
          ? [
              {
                day: 2,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Agree the FX plan: which currency the deposit sits in, the transfer route, and the latest date funds must be in a UK account.",
              },
            ]
          : []),
        ...(isOverseas(entry)
          ? [
              {
                day: 3,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Start UK credit-file groundwork: correspondence address, electoral roll where eligible, and a UK current account opened early.",
              },
            ]
          : []),
        {
          day: 5,
          owner: "ADVISOR",
          action:
            "Review the pack against the standard below and reject anything a lender or conveyancer would bounce — once, properly, not twice.",
        },
      ],
      evidenceStandard: [
        "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every deposit over £1,000 explained.",
        "fx_plan: transfer route named, target settlement date set, and the client understands the rate is not fixed by us.",
      ],
      escalation: [
        "Day 7 (SLA): pack incomplete — advisor calls the client and names the single missing document.",
        "Day 11: still incomplete — block the stage; do not let search readiness start on an unproven deposit.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "mortgage_path",
      objective:
        "Hand a clean, pre-briefed case to the mortgage partner and hold them to a decision in principle without giving advice ourselves.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Send the warm intro with the profile summary, income shape, deposit position and target completion window attached.",
        },
        {
          day: 2,
          owner: "MORTGAGE_PARTNER",
          action:
            "Complete the fact-find and confirm in the thread which lender routes are realistic for this income and address history.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Chase the lender pack if no DIP/AIP has landed; ask for the specific blocking item, not a status update.",
        },
      ],
      evidenceStandard: [
        "dip_aip: decision in principle in writing, naming the lender, the amount, and its expiry date.",
      ],
      escalation: [
        "Day 14 (SLA): no DIP — advisor calls the partner and sets a 48-hour deadline in the thread.",
        "Day 17: still nothing — re-route to the second mortgage partner and log why.",
      ],
      partnerScript:
        "Introducer framing: 'We do not advise on the mortgage. We are handing you a prepared buyer and we will hold the timeline. Confirm the DIP or the blocking item by <date>.'",
    },
    {
      stageKey: "move_logistics",
      objective:
        "Turn the move from an open question into a booked, priced plan that is sequenced against the legal stages.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Brief the move partner with volume, origin, destination region and the earliest and latest acceptable arrival dates.",
        },
        {
          day: 3,
          owner: "MOVE_PARTNER",
          action:
            "Return a written quote covering packing, transit, storage rate and the cancellation terms.",
        },
        ...(isOverseas(entry)
          ? [
              {
                day: 4,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Decide the container and vehicle path: what ships, what sells, and the registration steps needed on arrival.",
              },
            ]
          : []),
        {
          day: 6,
          owner: "ADVISOR",
          action:
            "Confirm storage is booked as the fallback so the move never becomes the reason a completion date slips.",
        },
      ],
      evidenceStandard: [
        "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
        "vehicle_path: decision recorded for each vehicle — ship, sell, or leave — with the registration steps listed.",
      ],
      escalation: [
        "Day 10 (SLA): no quote — advisor chases the partner directly and offers the second panel member.",
        "Day 14: no quote from either — block the stage and tell the client which decision is now at risk.",
      ],
      partnerScript:
        "'This household has a legal completion window we control. Quote to the window, include storage, and tell us your cut-off for booking.'",
    },
    {
      stageKey: "search_readiness",
      objective:
        "Make the household credible to agents on day one: proven funds, a DIP, and a written must-have list.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Write the buyer-ready one-pager: budget band, DIP lender, deposit proven, timeline, and who to contact.",
        },
        {
          day: 2,
          owner: "CLIENT",
          action:
            "Agree the must-have versus nice-to-have split so offers are not re-litigated later in the family.",
        },
        {
          day: 4,
          owner: "ADVISOR",
          action:
            "Confirm how remote viewings will be handled and who can physically attend at short notice.",
        },
      ],
      evidenceStandard: [
        "buyer_ready: one-pager exists, DIP is unexpired, deposit evidence accepted, and must-haves are written down.",
      ],
      escalation: [
        "Day 7 (SLA): must-haves still unresolved — advisor runs a decision call rather than waiting for consensus.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "offer_instruct",
      objective:
        "Convert an accepted offer into an instructed conveyancer with ID and AML cleared, in days rather than weeks.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Warm-intro the conveyancer the same day the offer is accepted; do not wait for the agent's memorandum of sale.",
        },
        {
          day: 1,
          owner: "CONVEYANCER",
          action:
            "Issue the client care pack and the ID/AML request, and confirm in the thread when it was sent.",
        },
        {
          day: 3,
          owner: "ADVISOR",
          action:
            "Chase ID/AML completion; for overseas clients confirm the certification route before it becomes a two-week delay.",
        },
      ],
      evidenceStandard: [
        "conveyancer_instructed: client care pack signed, ID/AML cleared, and the firm has confirmed it is on the record.",
      ],
      escalation: [
        "Day 5 (SLA): not instructed — advisor calls the firm and the agent on the same day.",
        "Day 8: still not instructed — re-route to the second conveyancing panel member.",
      ],
      partnerScript:
        "'Offer accepted on <date>. We hold the timeline and the client is document-ready. Confirm instruction and your searches order date.'",
    },
    {
      stageKey: "diligence",
      objective:
        "Keep searches, enquiries, survey and valuation moving in parallel and surface defects while there is still time to price them.",
      actions: [
        {
          day: 0,
          owner: "CONVEYANCER",
          action:
            "Order searches on day one of instruction and state the local authority's current turnaround in the thread.",
        },
        {
          day: 2,
          owner: "ADVISOR",
          action:
            "Book the survey in parallel with searches; never sequence them.",
        },
        {
          day: 10,
          owner: "ADVISOR",
          action:
            "Run a weekly enquiry review: list every open enquiry, who holds it, and how many days it has been open.",
        },
      ],
      evidenceStandard: [
        "searches_complete: all ordered searches returned, enquiries raised, and any adverse finding summarised for the client in plain English.",
      ],
      escalation: [
        "Day 21 (SLA): enquiries still open — advisor escalates to the fee earner's supervisor with the dated list.",
        "Any survey defect over the client's stated threshold: advisor convenes a price or walk-away conversation within 48 hours.",
      ],
      partnerScript:
        "'Here is the dated list of open enquiries and who holds each one. Which three close this week?'",
    },
    {
      stageKey: "exchange_complete",
      objective:
        "Land funds and dates together so exchange and completion happen on the planned day, not the first day everyone is free.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Work backwards from the target completion date to the date cleared funds must sit in the conveyancer's client account.",
        },
        ...(needsCurrencyWork(entry)
          ? [
              {
                day: 1,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Confirm the final currency transfer is executed with buffer days — never on the completion date itself.",
              },
            ]
          : []),
        {
          day: 3,
          owner: "CONVEYANCER",
          action:
            "Confirm the exchange date in the thread and give the removals partner the completion date the same day.",
        },
      ],
      evidenceStandard: [
        "completion_confirmed: exchange confirmed in writing, completion date circulated to client and move partner, keys handover arranged.",
      ],
      escalation: [
        "Day 14 (SLA): no exchange date — advisor escalates on the chain and tells the client exactly who is holding it.",
        "Funds not cleared 48 hours before completion: advisor treats it as a red blocker and calls all parties.",
      ],
      partnerScript:
        "'Target completion is <date>. Funds clear on <date - 2>. Confirm you can exchange by <date - 5> or tell us who cannot.'",
    },
    {
      stageKey: "settle_light",
      objective:
        "Close the loop on the light settle checklist and capture what this case taught us before the file goes quiet.",
      actions: [
        {
          day: 1,
          owner: "CLIENT",
          action:
            "Work the settle checklist: utilities, council tax, GP registration, schools, address updates.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Run the debrief call: what was slow, which partner performed, and would they recommend us in their community.",
        },
        {
          day: 10,
          owner: "ADVISOR",
          action:
            "Write the case lessons into the outreach checklist so the next household in that community starts warmer.",
        },
      ],
      evidenceStandard: [
        "Debrief completed and the partner performance notes are written into the case thread while they are still accurate.",
      ],
      escalation: [
        "Day 14 (SLA): no debrief — advisor books it directly; this is the validation evidence, not an optional courtesy.",
      ],
      partnerScript: null,
    },
  ];
}

export function ewStagePlaybook(
  stageKey: string,
  entry: EntryContext,
): StagePlaybook | null {
  return ewPlaybooks(entry).find((p) => p.stageKey === stageKey) ?? null;
}
```

Replace the whole contents of `src/lib/cockpit-playbook.ts`:

```ts
import {
  ewStagePlaybook,
  type StagePlaybook,
} from "@/domain/market-packs/ew-playbook";
import type { CaseState } from "@/domain/stage-engine";

/**
 * Advisor operating IP. Callers must be inside an advisor-gated surface —
 * guard with assertPlaybookVisible before rendering.
 */
export function advisorPlaybook(
  caseState: CaseState,
  stageKey: string,
): StagePlaybook | null {
  return ewStagePlaybook(stageKey, caseState.entryContext);
}

export type { StagePlaybook };
```

Append to `src/server/cockpit-policy.ts`:

```ts
import type { ActorRole } from "../domain/types";

export function assertPlaybookVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Stage playbooks are advisor-only operating IP",
    );
  }
}
```

Create `src/components/PlaybookPanel.tsx`:

```tsx
import type { StagePlaybook } from "@/domain/market-packs/ew-playbook";

type Props = {
  playbook: StagePlaybook;
  stageTitle: string;
};

export function PlaybookPanel({ playbook, stageTitle }: Props) {
  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
          Advisor playbook — {stageTitle}
        </h2>
        <span className="rounded bg-indigo-900 px-2 py-0.5 text-xs font-medium text-indigo-50">
          Never shown to clients
        </span>
      </div>

      <p className="mt-2 text-sm text-indigo-900">{playbook.objective}</p>

      <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
        Actions
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-indigo-900">
        {playbook.actions.map((step) => (
          <li key={`${step.day}-${step.action}`}>
            <span className="font-medium">Day {step.day}</span>{" "}
            <span className="text-indigo-700">
              ({step.owner.replace(/_/g, " ").toLowerCase()})
            </span>{" "}
            {step.action}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
        Evidence standard
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-indigo-900">
        {playbook.evidenceStandard.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>

      <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
        Escalation
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-indigo-900">
        {playbook.escalation.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>

      {playbook.partnerScript && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
            Partner script
          </h3>
          <p className="mt-1 text-sm italic text-indigo-900">
            {playbook.partnerScript}
          </p>
        </>
      )}
    </div>
  );
}
```

In `src/app/cockpit/cases/[caseId]/page.tsx`, replace the playbook import and render block:

```tsx
import { PlaybookPanel } from "@/components/PlaybookPanel";
import { advisorPlaybook } from "@/lib/cockpit-playbook";
import { assertPlaybookVisible } from "@/server/cockpit-policy";
```

(remove `import { advisorPlaybookText } from "@/lib/cockpit-playbook";`)

After `const focusStage = ...`, add:

```tsx
  assertPlaybookVisible("ADVISOR");
  const playbook = focus ? advisorPlaybook(caseState, focus.key) : null;
```

and replace the existing indigo playbook `<div>` inside the `{focus && (...)}` block with:

```tsx
          {playbook && (
            <PlaybookPanel playbook={playbook} stageTitle={focus.title} />
          )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/ew-playbook.test.ts tests/server/cockpit-playbook-policy.test.ts`

Expected: PASS — 8 tests

Run: `npm test`

Expected: PASS — no suite still references `advisorPlaybookText`

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/ew-playbook.ts src/lib/cockpit-playbook.ts src/server/cockpit-policy.ts src/components/PlaybookPanel.tsx src/app/cockpit/cases tests/domain/ew-playbook.test.ts tests/server/cockpit-playbook-policy.test.ts
git commit -m "feat: entry-aware advisor playbooks kept out of the client portal"
```

---

### Task 7: Advisor upgrade FREE→PAID and entry-context editing

**Files:**
- Create: `src/domain/case-admin.ts`, `src/app/actions/case-admin.ts`, `src/components/CaseAdminControls.tsx`
- Modify: `src/domain/stage-engine.ts` (two new error codes), `src/server/cases.ts` (`saveCase` stale-evidence cleanup), `src/app/cockpit/cases/[caseId]/page.tsx`
- Test: `tests/domain/case-admin.test.ts`, `tests/server/cases.roundtrip.test.ts` (append)

**Interfaces:**
- Consumes: `CaseState`, `StageEngineError`, `getFocusStage`, `ewMarketPack`, `getStageTemplate`
- Produces:
  - `upgradeToPaid(caseState: CaseState, input: { actorRole: ActorRole; now?: Date }): CaseState` — advisor only; appends `CASE_UPGRADED` with payload `"FREE_DIY->PAID_DWY"`
  - `setEntryContext(caseState: CaseState, input: { entryContext: EntryContext; actorRole: ActorRole; now?: Date }): CaseState` — advisor only; recomputes `requiredEvidenceKinds` from the pack and drops evidence kinds that no longer apply; appends `ENTRY_CONTEXT_CHANGED` with payload `"<old>-><new>"`
  - `StageEngineErrorCode` gains `"ALREADY_PAID" | "ENTRY_LOCKED"`
  - `upgradeCaseAction(caseId: string): Promise<CaseAdminActionResult>`, `setEntryContextAction(caseId: string, entryContext: string): Promise<CaseAdminActionResult>` where `CaseAdminActionResult = { ok: true } | { ok: false; error: string }`
  - `saveCase` now deletes `Evidence` rows whose `kind` is no longer required by the stage

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/case-admin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { setEntryContext, upgradeToPaid } from "../../src/domain/case-admin";
import {
  acceptEvidence,
  advanceStage,
  createCase,
  submitEvidence,
} from "../../src/domain/stage-engine";

function paidCaseAtMoneyStage(entry: "RETURNER_OVERSEAS" | "UK_RESIDENT_SPEED") {
  let c = createCase({ id: "adm_1", entryContext: entry, tier: "PAID_DWY" });
  c = submitEvidence(c, {
    stageKey: "purchase_profile",
    kind: "profile_complete",
    actorRole: "CLIENT",
  });
  c = acceptEvidence(c, {
    stageKey: "purchase_profile",
    kind: "profile_complete",
    actorRole: "ADVISOR",
  });
  return advanceStage(c, { actorRole: "ADVISOR" });
}

describe("upgradeToPaid", () => {
  it("moves a free case to paid and logs the upgrade", () => {
    const free = createCase({
      id: "up_1",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    const upgraded = upgradeToPaid(free, {
      actorRole: "ADVISOR",
      now: new Date("2026-09-05T09:00:00.000Z"),
    });

    expect(upgraded.tier).toBe("PAID_DWY");
    const event = upgraded.events.at(-1);
    expect(event?.type).toBe("CASE_UPGRADED");
    expect(event?.payload).toBe("FREE_DIY->PAID_DWY");
    expect(free.tier).toBe("FREE_DIY");
  });

  it("refuses non-advisors and already-paid cases", () => {
    const free = createCase({
      id: "up_2",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    expect(() => upgradeToPaid(free, { actorRole: "CLIENT" })).toThrow(
      /advisor/i,
    );

    const paid = createCase({
      id: "up_3",
      entryContext: "RETURNER_IN_UK",
      tier: "PAID_DWY",
    });
    expect(() => upgradeToPaid(paid, { actorRole: "ADVISOR" })).toThrow(
      /already/i,
    );
  });
});

describe("setEntryContext", () => {
  it("recomputes required evidence and drops kinds that no longer apply", () => {
    let c = paidCaseAtMoneyStage("RETURNER_OVERSEAS");
    c = submitEvidence(c, {
      stageKey: "money_readiness",
      kind: "fx_plan",
      actorRole: "CLIENT",
    });
    expect(
      c.stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds,
    ).toContain("fx_plan");

    const switched = setEntryContext(c, {
      entryContext: "UK_RESIDENT_SPEED",
      actorRole: "ADVISOR",
    });
    const money = switched.stages.find((s) => s.key === "money_readiness");

    expect(switched.entryContext).toBe("UK_RESIDENT_SPEED");
    expect(money?.requiredEvidenceKinds).toEqual(["source_of_funds"]);
    expect(money?.submittedEvidenceKinds).not.toContain("fx_plan");
    expect(switched.events.at(-1)?.type).toBe("ENTRY_CONTEXT_CHANGED");
    expect(switched.events.at(-1)?.payload).toBe(
      "RETURNER_OVERSEAS->UK_RESIDENT_SPEED",
    );
  });

  it("is a no-op when the entry context is unchanged", () => {
    const c = paidCaseAtMoneyStage("RETURNER_OVERSEAS");
    const same = setEntryContext(c, {
      entryContext: "RETURNER_OVERSEAS",
      actorRole: "ADVISOR",
    });
    expect(same.events.length).toBe(c.events.length);
  });

  it("refuses non-advisors", () => {
    const c = paidCaseAtMoneyStage("RETURNER_OVERSEAS");
    expect(() =>
      setEntryContext(c, {
        entryContext: "RETURNER_IN_UK",
        actorRole: "CLIENT",
      }),
    ).toThrow(/advisor/i);
  });

  it("locks once the offer stage has started", () => {
    let c = createCase({
      id: "lock_1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = {
      ...c,
      stages: c.stages.map((s) =>
        s.key === "offer_instruct" ? { ...s, status: "ACTIVE" as const } : s,
      ),
    };
    expect(() =>
      setEntryContext(c, {
        entryContext: "RETURNER_IN_UK",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/locked/i);
  });
});
```

Append to `tests/server/cases.roundtrip.test.ts` (inside `describe("cases persistence", ...)`, and add `setEntryContext, upgradeToPaid` to the imports from `../../src/domain/case-admin`):

```ts
  it("persists an upgrade and clears evidence dropped by an entry-context change", async () => {
    const created = await createCaseRecord({
      title: "Upgrade and re-context",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
    });

    let caseState = await loadCase(created.id);
    caseState = upgradeToPaid(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);

    caseState = await loadCase(created.id);
    expect(caseState.tier).toBe("PAID_DWY");

    caseState = submitEvidence(caseState, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    caseState = acceptEvidence(caseState, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "ADVISOR",
    });
    caseState = advanceStage(caseState, { actorRole: "ADVISOR" });
    caseState = submitEvidence(caseState, {
      stageKey: "money_readiness",
      kind: "fx_plan",
      actorRole: "CLIENT",
    });
    await saveCase(caseState);

    caseState = await loadCase(created.id);
    caseState = setEntryContext(caseState, {
      entryContext: "UK_RESIDENT_SPEED",
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);

    const reloaded = await loadCase(created.id);
    const money = reloaded.stages.find((s) => s.key === "money_readiness");
    expect(reloaded.entryContext).toBe("UK_RESIDENT_SPEED");
    expect(money?.requiredEvidenceKinds).toEqual(["source_of_funds"]);
    expect(money?.submittedEvidenceKinds).not.toContain("fx_plan");
    expect(reloaded.events.some((e) => e.type === "CASE_UPGRADED")).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/case-admin.test.ts tests/server/cases.roundtrip.test.ts`

Expected: FAIL — `Failed to resolve import "../../src/domain/case-admin"`

- [ ] **Step 3: Implement the transitions, persistence cleanup and controls**

In `src/domain/stage-engine.ts`, extend the error code union:

```ts
export type StageEngineErrorCode =
  | "NO_ACTIVE_STAGE"
  | "WRONG_STAGE"
  | "EVIDENCE_INCOMPLETE"
  | "FORBIDDEN_ROLE"
  | "ALREADY_ACCEPTED"
  | "MULTIPLE_ACTIVE"
  | "ALREADY_PAID"
  | "ENTRY_LOCKED";
```

Create `src/domain/case-admin.ts`:

```ts
import { ewMarketPack, getStageTemplate } from "./market-packs/ew";
import {
  getFocusStage,
  StageEngineError,
  type CaseState,
} from "./stage-engine";
import type { ActorRole, EntryContext } from "./types";

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function requireAdvisor(actorRole: ActorRole, what: string): void {
  if (actorRole !== "ADVISOR") {
    throw new StageEngineError("FORBIDDEN_ROLE", `Only advisors may ${what}`);
  }
}

export function upgradeToPaid(
  caseState: CaseState,
  input: { actorRole: ActorRole; now?: Date },
): CaseState {
  requireAdvisor(input.actorRole, "upgrade a case");

  if (caseState.tier === "PAID_DWY") {
    throw new StageEngineError(
      "ALREADY_PAID",
      "Case is already on the paid Done-With-You tier",
    );
  }

  const focus = getFocusStage(caseState);
  return {
    ...caseState,
    tier: "PAID_DWY",
    events: [
      ...caseState.events,
      {
        type: "CASE_UPGRADED",
        stageKey: focus?.key ?? caseState.stages[0].key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: "FREE_DIY->PAID_DWY",
      },
    ],
  };
}

export function setEntryContext(
  caseState: CaseState,
  input: { entryContext: EntryContext; actorRole: ActorRole; now?: Date },
): CaseState {
  requireAdvisor(input.actorRole, "change the entry context");

  if (caseState.entryContext === input.entryContext) {
    return caseState;
  }

  const offerStage = caseState.stages.find((s) => s.key === "offer_instruct");
  if (offerStage && offerStage.status !== "PENDING") {
    throw new StageEngineError(
      "ENTRY_LOCKED",
      "Entry context is locked once the offer stage has started",
    );
  }

  const templates = getStageTemplate(ewMarketPack, input.entryContext);

  const stages = caseState.stages.map((stage) => {
    const template = templates.find((t) => t.key === stage.key);
    if (!template) {
      return stage;
    }
    const required = [...template.requiredEvidenceKinds];
    return {
      ...stage,
      requiredEvidenceKinds: required,
      acceptedEvidenceKinds: stage.acceptedEvidenceKinds.filter((kind) =>
        required.includes(kind),
      ),
      submittedEvidenceKinds: stage.submittedEvidenceKinds.filter((kind) =>
        required.includes(kind),
      ),
    };
  });

  const focus = getFocusStage(caseState);

  return {
    ...caseState,
    entryContext: input.entryContext,
    stages,
    events: [
      ...caseState.events,
      {
        type: "ENTRY_CONTEXT_CHANGED",
        stageKey: focus?.key ?? caseState.stages[0].key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: `${caseState.entryContext}->${input.entryContext}`,
      },
    ],
  };
}
```

In `src/server/cases.ts`, inside `saveCase`'s per-stage loop, delete evidence rows that are no longer required — add this immediately after the `const dbStage = await tx.stage.update({...})` call and before the `for (const kind of stage.requiredEvidenceKinds)` loop:

```ts
      const staleEvidence = dbStage.evidence.filter(
        (row) => !stage.requiredEvidenceKinds.includes(row.kind),
      );
      if (staleEvidence.length > 0) {
        await tx.evidence.deleteMany({
          where: { id: { in: staleEvidence.map((row) => row.id) } },
        });
      }
```

Create `src/app/actions/case-admin.ts`:

```ts
"use server";

import { setEntryContext, upgradeToPaid } from "@/domain/case-admin";
import { StageEngineError } from "@/domain/stage-engine";
import type { EntryContext } from "@/domain/types";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import { revalidatePath } from "next/cache";

export type CaseAdminActionResult = { ok: true } | { ok: false; error: string };

const ENTRY_CONTEXTS: EntryContext[] = [
  "RETURNER_OVERSEAS",
  "RETURNER_IN_UK",
  "UK_RESIDENT_SPEED",
];

function mapError(err: unknown): string {
  if (err instanceof StageEngineError || err instanceof CaseAccessError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}

async function requireAdvisorSession(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true, userId: session.user.id };
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath("/cockpit/cases");
  revalidatePath("/cockpit/funnel");
  revalidatePath(`/portal/cases/${caseId}`);
}

export async function upgradeCaseAction(
  caseId: string,
): Promise<CaseAdminActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    caseState = upgradeToPaid(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function setEntryContextAction(
  caseId: string,
  entryContext: string,
): Promise<CaseAdminActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }

  if (!ENTRY_CONTEXTS.includes(entryContext as EntryContext)) {
    return { ok: false, error: "Unknown entry context" };
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    caseState = setEntryContext(caseState, {
      entryContext: entryContext as EntryContext,
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

Create `src/components/CaseAdminControls.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  setEntryContextAction,
  upgradeCaseAction,
} from "@/app/actions/case-admin";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { EntryContext, Tier } from "@/domain/types";

type Props = {
  caseId: string;
  tier: Tier;
  entryContext: EntryContext;
  entryLocked: boolean;
  leadSource: string;
};

const ENTRY_OPTIONS: Array<{ value: EntryContext; label: string }> = [
  { value: "RETURNER_OVERSEAS", label: "Returner — still overseas" },
  { value: "RETURNER_IN_UK", label: "Returner — already in the UK" },
  { value: "UK_RESIDENT_SPEED", label: "UK resident — speed seeker" },
];

export function CaseAdminControls({
  caseId,
  tier,
  entryContext,
  entryLocked,
  leadSource,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  return (
    <div className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Case admin</h2>
      <ActionErrorBanner error={error} />

      <p className="text-sm text-slate-600">
        Lead source:{" "}
        <span className="font-medium text-slate-900">
          {leadSource.replace(/_/g, " ").toLowerCase()}
        </span>
      </p>

      {tier === "FREE_DIY" ? (
        <form
          action={async () => {
            await run(() => upgradeCaseAction(caseId));
          }}
        >
          <button
            type="submit"
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Upgrade to Done-With-You
          </button>
        </form>
      ) : (
        <p className="text-sm text-emerald-700">
          On the paid Done-With-You tier.
        </p>
      )}

      <form
        action={async (formData) => {
          const next = String(formData.get("entryContext") ?? "");
          await run(() => setEntryContextAction(caseId, next));
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex-1">
          <span className="text-sm font-medium text-slate-700">
            Entry context
          </span>
          <select
            name="entryContext"
            defaultValue={entryContext}
            disabled={entryLocked}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            {ENTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={entryLocked}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save entry context
        </button>
      </form>

      {entryLocked && (
        <p className="text-xs text-slate-500">
          Entry context is locked once the offer stage has started.
        </p>
      )}
    </div>
  );
}
```

In `src/app/cockpit/cases/[caseId]/page.tsx`, add the import and render the controls after the `WarmIntroButton` block:

```tsx
import { CaseAdminControls } from "@/components/CaseAdminControls";
```

```tsx
      <CaseAdminControls
        caseId={caseId}
        tier={caseState.tier}
        entryContext={caseState.entryContext}
        entryLocked={
          caseState.stages.find((s) => s.key === "offer_instruct")?.status !==
          "PENDING"
        }
        leadSource={caseState.attribution.leadSource}
      />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS — 6 new case-admin domain tests plus the persistence test

Manual: `npm run db:seed`, sign in as `advisor@example.com`, open the free "Smith DIY journey" case, upgrade it, then change its entry context and confirm the client portal shows paid detail.

- [ ] **Step 5: Commit**

```bash
git add src/domain/case-admin.ts src/domain/stage-engine.ts src/server/cases.ts src/app/actions/case-admin.ts src/components/CaseAdminControls.tsx src/app/cockpit/cases tests/domain/case-admin.test.ts tests/server/cases.roundtrip.test.ts
git commit -m "feat: advisor upgrade and entry-context editing with evidence rebuild"
```

---

### Task 8: Diaspora funnel metrics in the cockpit

**Files:**
- Create: `src/domain/funnel.ts`, `src/app/cockpit/funnel/page.tsx`
- Modify: `src/server/cases.ts` (`listFunnelRows`, `listCasesForUser` returns lead source), `src/app/cockpit/layout.tsx` (nav), `src/app/cockpit/cases/page.tsx` (badge)
- Test: `tests/domain/funnel.test.ts`

**Interfaces:**
- Consumes: `LeadSource`, `isDiasporaLead`, `Tier`, `EntryContext`
- Produces:
  - `const VALIDATION_TARGET_HOUSEHOLDS = 10`
  - `type FunnelCaseRow = { id: string; tier: Tier; leadSource: LeadSource; entryContext: EntryContext }`
  - `type FunnelSummary = { totalCases: number; paidCases: number; freeCases: number; paidConversionRate: number; diasporaCases: number; diasporaPaidCases: number; validationTargetMet: boolean; bySource: Array<{ leadSource: LeadSource; total: number; paid: number }>; byEntryContext: Array<{ entryContext: EntryContext; total: number; paid: number }> }`
  - `summariseFunnel(rows: FunnelCaseRow[]): FunnelSummary`
  - `listFunnelRows(): Promise<FunnelCaseRow[]>`
  - `listCasesForUser` return type gains `leadSource: string`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/funnel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  summariseFunnel,
  VALIDATION_TARGET_HOUSEHOLDS,
  type FunnelCaseRow,
} from "../../src/domain/funnel";

const rows: FunnelCaseRow[] = [
  { id: "1", tier: "PAID_DWY", leadSource: "DIASPORA_AU_UK", entryContext: "RETURNER_OVERSEAS" },
  { id: "2", tier: "PAID_DWY", leadSource: "DIASPORA_AU_UK", entryContext: "RETURNER_OVERSEAS" },
  { id: "3", tier: "FREE_DIY", leadSource: "DIASPORA_AU_UK", entryContext: "RETURNER_IN_UK" },
  { id: "4", tier: "FREE_DIY", leadSource: "ORGANIC", entryContext: "UK_RESIDENT_SPEED" },
  { id: "5", tier: "PAID_DWY", leadSource: "COMMUNITY_REFERRAL", entryContext: "RETURNER_IN_UK" },
];

describe("summariseFunnel", () => {
  it("counts tiers and the paid conversion rate", () => {
    const summary = summariseFunnel(rows);
    expect(summary.totalCases).toBe(5);
    expect(summary.paidCases).toBe(3);
    expect(summary.freeCases).toBe(2);
    expect(summary.paidConversionRate).toBe(0.6);
  });

  it("counts diaspora-sourced households for the community metric", () => {
    const summary = summariseFunnel(rows);
    expect(summary.diasporaCases).toBe(4);
    expect(summary.diasporaPaidCases).toBe(3);
  });

  it("breaks down by source, biggest first", () => {
    const summary = summariseFunnel(rows);
    expect(summary.bySource[0]).toEqual({
      leadSource: "DIASPORA_AU_UK",
      total: 3,
      paid: 2,
    });
    expect(summary.bySource).toHaveLength(3);
  });

  it("breaks down by entry context", () => {
    const summary = summariseFunnel(rows);
    const returnerInUk = summary.byEntryContext.find(
      (row) => row.entryContext === "RETURNER_IN_UK",
    );
    expect(returnerInUk).toEqual({
      entryContext: "RETURNER_IN_UK",
      total: 2,
      paid: 1,
    });
  });

  it("reports the 10-household validation target", () => {
    expect(VALIDATION_TARGET_HOUSEHOLDS).toBe(10);
    expect(summariseFunnel(rows).validationTargetMet).toBe(false);

    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `p${index}`,
      tier: "PAID_DWY" as const,
      leadSource: "DIASPORA_US_UK" as const,
      entryContext: "RETURNER_OVERSEAS" as const,
    }));
    expect(summariseFunnel(many).validationTargetMet).toBe(true);
  });

  it("handles an empty ledger without dividing by zero", () => {
    const summary = summariseFunnel([]);
    expect(summary.paidConversionRate).toBe(0);
    expect(summary.bySource).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/funnel.test.ts`

Expected: FAIL — `Failed to resolve import "../../src/domain/funnel"`

- [ ] **Step 3: Implement the summary, query and page**

Create `src/domain/funnel.ts`:

```ts
import { isDiasporaLead, type LeadSource } from "./attribution";
import type { EntryContext, Tier } from "./types";

/** Spec §1: ~10–20 households through the real workflow. */
export const VALIDATION_TARGET_HOUSEHOLDS = 10;

export type FunnelCaseRow = {
  id: string;
  tier: Tier;
  leadSource: LeadSource;
  entryContext: EntryContext;
};

export type SourceBreakdown = {
  leadSource: LeadSource;
  total: number;
  paid: number;
};

export type EntryBreakdown = {
  entryContext: EntryContext;
  total: number;
  paid: number;
};

export type FunnelSummary = {
  totalCases: number;
  paidCases: number;
  freeCases: number;
  paidConversionRate: number;
  diasporaCases: number;
  diasporaPaidCases: number;
  validationTargetMet: boolean;
  bySource: SourceBreakdown[];
  byEntryContext: EntryBreakdown[];
};

function tally<K extends string>(
  rows: FunnelCaseRow[],
  keyOf: (row: FunnelCaseRow) => K,
): Array<{ key: K; total: number; paid: number }> {
  const counts = new Map<K, { total: number; paid: number }>();

  for (const row of rows) {
    const key = keyOf(row);
    const entry = counts.get(key) ?? { total: 0, paid: 0 };
    entry.total += 1;
    if (row.tier === "PAID_DWY") {
      entry.paid += 1;
    }
    counts.set(key, entry);
  }

  return [...counts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) =>
      right.total !== left.total
        ? right.total - left.total
        : left.key.localeCompare(right.key),
    );
}

export function summariseFunnel(rows: FunnelCaseRow[]): FunnelSummary {
  const totalCases = rows.length;
  const paidCases = rows.filter((row) => row.tier === "PAID_DWY").length;
  const diaspora = rows.filter((row) => isDiasporaLead(row.leadSource));

  return {
    totalCases,
    paidCases,
    freeCases: totalCases - paidCases,
    paidConversionRate:
      totalCases === 0 ? 0 : Math.round((paidCases / totalCases) * 100) / 100,
    diasporaCases: diaspora.length,
    diasporaPaidCases: diaspora.filter((row) => row.tier === "PAID_DWY").length,
    validationTargetMet: paidCases >= VALIDATION_TARGET_HOUSEHOLDS,
    bySource: tally(rows, (row) => row.leadSource).map((row) => ({
      leadSource: row.key,
      total: row.total,
      paid: row.paid,
    })),
    byEntryContext: tally(rows, (row) => row.entryContext).map((row) => ({
      entryContext: row.key,
      total: row.total,
      paid: row.paid,
    })),
  };
}
```

In `src/server/cases.ts`, add imports and two changes:

```ts
import { DEFAULT_ATTRIBUTION, isLeadSource } from "../domain/attribution";
import type { FunnelCaseRow } from "../domain/funnel";
```

```ts
export async function listFunnelRows(): Promise<FunnelCaseRow[]> {
  const rows = await prisma.case.findMany({
    select: {
      id: true,
      tier: true,
      leadSource: true,
      entryContext: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    tier: row.tier as Tier,
    leadSource: isLeadSource(row.leadSource)
      ? row.leadSource
      : DEFAULT_ATTRIBUTION.leadSource,
    entryContext: row.entryContext as EntryContext,
  }));
}
```

and widen `listCasesForUser` so the case list can show provenance:

```ts
export async function listCasesForUser(
  userId: string,
): Promise<Array<{ id: string; title: string; tier: string; leadSource: string }>> {
  const participants = await prisma.caseParticipant.findMany({
    where: { userId },
    include: { case: true },
    orderBy: { case: { updatedAt: "desc" } },
  });

  return participants.map((participant) => ({
    id: participant.case.id,
    title: participant.case.title,
    tier: participant.case.tier,
    leadSource: participant.case.leadSource,
  }));
}
```

Create `src/app/cockpit/funnel/page.tsx`:

```tsx
import { summariseFunnel, VALIDATION_TARGET_HOUSEHOLDS } from "@/domain/funnel";
import { listFunnelRows } from "@/server/cases";

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export default async function FunnelPage() {
  const summary = summariseFunnel(await listFunnelRows());

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">
        Validation funnel
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Evidence for the two v1 goals: households through the real workflow, and
        traction inside diaspora communities.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Paid households</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.paidCases}
            <span className="text-base font-normal text-slate-500">
              {" "}
              / {VALIDATION_TARGET_HOUSEHOLDS}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.validationTargetMet
              ? "Validation target met"
              : "Below validation target"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Paid conversion</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {Math.round(summary.paidConversionRate * 100)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.freeCases} free · {summary.totalCases} total
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Diaspora-sourced</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.diasporaCases}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.diasporaPaidCases} of them paid
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Distinct sources</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.bySource.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aim for depth in 1–2 communities, not spread
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium text-slate-900">By lead source</h2>
          <ul className="mt-3 space-y-2">
            {summary.bySource.map((row) => (
              <li
                key={row.leadSource}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{label(row.leadSource)}</span>
                <span className="text-slate-900">
                  {row.paid} paid / {row.total}
                </span>
              </li>
            ))}
            {summary.bySource.length === 0 && (
              <li className="text-sm text-slate-500">No cases yet.</li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-medium text-slate-900">
            By entry context
          </h2>
          <ul className="mt-3 space-y-2">
            {summary.byEntryContext.map((row) => (
              <li
                key={row.entryContext}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{label(row.entryContext)}</span>
                <span className="text-slate-900">
                  {row.paid} paid / {row.total}
                </span>
              </li>
            ))}
            {summary.byEntryContext.length === 0 && (
              <li className="text-sm text-slate-500">No cases yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

In `src/app/cockpit/layout.tsx`, add a nav row between the `<header>` and `<main>`:

```tsx
      <nav className="flex gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <a href="/cockpit/cases" className="text-slate-700 hover:text-slate-900">
          Cases
        </a>
        <a href="/cockpit/funnel" className="text-slate-700 hover:text-slate-900">
          Validation funnel
        </a>
      </nav>
```

In `src/app/cockpit/cases/page.tsx`, add a lead-source badge next to the tier badge:

```tsx
                <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {c.leadSource.replace(/_/g, " ").toLowerCase()}
                </span>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/funnel.test.ts`

Expected: PASS — 6 tests

Run: `npm test && npm run build`

Expected: all suites PASS, build succeeds

Manual: `npm run db:seed`, sign in as the advisor, open `/cockpit/funnel` — 3 cases, 1 paid, 2 diaspora-sourced.

- [ ] **Step 5: Commit**

```bash
git add src/domain/funnel.ts src/app/cockpit src/server/cases.ts tests/domain/funnel.test.ts
git commit -m "feat: diaspora validation funnel view in the cockpit"
```

---

### Task 9: Founder outreach checklist, demo script and full verification

**Files:**
- Create: `docs/playbooks/diaspora-outreach-checklist.md`, `docs/superpowers/plans/demo-script-acquisition-funnel.md`
- Modify: `README.md`
- Test: `tests/content/outreach-checklist.test.ts`

**Interfaces:**
- Consumes: `parseAttribution`, `isDiasporaLead` from `src/domain/attribution.ts`; `FORBIDDEN_CLAIM_PATTERNS` from `src/content/marketing.ts`
- Produces: a founder-facing content doc whose tracking links are guaranteed to parse into diaspora lead sources — the checklist and the code cannot drift apart

- [ ] **Step 1: Write the failing test**

Create `tests/content/outreach-checklist.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDiasporaLead, parseAttribution } from "../../src/domain/attribution";
import { FORBIDDEN_CLAIM_PATTERNS } from "../../src/content/marketing";

const checklist = readFileSync(
  path.resolve(__dirname, "../../docs/playbooks/diaspora-outreach-checklist.md"),
  "utf8",
);

describe("diaspora outreach checklist", () => {
  it("covers the sections a founder needs to run outreach", () => {
    for (const heading of [
      "## Who we are talking to",
      "## Weekly rhythm",
      "## Tracking links",
      "## Message templates",
      "## What we never say",
      "## Definition of done",
    ]) {
      expect(checklist).toContain(heading);
    }
  });

  it("only uses tracking tags the app resolves to diaspora leads", () => {
    const tags = [...checklist.matchAll(/utm_source=([a-z0-9-]+)/g)].map(
      (match) => match[1],
    );
    expect(tags.length).toBeGreaterThanOrEqual(3);

    for (const tag of tags) {
      const parsed = parseAttribution({ utm_source: tag });
      expect(
        isDiasporaLead(parsed.leadSource),
        `utm_source=${tag} resolved to ${parsed.leadSource}`,
      ).toBe(true);
    }
  });

  it("makes no forbidden claims", () => {
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      const match = checklist.match(pattern);
      expect(match?.[0] ?? null, `checklist matches ${pattern}`).toBeNull();
    }
  });

  it("names the two v1 validation goals", () => {
    expect(checklist).toMatch(/10[–-]20 households/);
    expect(checklist).toMatch(/1[–-]2 (diaspora )?communities/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/outreach-checklist.test.ts`

Expected: FAIL — `ENOENT: no such file or directory ... diaspora-outreach-checklist.md`

- [ ] **Step 3: Write the docs**

Create `docs/playbooks/diaspora-outreach-checklist.md`:

```markdown
# Diaspora outreach checklist

Founder-facing operating content. This is a checklist, not a CRM — the case
ledger in the cockpit is the system of record, and `/cockpit/funnel` is the
scoreboard.

## Who we are talking to

Two communities, deliberately narrow. Depth beats spread: we want to be the
name that gets repeated in a thread, not a link seen once in five groups.

| Community | Where they gather | The moment they need us |
|---|---|---|
| Brits and dual nationals in Australia | Expat Facebook groups, city-based WhatsApp groups, shipping and visa forums, alumni networks | Six to eighteen months before flying, when the deposit is still in AUD and nobody has mentioned the UK credit file |
| Brits and dual nationals in the United States | Expat subreddits, city meetups, employer relocation networks, school-year parent groups | When the return date is set by a school term or a job end date and the purchase has to fit around it |

Pick one primary community and one secondary. Do not add a third until the
primary has produced repeat referrals without prompting.

## Weekly rhythm

- [ ] **Monday — listen.** Read the two communities. Note every purchase or
      move question. Do not reply yet.
- [ ] **Tuesday — answer three.** Write three genuinely useful replies with no
      link. Answer the actual question. Sign off with who you are.
- [ ] **Wednesday — one long-form post.** One community, one post, one tracked
      link. Rotate communities weekly so you are never the person who only posts.
- [ ] **Thursday — one warm conversation.** A group admin, a returner who has
      just landed, or a partner who serves the same community.
- [ ] **Friday — close the loop.** Debrief any case that completed a stage this
      week and ask the household directly whether they would name us in their
      community. Log the answer in the case thread.
- [ ] **Friday — check the scoreboard.** Open `/cockpit/funnel`. Paid households
      versus target, and how many came from each community.

## Tracking links

Every link you post carries a tag. Untracked links make the validation metric
worthless. Only these tags are recognised by the app.

| Placement | Link |
|---|---|
| AU community post | `https://<host>/stories/returning-from-australia?utm_source=poms-in-oz&utm_medium=community` |
| AU general / newsletter | `https://<host>/?utm_source=au-uk&utm_medium=community` |
| US community post | `https://<host>/stories/returning-from-the-usa?utm_source=brits-in-america&utm_medium=community` |
| US general / newsletter | `https://<host>/?utm_source=us-uk&utm_medium=community` |
| Personal referral from a past client | `https://<host>/?utm_source=community&ref=<their-name>` |

A tag that is not in this table lands as `ORGANIC` and disappears from the
diaspora count. If you need a new tag, add it to `SOURCE_MAP` in
`src/domain/attribution.ts` in the same change.

## Message templates

**1. Group reply (no link, builds standing)**

> The bit that catches most people coming back is the UK credit file, not the
> mortgage itself. If you have been away five years you are close to invisible
> to a UK lender, and that takes months to fix, not weeks. Happy to explain what
> the fix looks like if it is useful — I run purchase logistics for returning
> households.

**2. Long-form community post (one tracked link)**

> **What actually goes wrong when you buy from overseas**
>
> Three things, in this order: the deposit is in the wrong currency at the wrong
> time; nobody instructs the conveyancer until a week after the offer is
> accepted; and the container gets booked against a completion date that was
> never real.
>
> We run the purchase as nine stages with one owner at a time, and we chase the
> party who is late. If you want to see the stage map for free, it is here:
> `https://<host>/stories/returning-from-australia?utm_source=poms-in-oz&utm_medium=community`

**3. Group admin conversation**

> I work with households moving back to England and Wales, mostly from your side
> of the world. I would rather be useful in the group than advertise in it. Would
> you be open to me answering purchase questions when they come up, and doing one
> longer post a month if members find it useful? Happy to run anything past you
> first.

**4. Debrief ask (the referral engine)**

> Now you are in: was there a point where you would have paid twice as much to
> have somebody just handle it? And is there anyone in the group you would
> mention us to? No pressure either way — the honest answer is more useful to me
> than a yes.

## What we never say

- No completion date promises and no service guarantees. We have planning
  targets from our own ledger and nothing more.
- No mortgage recommendations. We introduce you to an authorised firm; the
  recommendation comes from them.
- No claim to cover Scotland or Northern Ireland. England and Wales only.
- No "we are cheaper than an agent" framing. We are buyer-side; agents work for
  the seller. Different job.
- Never post the advisor playbooks, the evidence standards, or screenshots of
  the cockpit. That is the product.
- Always disclose that we may earn a referral fee, before the introduction, not
  after.

## Definition of done

This checklist has done its job when:

- [ ] 10–20 households have run through the real paid workflow
- [ ] Two or more paid cases in one community arrived without a post from us —
      somebody else named us
- [ ] At least half of all cases carry a diaspora lead source in
      `/cockpit/funnel`
- [ ] 1–2 communities show repeat referrals rather than one-off clicks

When those are true, stop optimising outreach and start on partner scorecards.
```

Create `docs/superpowers/plans/demo-script-acquisition-funnel.md`:

```markdown
# Demo script — acquisition funnel and ops playbook

Assumes `npm run db:push && npm run db:seed && npm run dev`.

## 1. The tracked visit (2 min)

1. Open `http://localhost:3000/?utm_source=poms-in-oz&utm_medium=community`.
2. Point out: paid CTA is primary and appears first; the free CTA is secondary.
3. Open an entry story from the nav (`AU → UK`). The paid CTA carries both the
   entry context and the campaign tag into `/start`.

## 2. Self-serve signup (3 min)

1. Click **Start Done-With-You**. The form is pre-set to paid and to the entry
   context from the story.
2. Sign up as `demo-returner@example.com` / `returning2026`, region `Bristol`.
3. You land in the client portal on a real case at `purchase_profile`.
4. Show the free path too: `/start?plan=free&utm_source=brits-in-america` — the
   copy explicitly says what free withholds and links back to paid.

## 3. Advisor operating IP (3 min)

1. Sign in as `advisor@example.com` / `password`, open the new case.
2. The **Advisor playbook** panel shows the objective, dated actions, evidence
   standard, escalation ladder and partner script — branched for a returner who
   is still overseas.
3. Sign back in as the client: none of that text appears anywhere in the portal.

## 4. Upgrade and re-context (2 min)

1. As the advisor, open the seeded free case **Smith DIY journey**.
2. **Upgrade to Done-With-You** → the client portal immediately shows named
   owners, day counters and evidence submission.
3. Change the entry context to *Returner — still overseas* → the money stage now
   requires an FX plan and the move stage requires a vehicle path.

## 5. The scoreboard (2 min)

1. Open `/cockpit/funnel`.
2. Paid households against the 10-household validation target, paid conversion,
   diaspora-sourced count, and the breakdown by community and entry context.
3. Tie it back to `docs/playbooks/diaspora-outreach-checklist.md`: every tracked
   link in that doc lands in this table.
```

In `README.md`, update the seeded-cases list and add two sections. Replace the "Seeded cases" list with:

```markdown
- **Bloggs return (paid)** — `PAID_DWY`, entry `RETURNER_OVERSEAS`, lead `DIASPORA_AU_UK`
- **Smith DIY journey** — `FREE_DIY`, entry `UK_RESIDENT_SPEED`, lead `ORGANIC`
- **Okafor US return (free)** — `FREE_DIY`, entry `RETURNER_OVERSEAS`, lead `DIASPORA_US_UK`
```

and add after the "Happy-path demo" section:

```markdown
## Acquisition funnel

Public pages (no login): `/`, `/pricing`, `/stories/<slug>`, `/start`.

Campaign links carry attribution into the case: `/?utm_source=poms-in-oz&utm_medium=community`.
Recognised tags live in `SOURCE_MAP` in `src/domain/attribution.ts` and are
mirrored in [`docs/playbooks/diaspora-outreach-checklist.md`](docs/playbooks/diaspora-outreach-checklist.md).

`/start` creates a `CLIENT` user plus a `Case` with entry context, tier and lead
attribution. **Paid is the default tier** — only an explicit `plan=free` creates
a `FREE_DIY` case.

Advisors can upgrade a case FREE→PAID and edit the entry context from the case
page; changing entry context rebuilds the required evidence from the market pack.

Validation metrics: `/cockpit/funnel`.

Walkthrough: [`docs/superpowers/plans/demo-script-acquisition-funnel.md`](docs/superpowers/plans/demo-script-acquisition-funnel.md).

## Advisor operating IP

Stage playbooks live in `src/domain/market-packs/ew-playbook.ts` and render only
inside `/cockpit`. `assertPlaybookVisible` rejects every non-advisor role, and
`tests/server/cockpit-playbook-policy.test.ts` asserts no playbook string can
appear in a client stage view.
```

- [ ] **Step 4: Run the full verification**

Run: `npx vitest run tests/content/outreach-checklist.test.ts`

Expected: PASS — 4 tests

Run: `npm test`

Expected: PASS — every suite

Run: `npm run build`

Expected: build succeeds; route list includes `/`, `/pricing`, `/stories/[slug]`, `/start`, `/cockpit/funnel`

Manual: walk the demo script end to end once.

- [ ] **Step 5: Commit**

```bash
git add docs/playbooks/diaspora-outreach-checklist.md docs/superpowers/plans/demo-script-acquisition-funnel.md README.md tests/content/outreach-checklist.test.ts
git commit -m "docs: diaspora outreach checklist and acquisition demo script"
```

---

## Plan self-review

**Spec coverage (this plan only — Plan 2):**

| Spec item | Task |
|---|---|
| §6 "Marketing site — diaspora-led story; clear path into free (limited) or paid (primary)" | 3, 4 |
| §1 "v1 customer: UK/dual nationals returning… especially AU→UK and US→UK" | 3, 4, 9 |
| §5 "Paid done-with-you is the default product in UX, copy, and outcomes" | 3, 4, 5 (tier defaults to `PAID_DWY`) |
| §5 "Free DIY is a funnel… must not give away operating IP" | 3 (`PAID_ONLY_CAPABILITY_PATTERNS`), 6 (leak test) |
| §5 "IP behind paid: detailed playbooks and evidence standards… escalation rules and advisor cockpit behaviours" | 6 |
| §4 entry points (overseas / in-UK / UK-resident speed) as branching metadata | 3 (stories), 5 (intake), 6 (playbook branching), 7 (editable) |
| §7 "Mortgage: introducer only; no advice", disclosed referral, buyer-side | 3 (`REGULATORY_DISCLOSURES`, `FORBIDDEN_CLAIM_PATTERNS`), 4 (footer), 9 (doc) |
| §8 "Validation metrics: … diaspora referral source" | 1, 2, 8 |
| §1 "~10–20 households" and "default recommendation in 1–2 diaspora communities" | 8 (`VALIDATION_TARGET_HOUSEHOLDS`), 9 (definition of done) |
| §1/§8 England & Wales only | Global constraints + `OUT_OF_SCOPE_GEO_PATTERNS` test in Task 3 |
| §13 sub-project 2 "Returner acquisition funnel + paid orchestration ops playbook" | Tasks 1–9 |
| Founder-facing outreach content (not a CRM) | 9 |

**Deliberately not built (deferred to sub-project 3 and later):** partner scorecards, referral fee ledger and disclosure records, document vault binary uploads, chain-free anything, hard or soft published SLAs, real FX/mortgage/removals APIs, Rightmove/Zoopla, market-pack configuration UI, email notifications.

**Placeholder scan:** none. Every code step ships complete code; the only string requiring environment substitution is `<host>` inside the outreach checklist's example URLs, which is intentional founder-facing content and is not read by any code path (the checklist test extracts only `utm_source=` tags).

**Type consistency check:**
- `LeadAttribution` / `LeadSource` defined in Task 1, consumed unchanged by Tasks 2 (`CaseState.attribution`, Prisma columns), 5 (`createSelfServeCase`), 8 (`FunnelCaseRow.leadSource`), 9 (checklist test).
- `parseAttribution` and `RawAttributionParams` defined in Task 1, used by Task 4 (`attributionParamsFrom` produces exactly `RawAttributionParams`) and Task 5 (`signUpAction`).
- `startHref({ plan, entryContext?, params? })` defined in Task 4 and called with that exact shape in `PlanCards`, the home page, story pages and the start page.
- `ParsedIntake` defined in Task 5 and consumed by `createSelfServeCase` in the same task with identical field names (`caseTitle`, not `title`).
- `StagePlaybook` defined in Task 6 and re-exported through `src/lib/cockpit-playbook.ts` for `PlaybookPanel`.
- `advisorPlaybookText` from Plan 1 is fully removed in Task 6; the only caller (`src/app/cockpit/cases/[caseId]/page.tsx`) is updated in the same task.
- `createCase` gains an optional `attribution` in Task 2, so every existing Plan 1 call site and test keeps compiling.
- `StageEngineError` codes `ALREADY_PAID` and `ENTRY_LOCKED` are added to the union in Task 7 before `case-admin.ts` throws them.
- `listCasesForUser` gains `leadSource` in Task 8; both call sites (`/cockpit/cases`, `/portal`) accept the wider row because the added field is additive.
