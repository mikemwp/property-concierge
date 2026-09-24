# Chain-Free Certification Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a buyer-side chain-free overlay on England & Wales cases: a ledger-derived `ChainFreeCertification` (not star ratings), an optional `chain_free_matching` stage between search and offer when `chain_free_inventory` is on, advisor certify / ineligible / reset with audit events, portal status copy only when CERTIFIED or IN_PROGRESS, and a light marketing hook. No seller inventory, no hard client SLAs, no marketplace, no estate-agency introductions.

**Architecture:** Four layers, no cycles.

1. **Pure domain** (`src/domain/chain-free.ts`) — statuses, criteria, scorecard/participation signals, override events, client copy, advisor view. No Prisma, no Next.js, no jurisdiction literals.
2. **Market-local data** (`ew-config` flag, `ew-stages` insert, `ew-playbook` insert) — the matching stage and its operating IP live in the E&W pack. The `au` stub stays off and stage-less for this module.
3. **Policy + load** (`src/server/chain-free.ts`, `src/server/cockpit-policy.ts`) — fail-closed flag gate; assemble referrals + scorecards into signals; run `assessCertification`.
4. **Surfaces** — cockpit checklist + actions (IP), portal status card (copy only), one marketing homepage section.

**The invariant that makes this an overlay and not a product rewrite:** certification is derived from the existing stage ledger, partner referrals and scorecards. Advisor override is an audit event, never a star rating. The matching stage is a buyer-position checklist between `search_readiness` and `offer_instruct`. Nothing here lists a seller property, introduces a buyer to a seller for a fee, or renders a promised completion date.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§1 beachhead vs product, §4 UK-resident same engine, §5 paid orchestration + IP behind paid, §7 buyer-side orchestrator / no estate-agency, §8 scorecards from the ledger, §9 dependency rule + Phase 3/4 chain-free, §13 sub-project 6).

**Builds on (already shipped, do not rebuild):**
- Plan 1 — `src/domain/stage-engine.ts` (`CaseState`, `StageState`, evidence accept/advance, single ACTIVE stage).
- Plan 2 — intake, `/start`, playbooks, `src/content/marketing.ts`, `FORBIDDEN_CLAIM_PATTERNS`.
- Plan 3 — `src/domain/scorecard.ts` (`PartnerScorecard`, `ScorecardRating`), `src/domain/referral.ts`, `src/server/scorecards.ts`, `src/server/referrals.ts`.
- Plan 4 — `MarketPack` / `MarketFlags` / `isModuleEnabled`, `ew-stages.ts`, `ew-playbook.ts`, `tests/domain/market-pack-flags.test.ts`, `src/lib/case-pack.ts`.
- Plan 5 — `partner_speed_rails` on for `ew`, partner activity ledger, cockpit/partner surfaces. `hard_client_sla` stays off.

**Follow-on plans (not this plan):** additional corridor market packs AU↔UK / US↔UK (Plan 7), document vault, hard client-facing SLAs, seller milestone views, agent/developer verified-buyer leads, FCA Appointed Representative status, open partner marketplace.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include this section.

- **Beachhead, not product definition:** §1 "Chain-free and returner are beachheads, not the forever product definition." Paid orchestration is the product. Certification is an overlay on the same engine.
- **Same engine for UK-resident speed-seekers:** §1 / §4. Do not hard-code international-only stage names or domain objects. `UK_RESIDENT_SPEED` uses the same `ChainFreeCertification` and the same matching stage via entry context.
- **Buyer-side only:** §7 "avoid estate-agency activity (no private seller–buyer introduction for a fee in v1)". No seller listings, no inventory feed, no private intro, no lead fee to an agent or developer.
- **Not an open marketplace:** §2 / §7 curated panel only. Matching does not browse third-party stock.
- **Dependency rule, now split:** §9 "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real." Plans 1–3 satisfied the dependency. This plan turns `chain_free_inventory` **on for `ew` only as data** — buyer certification/matching, not a seller inventory product. `hard_client_sla` stays **off in every pack**.
- **Scorecards unlock speed credibility:** certification consumes ledger + scorecard signals (`paid_tier`, partner participation, required evidence). No manual star ratings.
- **Freemium / IP:** §5. Criteria checklist, playbook and override controls are advisor-only. The client portal may show status copy only when status is `CERTIFIED` or `IN_PROGRESS`. Free DIY never becomes `IN_PROGRESS` because `paid_tier` is unmet.
- **No hard client SLA:** nothing renders a promised or guaranteed completion date. Portal copy must say the status is not a date.
- **Fail closed:** overlay is off unless the case's resolved pack enables `chain_free_inventory`. Unknown or disabled packs still throw `MarketPackError` at `casePack`; policy treats that as off.
- **No Prisma column:** certification is reconstructed from `CaseState.events` plus live criteria. Do not add a `chainFreeStatus` field to `schema.prisma`.
- **Linear stage, not a parallel engine:** the stage engine allows exactly one ACTIVE stage. The matching stage is inserted between search and offer. Do not invent a parallel track.
- **Engineering:** TDD per task; pure domain imports no framework / Next / Prisma; server actions keep `{ ok: true } | { ok: false; error: string }`; existing tests keep passing (`npm test`); `npm run build` passes at the end; DRY, YAGNI.

## File structure (locked)

```
src/
  domain/
    chain-free.ts                              # NEW (Task 1): statuses, criteria, assess, override, copy
    market-packs/
      ew-config.ts                             # MODIFY (Task 2): chain_free_inventory: true
      ew-stages.ts                             # MODIFY (Task 3): insert chain_free_matching when flag on
      ew-playbook.ts                           # MODIFY (Task 3): matching playbook when flag on
  server/
    chain-free.ts                              # NEW (Task 4): canUse / assert / loadCertification
    cockpit-policy.ts                          # MODIFY (Task 4): assertCertificationVisible
  app/
    actions/
      chain-free.ts                            # NEW (Task 5): certify / ineligible / reset
    cockpit/cases/[caseId]/page.tsx            # MODIFY (Task 6): render certification panel
    cockpit/panel/page.tsx                     # MODIFY (Task 6): scorecards unlock certification copy
    portal/cases/[caseId]/page.tsx             # MODIFY (Task 7): status card when copy exists
    (marketing)/page.tsx                       # MODIFY (Task 8): optional hook section
  components/
    ChainFreeCertificationPanel.tsx            # NEW (Task 6): advisor badge + checklist + forms
    ChainFreeStatusCard.tsx                    # NEW (Task 7): client copy only
  content/
    marketing.ts                               # MODIFY (Task 8): CHAIN_FREE_HOOK; allow the words; forbid inventory
tests/
  domain/chain-free.test.ts                    # NEW (Task 1)
  domain/engine-country-agnostic.test.ts       # MODIFY (Task 1): add chain-free.ts
  domain/market-pack-flags.test.ts             # MODIFY (Task 2): ew-only on; hard_client_sla still gated
  domain/market-pack-inspector.test.ts         # MODIFY (Task 2): module row true for ew
  domain/ew-pack.test.ts                       # MODIFY (Tasks 2–3): flags + ten-stage order
  domain/ew-playbook.test.ts                   # MODIFY (Task 3): real playbook; unknown key stays null
  lib/case-pack.test.ts                        # MODIFY (Task 3): defined SLA 7; unknown key still falls back
  server/chain-free-policy.test.ts             # NEW (Task 4)
  server/chain-free-actions.test.ts            # NEW (Task 5)
  server/chain-free-portal.test.ts             # NEW (Task 7)
  content/marketing-copy.test.ts               # MODIFY (Task 8)
docs/
  superpowers/plans/demo-script-chain-free.md  # NEW (Task 9)
  superpowers/plans/demo-script-market-packs.md# MODIFY (Task 9)
  superpowers/plans/demo-script-speed-rails.md # MODIFY (Task 9)
README.md                                      # MODIFY (Task 9)
```

**Layering rule:** `src/domain/chain-free.ts` imports only `./stage-engine`, `./types` and `./scorecard` (types + `ScorecardRating`). It must not import market packs, Prisma, Next or scorecard *computation*. `src/server/chain-free.ts` is the only module that combines referrals, scorecards and the domain assessor. Actions never call `assessCertification` without going through `loadCertification` or a test-injected signal list.

---

### Task 1: Certification vocabulary, criteria, override events and copy

**Files:**
- Create: `src/domain/chain-free.ts`
- Create: `tests/domain/chain-free.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/domain/chain-free.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `CaseState`, `getFocusStage` from `src/domain/stage-engine.ts`; `ActorRole`, `isPartnerActorRole` from `src/domain/types.ts`; `ScorecardRating` from `src/domain/scorecard.ts`.
- Produces: `ChainFreeStatus`, `CHAIN_FREE_STATUSES`, `isChainFreeStatus`, `ChainFreeCriterionKey`, `CHAIN_FREE_CRITERION_KEYS`, `CHAIN_FREE_REQUIRED_EVIDENCE`, `CHAIN_FREE_EVENT_TYPES`, `ChainFreeOverrideAction`, `CHAIN_FREE_OVERRIDE_ACTIONS`, `MIN_CHAIN_FREE_REASON_LENGTH`, `PartnerParticipationSignal`, `ChainFreeCriterion`, `ChainFreeOverride`, `ChainFreeEventPayload`, `ChainFreeCertification`, `ClientCertificationCopy`, `AdvisorCertificationView`, `ChainFreeError`, `encodeChainFreePayload`, `decodeChainFreePayload`, `acceptedEvidenceKinds`, `partnerParticipationMet`, `evaluateCriteria`, `partnerSignalsFrom`, `assessCertification`, `applyCertificationOverride`, `clientCertificationCopy`, `advisorCertificationView`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/chain-free.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import type { CaseState } from "../../src/domain/stage-engine";
import {
  acceptedEvidenceKinds,
  advisorCertificationView,
  applyCertificationOverride,
  assessCertification,
  CHAIN_FREE_REQUIRED_EVIDENCE,
  ChainFreeError,
  clientCertificationCopy,
  decodeChainFreePayload,
  encodeChainFreePayload,
  evaluateCriteria,
  partnerParticipationMet,
  partnerSignalsFrom,
  type PartnerParticipationSignal,
} from "../../src/domain/chain-free";

function paidUk(id = "cf1"): CaseState {
  return createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
  });
}

function acceptKinds(caseState: CaseState, kinds: readonly string[]): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      acceptedEvidenceKinds: [
        ...new Set([
          ...stage.acceptedEvidenceKinds,
          ...kinds.filter((kind) => stage.requiredEvidenceKinds.includes(kind)),
        ]),
      ],
    })),
  };
}

function participating(): PartnerParticipationSignal[] {
  return [
    {
      partnerId: "p_mortgage",
      roleType: "MORTGAGE_PARTNER",
      hasReferral: true,
      participatedOnCase: true,
      scorecardRating: "STRONG",
      participationRate: 0.8,
    },
  ];
}

function eligibleCase(): CaseState {
  return acceptKinds(paidUk("cf_ok"), CHAIN_FREE_REQUIRED_EVIDENCE);
}

describe("criteria from the ledger, not stars", () => {
  it("requires paid tier, a participation or scorecard signal, and the three evidence kinds", () => {
    const free = createCase({
      id: "cf_free",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    const unpaid = evaluateCriteria({ caseState: free, partnerSignals: participating() });
    expect(unpaid.find((c) => c.key === "paid_tier")?.met).toBe(false);

    const noPartner = evaluateCriteria({ caseState: paidUk(), partnerSignals: [] });
    expect(noPartner.find((c) => c.key === "partner_participation")?.met).toBe(false);

    const scoreOnly = evaluateCriteria({
      caseState: paidUk(),
      partnerSignals: [
        {
          partnerId: "p2",
          roleType: "CONVEYANCER",
          hasReferral: true,
          participatedOnCase: false,
          scorecardRating: "WATCH",
          participationRate: 0.2,
        },
      ],
    });
    expect(scoreOnly.find((c) => c.key === "partner_participation")?.met).toBe(true);

    const missingEvidence = evaluateCriteria({
      caseState: paidUk(),
      partnerSignals: participating(),
    });
    expect(missingEvidence.find((c) => c.key === "evidence_complete")?.met).toBe(false);

    const ready = evaluateCriteria({
      caseState: eligibleCase(),
      partnerSignals: participating(),
    });
    expect(ready.every((c) => c.met)).toBe(true);
    expect(acceptedEvidenceKinds(eligibleCase())).toEqual(
      expect.arrayContaining([...CHAIN_FREE_REQUIRED_EVIDENCE]),
    );
  });

  it("treats a superseded referral as no signal and ignores client-role rows", () => {
    const caseState = {
      ...paidUk(),
      events: [
        {
          type: "EVIDENCE_SUBMITTED",
          stageKey: "mortgage_path",
          actorRole: "MORTGAGE_PARTNER" as const,
          at: "2026-09-04T10:00:00.000Z",
          payload: "dip_aip",
        },
      ],
    };
    const signals = partnerSignalsFrom({
      caseState,
      referrals: [
        { partnerId: "old", partnerRole: "MORTGAGE_PARTNER", supersededAt: "2026-09-03T00:00:00.000Z" },
        { partnerId: "new", partnerRole: "MORTGAGE_PARTNER", supersededAt: null },
        { partnerId: "clientish", partnerRole: "CLIENT", supersededAt: null },
      ],
      scorecards: [
        { partnerId: "new", rating: "NO_DATA", participationRate: 0 },
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.partnerId).toBe("new");
    expect(signals[0]?.participatedOnCase).toBe(true);
    expect(partnerParticipationMet(signals)).toBe(true);
  });
});

describe("assessCertification", () => {
  it("stays NOT_ASSESSED when the module is off, even if every criterion is green", () => {
    const cert = assessCertification({
      caseState: eligibleCase(),
      moduleEnabled: false,
      partnerSignals: participating(),
    });
    expect(cert.status).toBe("NOT_ASSESSED");
    expect(cert.eligibleByRules).toBe(false);
    expect(cert.override).toBeNull();
    expect(clientCertificationCopy(cert)).toBeNull();
  });

  it("is NOT_ASSESSED for free DIY and IN_PROGRESS once the household is paid", () => {
    const free = assessCertification({
      caseState: createCase({ id: "cf_f", entryContext: "UK_RESIDENT_SPEED", tier: "FREE_DIY" }),
      moduleEnabled: true,
      partnerSignals: [],
    });
    expect(free.status).toBe("NOT_ASSESSED");
    expect(clientCertificationCopy(free)).toBeNull();

    const paid = assessCertification({
      caseState: paidUk(),
      moduleEnabled: true,
      partnerSignals: [],
    });
    expect(paid.status).toBe("IN_PROGRESS");
    expect(paid.eligibleByRules).toBe(false);
    expect(clientCertificationCopy(paid)?.status).toBe("IN_PROGRESS");
  });

  it("does not auto-certify when every rule is met — that stays an advisor override", () => {
    const cert = assessCertification({
      caseState: eligibleCase(),
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(cert.eligibleByRules).toBe(true);
    expect(cert.status).toBe("IN_PROGRESS");
  });

  it("serves UK-resident speed-seekers through the same assessor as returners", () => {
    const resident = assessCertification({
      caseState: eligibleCase(),
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    const returner = assessCertification({
      caseState: acceptKinds(
        createCase({ id: "cf_ret", entryContext: "RETURNER_OVERSEAS", tier: "PAID_DWY" }),
        CHAIN_FREE_REQUIRED_EVIDENCE,
      ),
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(resident.criteria.map((c) => c.key)).toEqual(returner.criteria.map((c) => c.key));
  });
});

describe("advisor override with an audit event", () => {
  it("certifies only when rules pass, records a reason, and is resettable", () => {
    const now = new Date("2026-09-06T09:00:00.000Z");
    const certified = applyCertificationOverride(eligibleCase(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      actorRole: "ADVISOR",
      now,
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    const event = certified.events.at(-1);
    expect(event?.type).toBe("CHAIN_FREE_CERTIFIED");
    expect(decodeChainFreePayload(event?.payload)).toEqual({
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
    });

    const after = assessCertification({
      caseState: certified,
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(after.status).toBe("CERTIFIED");
    expect(after.override?.reason).toMatch(/no onward chain/i);
    expect(advisorCertificationView(after)).toMatchObject({
      canCertify: false,
      canMarkIneligible: true,
      canReset: true,
    });
    expect(clientCertificationCopy(after)?.headline).toMatch(/certified chain-free/i);

    const reset = applyCertificationOverride(certified, {
      action: "RESET",
      reason: "Re-check after a new fact.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(reset.events.at(-1)?.type).toBe("CHAIN_FREE_RESET");
    expect(
      assessCertification({
        caseState: reset,
        moduleEnabled: true,
        partnerSignals: participating(),
      }).status,
    ).toBe("IN_PROGRESS");
  });

  it("lets an advisor mark ineligible even when rules pass, and refuses a second stamp", () => {
    const marked = applyCertificationOverride(eligibleCase(), {
      action: "INELIGIBLE",
      reason: "Household still selling a flat.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    expect(
      assessCertification({
        caseState: marked,
        moduleEnabled: true,
        partnerSignals: participating(),
      }).status,
    ).toBe("INELIGIBLE");
    expect(clientCertificationCopy(
      assessCertification({
        caseState: marked,
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    )).toBeNull();

    expect(() =>
      applyCertificationOverride(marked, {
        action: "INELIGIBLE",
        reason: "Household still selling a flat.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(ChainFreeError);
  });

  it("refuses clients, short reasons, a closed module, and certify-when-red", () => {
    const ready = eligibleCase();
    expect(() =>
      applyCertificationOverride(ready, {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        actorRole: "CLIENT",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(/advisor/i);

    expect(() =>
      applyCertificationOverride(ready, {
        action: "CERTIFY",
        reason: "short",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(/reason/i);

    expect(() =>
      applyCertificationOverride(ready, {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        actorRole: "ADVISOR",
        moduleEnabled: false,
        partnerSignals: participating(),
      }),
    ).toThrow(/not enabled/i);

    expect(() =>
      applyCertificationOverride(paidUk(), {
        action: "CERTIFY",
        reason: "I just like them.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: [],
      }),
    ).toThrow(/criterion/i);

    expect(() =>
      applyCertificationOverride(ready, {
        action: "RESET",
        reason: "Nothing to undo here.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    ).toThrow(/reset/i);
  });

  it("round-trips the payload codec and ignores bare strings", () => {
    const encoded = encodeChainFreePayload({ action: "CERTIFY", reason: "ok enough" });
    expect(decodeChainFreePayload(encoded)).toEqual({ action: "CERTIFY", reason: "ok enough" });
    expect(decodeChainFreePayload("dip_aip")).toBeNull();
    expect(decodeChainFreePayload(undefined)).toBeNull();
  });
});

describe("client copy never carries scorecard IP", () => {
  it("omits numbers, SLA language, guarantees and evidence kind names", () => {
    const certified = applyCertificationOverride(eligibleCase(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: participating(),
    });
    const copy = clientCertificationCopy(
      assessCertification({
        caseState: certified,
        moduleEnabled: true,
        partnerSignals: participating(),
      }),
    );
    const blob = JSON.stringify(copy);
    expect(blob).not.toMatch(/qualityScore|participationRate|slaDays|guarantee/i);
    expect(blob).not.toContain("source_of_funds");
    expect(blob).not.toContain("dip_aip");
    expect(blob).toMatch(/not a completion date/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/chain-free.test.ts`
Expected: FAIL with `Cannot find module '../../src/domain/chain-free'` (or the first exported name is not defined).

- [ ] **Step 3: Write the domain module**

Create `src/domain/chain-free.ts` with exactly the exports listed in Interfaces. Lock these rules in the implementation (do not invent extra statuses or criteria):

```ts
export const CHAIN_FREE_STATUSES = [
  "NOT_ASSESSED",
  "IN_PROGRESS",
  "CERTIFIED",
  "INELIGIBLE",
] as const;

export const CHAIN_FREE_CRITERION_KEYS = [
  "paid_tier",
  "partner_participation",
  "evidence_complete",
] as const;

export const CHAIN_FREE_REQUIRED_EVIDENCE = [
  "source_of_funds",
  "dip_aip",
  "buyer_ready",
] as const;

export const CHAIN_FREE_EVENT_TYPES = [
  "CHAIN_FREE_CERTIFIED",
  "CHAIN_FREE_MARKED_INELIGIBLE",
  "CHAIN_FREE_RESET",
] as const;

export const CHAIN_FREE_OVERRIDE_ACTIONS = ["CERTIFY", "INELIGIBLE", "RESET"] as const;

export const MIN_CHAIN_FREE_REASON_LENGTH = 8;

export type PartnerParticipationSignal = {
  partnerId: string;
  roleType: ActorRole;
  hasReferral: boolean;
  participatedOnCase: boolean;
  scorecardRating: ScorecardRating;
  participationRate: number;
};

export type ChainFreeCertification = {
  status: ChainFreeStatus;
  criteria: ChainFreeCriterion[];
  eligibleByRules: boolean;
  override: ChainFreeOverride | null;
  moduleEnabled: boolean;
};

export class ChainFreeError extends Error {
  constructor(
    public code:
      | "MODULE_OFF"
      | "NOT_ELIGIBLE"
      | "REASON_REQUIRED"
      | "FORBIDDEN_ROLE"
      | "NOTHING_TO_RESET"
      | "ALREADY_CERTIFIED"
      | "ALREADY_INELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "ChainFreeError";
  }
}
```

Status resolution, in this order:

1. `moduleEnabled === false` → `status: "NOT_ASSESSED"`, `eligibleByRules: false`, `override: null`. Still run `evaluateCriteria` so tests can see raw gates, but the overlay is absent.
2. Walk `caseState.events` from the end. The last `CHAIN_FREE_*` event whose payload decodes wins. `RESET` clears the override (`override: null`). `CERTIFY` → `CERTIFIED`. `INELIGIBLE` → `INELIGIBLE`.
3. No override: `IN_PROGRESS` when `paid_tier` is met (including when every criterion is met); otherwise `NOT_ASSESSED`. Never auto-set `CERTIFIED`.

`partnerParticipationMet`: at least one signal with `hasReferral === true` and `isPartnerActorRole(roleType)`, and that signal has `participatedOnCase` or `scorecardRating` of `"STRONG"` or `"WATCH"` or `participationRate >= 0.5`.

`partnerSignalsFrom`: keep non-superseded partner-role referrals only; `participatedOnCase` is true when the case has an `EVIDENCE_SUBMITTED` event from that `partnerRole`; rating / rate come from the matching `partnerId` scorecard row or default to `"NO_DATA"` / `0`.

`applyCertificationOverride`: advisor only; `reason.trim().length >= 8`; module must be on; `CERTIFY` requires `eligibleByRules` and current status not already `CERTIFIED`; `INELIGIBLE` refuses a second ineligible stamp; `RESET` requires an existing override. Append one event (`CHAIN_FREE_CERTIFIED` / `CHAIN_FREE_MARKED_INELIGIBLE` / `CHAIN_FREE_RESET`) on the focus stage key (or `stages[0].key`) with `encodeChainFreePayload({ action, reason: trimmed })`.

`clientCertificationCopy`: `null` unless module on and status is `CERTIFIED` or `IN_PROGRESS`. Certified headline `"Certified chain-free buyer"`; in-progress headline `"Chain-free certification in progress"`. Both bodies must say this is not a completion date. No criterion labels, no evidence kind ids, no score numbers.

`advisorCertificationView`: `canCertify` when module on, `eligibleByRules`, status not `CERTIFIED`; `canMarkIneligible` when module on and status not `INELIGIBLE`; `canReset` when module on and `override !== null`.

Add `"src/domain/chain-free.ts"` to `ENGINE_GLOBAL_FILES` in `tests/domain/engine-country-agnostic.test.ts`. Do not put `£`, `GBP`, `en-GB`, `england` or `wales` in the new file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/chain-free.test.ts tests/domain/engine-country-agnostic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/chain-free.ts tests/domain/chain-free.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: derive chain-free certification from ledger rules and advisor override"
```

---

### Task 2: Turn `chain_free_inventory` on for England & Wales only

**Files:**
- Modify: `src/domain/market-packs/ew-config.ts`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/ew-pack.test.ts` (flags object only)
- Modify: `tests/domain/market-pack-inspector.test.ts` (module row)

**Interfaces:**
- Consumes: `MarketFlags`, `isModuleEnabled`, `GATED_MODULES` pattern already in `tests/domain/market-pack-flags.test.ts`; `EW_FLAGS` from `ew-config.ts`.
- Produces: `EW_FLAGS.chain_free_inventory === true`. `hard_client_sla` remains absent/false. `auStubPack.flags` stays `{}`.

- [ ] **Step 1: Write the failing tests**

In `tests/domain/market-pack-flags.test.ts` replace the gated list and add an ew-only assertion. The file must read:

```ts
/** Spec §9: hard SLAs stay unsold. Chain-free inventory is on for ew as buyer overlay data only. */
const GATED_MODULES = [
  "hard_client_sla",
  "corridor_inbound",
  "corridor_outbound",
  "document_vault",
] as const;
```

Add this test next to the existing FX / speed-rails tests:

```ts
  it("runs the chain-free overlay in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "chain_free_inventory"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "hard_client_sla")).toBe(
      false,
    );
  });
```

Keep `keeps every gated module off in every registered pack` — it now guards `hard_client_sla` and the still-off corridors / vault, not `chain_free_inventory`.

In `tests/domain/ew-pack.test.ts` change the flags snapshot:

```ts
    expect(ewMarketPack.flags).toEqual({
      fx_deposit: true,
      partner_speed_rails: true,
      chain_free_inventory: true,
    });
```

In `tests/domain/market-pack-inspector.test.ts` change the module row:

```ts
    expect(summary.modules.find((m) => m.key === "chain_free_inventory")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "hard_client_sla")?.enabled).toBe(false);
```

Do not change `tests/domain/market-pack-types.test.ts` (the fixture pack still omits the flag, so `isModuleEnabled(..., "chain_free_inventory")` stays false). Do not change `tests/domain/market-pack-registry.test.ts` (the `au` stub must remain off).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts`
Expected: FAIL — `ew` still has `chain_free_inventory` off, so the new ew-only test gets `[]` and the flags snapshot / inspector row mismatch.

- [ ] **Step 3: Turn the flag on**

In `src/domain/market-packs/ew-config.ts` replace the flags block and its comment:

```ts
/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are
 * adapter plumbing. Spec §13 sub-project 6: chain_free_inventory is on as
 * buyer-side certification/matching data — not seller listings and not a
 * client SLA. hard_client_sla stays off.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
  chain_free_inventory: true,
};
```

Do not add stages or playbooks in this task. A flag without a stage is still valid pack data; Task 3 inserts the stage when this flag is on.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-types.test.ts`
Expected: PASS. Confirm `au` still reports `chain_free_inventory` off.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/ew-config.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts
git commit -m "feat: enable chain_free_inventory on the England and Wales pack only"
```

---

### Task 3: Optional `chain_free_matching` stage and playbook

**Files:**
- Modify: `src/domain/market-packs/ew-stages.ts`
- Modify: `src/domain/market-packs/ew-playbook.ts`
- Modify: `tests/domain/ew-pack.test.ts`
- Modify: `tests/domain/ew-playbook.test.ts`
- Modify: `tests/lib/case-pack.test.ts`

**Interfaces:**
- Consumes: `EW_FLAGS`, `isModuleEnabled`, `StageTemplate`, `StagePlaybook`, `ewStageTemplates`, `ewPlaybooks`.
- Produces: `chainFreeMatchingTemplate(): StageTemplate` with `key: "chain_free_matching"`, `title: "Chain-free position"`, `defaultOwnerRole: "CLIENT"`, `slaDays: 7`, `requiredEvidenceKinds: ["chain_free_position"]`, `freeVisible: true`, `freeCanSelfAdvance: false`. `chainFreeMatchingPlaybook(): StagePlaybook` with the same `stageKey`. When the flag is on, both sit immediately before `offer_instruct`. When the flag is off, neither appears.

- [ ] **Step 1: Write the failing tests**

Replace the nine-key snapshot in `tests/domain/ew-pack.test.ts` with:

```ts
  it("returns the canonical stage keys plus chain-free matching when the module is on", () => {
    const stages = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS");
    expect(stages.map((s) => s.key)).toEqual([
      "purchase_profile",
      "money_readiness",
      "mortgage_path",
      "move_logistics",
      "search_readiness",
      "chain_free_matching",
      "offer_instruct",
      "diligence",
      "exchange_complete",
      "settle_light",
    ]);
  });

  it("gives UK-resident speed-seekers the same matching stage, without international-only evidence", () => {
    const stages = getStageTemplate(ewMarketPack, "UK_RESIDENT_SPEED");
    const matching = stages.find((s) => s.key === "chain_free_matching");
    expect(matching).toMatchObject({
      title: "Chain-free position",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["chain_free_position"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    });
    expect(matching?.requiredEvidenceKinds.some((k) => /fx|vehicle|container/i.test(k))).toBe(
      false,
    );
  });
```

Delete the trailing `expect(stagePlaybook(ewMarketPack, "chain_free_matching", "RETURNER_IN_UK")).toBeNull()` from the playbook-coverage test — coverage now requires a real playbook because the stage exists. Keep the loop that asserts `buildPlaybooks(entry)` keys equal `buildStages(entry)` keys.

In `tests/domain/ew-playbook.test.ts` replace the unknown-key example and add the estate-agency guard:

```ts
  it("returns null for unknown stage keys", () => {
    expect(ewStagePlaybook("not_a_real_stage", "RETURNER_IN_UK")).toBeNull();
  });

  it("covers chain_free_matching as buyer-position work, not a seller introduction", () => {
    const playbook = ewStagePlaybook("chain_free_matching", "UK_RESIDENT_SPEED");
    expect(playbook?.stageKey).toBe("chain_free_matching");
    expect(playbook?.objective.length).toBeGreaterThan(20);
    expect(playbook?.actions.length).toBeGreaterThanOrEqual(2);
    const blob = JSON.stringify(playbook);
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/private listing/i);
    expect(blob).not.toMatch(/inventory feed/i);
    expect(blob).toMatch(/chain_free_position/);
  });
```

In `tests/lib/case-pack.test.ts` keep the `chain_free_matching === 7` assertion (it now comes from the template, not the fallback) and add a true unknown-key fallback:

```ts
  it("uses the pack SLA for chain_free_matching and falls back for unknown keys", () => {
    const caseState = createCase({ ...base });
    expect(stageSlaDays(caseState, "chain_free_matching")).toBe(7);
    expect(stageSlaDays(caseState, "unknown_overlay_stage")).toBe(7);
  });
```

Remove the old test named `falls back to a one-week cadence for a stage key the pack does not define` if it only covered `chain_free_matching` — the new test replaces it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/ew-pack.test.ts tests/domain/ew-playbook.test.ts tests/lib/case-pack.test.ts`
Expected: FAIL — `chain_free_matching` is missing from the E&W template list and `ewStagePlaybook` still returns null.

- [ ] **Step 3: Insert the stage and playbook**

In `src/domain/market-packs/ew-stages.ts` export the template and splice it in when the flag is on:

```ts
export function chainFreeMatchingTemplate(): StageTemplate {
  return {
    key: "chain_free_matching",
    title: "Chain-free position",
    defaultOwnerRole: "CLIENT",
    slaDays: 7,
    requiredEvidenceKinds: ["chain_free_position"],
    freeVisible: true,
    freeCanSelfAdvance: false,
  };
}
```

At the end of `ewStageTemplates`, after the existing nine-object array is built (keep the current objects unchanged):

```ts
  if (!isModuleEnabled(EW_FLAGS, "chain_free_inventory")) {
    return stages;
  }
  const insertAt = stages.findIndex((stage) => stage.key === "offer_instruct");
  return [
    ...stages.slice(0, insertAt),
    chainFreeMatchingTemplate(),
    ...stages.slice(insertAt),
  ];
```

`ewStageTemplates` already imports `EW_FLAGS` and `isModuleEnabled`. Do not change money or move evidence helpers.

In `src/domain/market-packs/ew-playbook.ts` add `isModuleEnabled` to the existing `./types` import (or import it from `./types` next to `StagePlaybook`). Export:

```ts
export function chainFreeMatchingPlaybook(): StagePlaybook {
  return {
    stageKey: "chain_free_matching",
    objective:
      "Record the household's chain-free position from ledger evidence so they can show agents a certified buyer-readiness status — not a private seller introduction.",
    actions: [
      {
        day: 0,
        owner: "ADVISOR",
        action:
          "Confirm the household has no property to sell, or that any sale has completed, and write that into the case thread.",
      },
      {
        day: 2,
        owner: "CLIENT",
        action:
          "Submit chain_free_position: a written statement of the onward-chain position signed by the decision-makers.",
      },
      {
        day: 4,
        owner: "ADVISOR",
        action:
          "Check the certification criteria on the case. Certify only when every ledger gate is green. Do not introduce this household to a seller for a fee.",
      },
    ],
    evidenceStandard: [
      "chain_free_position: written statement that the household has no property to sell, or that any related sale has completed, signed by every decision-maker.",
    ],
    escalation: [
      "Day 7 (SLA): position still unsigned — advisor calls, does not email, and names the missing decision-maker.",
    ],
    partnerScript: null,
  };
}
```

At the end of `ewPlaybooks`, splice `chainFreeMatchingPlaybook()` immediately before the `offer_instruct` playbook when `isModuleEnabled(EW_FLAGS, "chain_free_inventory")`. The existing `ewPlaybooks(entry).map((p) => p.stageKey)` must stay aligned with `getStageTemplate` for every entry context.

Existing cases already persisted with nine stages are not migrated. `createCase` and a re-seed pick up the tenth stage. `setEntryContext` already maps by key and leaves unknown keys untouched — do not add a backfill helper.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/ew-pack.test.ts tests/domain/ew-playbook.test.ts tests/lib/case-pack.test.ts tests/domain/stage-engine.test.ts tests/domain/freemium.test.ts tests/server/cockpit-playbook-policy.test.ts`
Expected: PASS. New paid E&W cases now have ten stages; playbook coverage still matches keys one-for-one.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/ew-stages.ts src/domain/market-packs/ew-playbook.ts tests/domain/ew-pack.test.ts tests/domain/ew-playbook.test.ts tests/lib/case-pack.test.ts
git commit -m "feat: insert chain-free matching stage between search and offer on ew"
```

---

### Task 4: Policy gate and loaded certification

**Files:**
- Create: `src/server/chain-free.ts`
- Modify: `src/server/cockpit-policy.ts`
- Create: `tests/server/chain-free-policy.test.ts`

**Interfaces:**
- Consumes: `assessCertification`, `partnerSignalsFrom`, `ChainFreeError`, `ChainFreeCertification`, `PartnerParticipationSignal` from `src/domain/chain-free.ts`; `isModuleEnabled` from `src/domain/market-packs/types.ts`; `casePack` from `src/lib/case-pack.ts`; `listReferralsForCase` from `src/server/referrals.ts`; `loadPanelScorecards` from `src/server/scorecards.ts`; `CockpitPolicyError` from `src/server/cockpit-policy.ts`; `ActorRole` from `src/domain/types.ts`.
- Produces from `src/server/chain-free.ts`: `canUseChainFree(caseState: CaseState): boolean`, `assertChainFree(caseState: CaseState): void`, `LoadedCertification` (`{ certification: ChainFreeCertification; partnerSignals: PartnerParticipationSignal[] }`), `loadCertification(caseState: CaseState, now?: Date): Promise<LoadedCertification>`, `performCertificationOverride(caseState: CaseState, input: { action: ChainFreeOverrideAction; reason: string; partnerSignals: PartnerParticipationSignal[]; now?: Date }): CaseState`.
- Produces from `src/server/cockpit-policy.ts`: `assertCertificationVisible(viewerRole: ActorRole): void` — advisor only, same shape as `assertPlaybookVisible`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/chain-free-policy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import {
  assertCertificationVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";
import {
  assertChainFree,
  canUseChainFree,
} from "../../src/server/chain-free";
import { ChainFreeError } from "../../src/domain/chain-free";

function paid() {
  return createCase({ id: "cfp1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("chain-free module gate", () => {
  it("is open for any tier on the England & Wales pack", () => {
    expect(canUseChainFree(paid())).toBe(true);
    expect(
      canUseChainFree(
        createCase({ id: "cfp2", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" }),
      ),
    ).toBe(true);
    expect(() => assertChainFree(paid())).not.toThrow();
  });

  it("is closed when the resolved pack does not enable the module", () => {
    const other = { ...paid(), marketPackId: "au" };
    expect(canUseChainFree(other)).toBe(false);
    expect(() => assertChainFree(other)).toThrow(ChainFreeError);
  });
});

describe("certification checklist visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertCertificationVisible("ADVISOR")).not.toThrow();
    expect(() => assertCertificationVisible("CLIENT")).toThrow(CockpitPolicyError);
    expect(() => assertCertificationVisible("CONVEYANCER")).toThrow(/advisor-only/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/chain-free-policy.test.ts`
Expected: FAIL with `Cannot find module '../../src/server/chain-free'` and `assertCertificationVisible` not exported.

- [ ] **Step 3: Implement policy and load**

Add to `src/server/cockpit-policy.ts` (next to `assertPlaybookVisible`):

```ts
export function assertCertificationVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Chain-free certification criteria are advisor-only operating IP",
    );
  }
}
```

Create `src/server/chain-free.ts`:

```ts
import {
  applyCertificationOverride,
  assessCertification,
  ChainFreeError,
  partnerSignalsFrom,
  type ChainFreeCertification,
  type ChainFreeOverrideAction,
  type PartnerParticipationSignal,
} from "../domain/chain-free";
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { casePack } from "../lib/case-pack";
import { listReferralsForCase } from "./referrals";
import { loadPanelScorecards } from "./scorecards";

export type LoadedCertification = {
  certification: ChainFreeCertification;
  partnerSignals: PartnerParticipationSignal[];
};

export function canUseChainFree(caseState: CaseState): boolean {
  try {
    return isModuleEnabled(casePack(caseState).flags, "chain_free_inventory");
  } catch {
    return false;
  }
}

export function assertChainFree(caseState: CaseState): void {
  if (!isModuleEnabled(casePack(caseState).flags, "chain_free_inventory")) {
    throw new ChainFreeError(
      "MODULE_OFF",
      `Chain-free overlay is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export async function loadCertification(
  caseState: CaseState,
  now: Date = new Date(),
): Promise<LoadedCertification> {
  const referrals = await listReferralsForCase(caseState.id);
  const rows = await loadPanelScorecards(now);
  const partnerSignals = partnerSignalsFrom({
    caseState,
    referrals: referrals.map((row) => ({
      partnerId: row.partnerId,
      partnerRole: row.partnerRole,
      supersededAt: row.supersededAt,
    })),
    scorecards: rows.map((row) => ({
      partnerId: row.member.id,
      rating: row.scorecard.rating,
      participationRate: row.scorecard.participationRate,
    })),
  });
  return {
    partnerSignals,
    certification: assessCertification({
      caseState,
      moduleEnabled: canUseChainFree(caseState),
      partnerSignals,
    }),
  };
}

export function performCertificationOverride(
  caseState: CaseState,
  input: {
    action: ChainFreeOverrideAction;
    reason: string;
    partnerSignals: PartnerParticipationSignal[];
    now?: Date;
  },
): CaseState {
  assertChainFree(caseState);
  return applyCertificationOverride(caseState, {
    action: input.action,
    reason: input.reason,
    actorRole: "ADVISOR",
    now: input.now,
    moduleEnabled: true,
    partnerSignals: input.partnerSignals,
  });
}
```

`assertChainFree` does **not** require `PAID_DWY`. Certify-when-unpaid is already refused by `eligibleByRules`. Mark-ineligible on a paid case that later reveals an onward chain is the point of the override.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/chain-free-policy.test.ts tests/server/cockpit-playbook-policy.test.ts tests/server/speed-rails-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/chain-free.ts src/server/cockpit-policy.ts tests/server/chain-free-policy.test.ts
git commit -m "feat: gate chain-free overlay on the pack flag and load ledger signals"
```

---

### Task 5: Advisor certify / ineligible / reset actions

**Files:**
- Create: `src/app/actions/chain-free.ts`
- Create: `tests/server/chain-free-actions.test.ts`

**Interfaces:**
- Consumes: `performCertificationOverride`, `loadCertification` from `src/server/chain-free.ts`; `loadCaseForUser`, `saveCase`, `CaseAccessError` from `src/server/cases.ts`; `auth` from `src/lib/auth.ts`; `ChainFreeError` from `src/domain/chain-free.ts`; `StageEngineError` from `src/domain/stage-engine.ts`; `revalidatePath` from `next/cache`.
- Produces: `ChainFreeActionResult = { ok: true } | { ok: false; error: string }`, `certifyChainFreeAction(caseId: string, reason: string): Promise<ChainFreeActionResult>`, `markChainFreeIneligibleAction(caseId: string, reason: string): Promise<ChainFreeActionResult>`, `resetChainFreeAction(caseId: string, reason: string): Promise<ChainFreeActionResult>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/chain-free-actions.test.ts`. Do not mock Next auth here — exercise `performCertificationOverride` the actions will call, including `ChainFreeError` message mapping the action file must reuse:

```ts
import { describe, it, expect } from "vitest";
import {
  applyCertificationOverride,
  CHAIN_FREE_REQUIRED_EVIDENCE,
  ChainFreeError,
  assessCertification,
  type PartnerParticipationSignal,
} from "../../src/domain/chain-free";
import { createCase, type CaseState } from "../../src/domain/stage-engine";
import { performCertificationOverride } from "../../src/server/chain-free";

function acceptKinds(caseState: CaseState, kinds: readonly string[]): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      acceptedEvidenceKinds: [
        ...new Set([
          ...stage.acceptedEvidenceKinds,
          ...kinds.filter((kind) => stage.requiredEvidenceKinds.includes(kind)),
        ]),
      ],
    })),
  };
}

const signals: PartnerParticipationSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    participatedOnCase: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

function ready(): CaseState {
  return acceptKinds(
    createCase({ id: "cfa1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" }),
    CHAIN_FREE_REQUIRED_EVIDENCE,
  );
}

describe("performCertificationOverride", () => {
  it("writes CERTIFIED through the policy gate", () => {
    const next = performCertificationOverride(ready(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      partnerSignals: signals,
    });
    expect(
      assessCertification({
        caseState: next,
        moduleEnabled: true,
        partnerSignals: signals,
      }).status,
    ).toBe("CERTIFIED");
  });

  it("maps domain refusals to ChainFreeError codes the action will surface", () => {
    try {
      performCertificationOverride(
        createCase({ id: "cfa2", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" }),
        { action: "CERTIFY", reason: "I just like them.", partnerSignals: [] },
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ChainFreeError);
      expect((err as ChainFreeError).code).toBe("NOT_ELIGIBLE");
    }
  });

  it("refuses the overlay when the pack flag is off", () => {
    const other = { ...ready(), marketPackId: "au" };
    expect(() =>
      performCertificationOverride(other, {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        partnerSignals: signals,
      }),
    ).toThrow(/not enabled/i);
  });
});

describe("error mapping contract", () => {
  it("exposes the domain message, not a generic failure, for ChainFreeError", () => {
    const err = new ChainFreeError("REASON_REQUIRED", "A reason of at least 8 characters is required");
    expect(err.message).toMatch(/reason/i);
    expect(err).toBeInstanceOf(Error);
  });

  it("does not let applyCertificationOverride skip the server gate", () => {
    const certified = applyCertificationOverride(ready(), {
      action: "CERTIFY",
      reason: "Ledger gates green; no onward chain.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
    });
    expect(certified.events.some((e) => e.type === "CHAIN_FREE_CERTIFIED")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/chain-free-actions.test.ts`
Expected: FAIL until `performCertificationOverride` is imported and the action file exists. If Task 4 already implemented `performCertificationOverride`, this file should go green on the domain tests; the action module is still missing — create it in Step 3 regardless, then re-run.

- [ ] **Step 3: Write the server actions**

Create `src/app/actions/chain-free.ts` following `src/app/actions/case-admin.ts` (same auth, `mapError`, `revalidatePath` set):

```ts
"use server";

import {
  type ChainFreeOverrideAction,
  ChainFreeError,
} from "@/domain/chain-free";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import {
  loadCertification,
  performCertificationOverride,
} from "@/server/chain-free";
import { revalidatePath } from "next/cache";

export type ChainFreeActionResult = { ok: true } | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof ChainFreeError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError
  ) {
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
  revalidatePath(`/portal/cases/${caseId}`);
}

async function runOverride(
  caseId: string,
  action: ChainFreeOverrideAction,
  reason: string,
): Promise<ChainFreeActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }
  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const loaded = await loadCertification(caseState);
    caseState = performCertificationOverride(caseState, {
      action,
      reason,
      partnerSignals: loaded.partnerSignals,
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function certifyChainFreeAction(
  caseId: string,
  reason: string,
): Promise<ChainFreeActionResult> {
  return runOverride(caseId, "CERTIFY", reason);
}

export async function markChainFreeIneligibleAction(
  caseId: string,
  reason: string,
): Promise<ChainFreeActionResult> {
  return runOverride(caseId, "INELIGIBLE", reason);
}

export async function resetChainFreeAction(
  caseId: string,
  reason: string,
): Promise<ChainFreeActionResult> {
  return runOverride(caseId, "RESET", reason);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/chain-free-actions.test.ts tests/server/chain-free-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/chain-free.ts tests/server/chain-free-actions.test.ts
git commit -m "feat: advisor actions to certify, mark ineligible, or reset chain-free status"
```

---

### Task 6: Advisor cockpit badge, checklist and controls

**Files:**
- Create: `src/components/ChainFreeCertificationPanel.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx`
- Modify: `src/app/cockpit/panel/page.tsx`

**Interfaces:**
- Consumes: `advisorCertificationView`, `ChainFreeCertification` from domain; `loadCertification` + `canUseChainFree` from `src/server/chain-free.ts`; `assertCertificationVisible` from `src/server/cockpit-policy.ts`; the three actions from `src/app/actions/chain-free.ts`; `ActionErrorBanner` and the bordered-card pattern in `src/components/CaseAdminControls.tsx`.
- Produces: `ChainFreeCertificationPanel` props `{ caseId: string; view: AdvisorCertificationView }`. When `canUseChainFree` is false, the case page renders nothing for this overlay.

UI follows existing cockpit patterns: `mt-8 rounded-lg border border-slate-200 bg-white p-4`, `ActionErrorBanner`, form `action={async (formData) => ...}` with a `reason` text input, submit buttons. Do not restyle the cockpit.

- [ ] **Step 1: Write the failing source-shape test**

Add to `tests/server/chain-free-policy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";

describe("cockpit wiring", () => {
  it("renders the certification panel on the advisor case page and keeps checklist IP off the portal", () => {
    const cockpit = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    expect(cockpit).toContain("ChainFreeCertificationPanel");
    expect(cockpit).toContain("assertCertificationVisible");
    expect(cockpit).toContain("loadCertification");
    expect(portal).not.toContain("ChainFreeCertificationPanel");
    expect(portal).not.toContain("advisorCertificationView");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/chain-free-policy.test.ts`
Expected: FAIL — cockpit page does not yet import `ChainFreeCertificationPanel`.

- [ ] **Step 3: Add the panel and mount it**

Create `src/components/ChainFreeCertificationPanel.tsx` as a client component matching `CaseAdminControls`:

```tsx
"use client";

import { useState } from "react";
import {
  certifyChainFreeAction,
  markChainFreeIneligibleAction,
  resetChainFreeAction,
} from "@/app/actions/chain-free";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { AdvisorCertificationView } from "@/domain/chain-free";

type Props = {
  caseId: string;
  view: AdvisorCertificationView;
};

const BADGE: Record<AdvisorCertificationView["status"], string> = {
  NOT_ASSESSED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-900",
  CERTIFIED: "bg-emerald-100 text-emerald-900",
  INELIGIBLE: "bg-rose-100 text-rose-900",
};

export function ChainFreeCertificationPanel({ caseId, view }: Props) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-slate-900">Chain-free certification</h2>
        <span className={`rounded px-2 py-1 text-xs font-medium ${BADGE[view.status]}`}>
          {view.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Derived from the stage ledger and partner scorecards. Not a star rating, not a
        seller listing, and not a completion date.
      </p>
      <ActionErrorBanner error={error} />
      <ul className="space-y-2 text-sm">
        {view.criteria.map((row) => (
          <li key={row.key} className="flex gap-2">
            <span className={row.met ? "text-emerald-700" : "text-slate-500"}>
              {row.met ? "Met" : "Open"}
            </span>
            <span className="text-slate-800">{row.label}</span>
          </li>
        ))}
      </ul>
      {view.override && (
        <p className="text-xs text-slate-500">
          Last override: {view.override.action.toLowerCase()} — {view.override.reason}
        </p>
      )}
      {view.canCertify && (
        <form
          action={async (formData) => {
            await run(() =>
              certifyChainFreeAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Certify reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Certify chain-free
          </button>
        </form>
      )}
      {view.canMarkIneligible && (
        <form
          action={async (formData) => {
            await run(() =>
              markChainFreeIneligibleAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Ineligible reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
          >
            Mark ineligible
          </button>
        </form>
      )}
      {view.canReset && (
        <form
          action={async (formData) => {
            await run(() =>
              resetChainFreeAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Reset reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Reset certification
          </button>
        </form>
      )}
    </div>
  );
}
```

In `src/app/cockpit/cases/[caseId]/page.tsx` follow the existing server-component pattern (imports at top, work after `caseState` is loaded, JSX before `CaseAdminControls`):

```tsx
import { ChainFreeCertificationPanel } from "@/components/ChainFreeCertificationPanel";
import { advisorCertificationView } from "@/domain/chain-free";
import { canUseChainFree, loadCertification } from "@/server/chain-free";
import { assertCertificationVisible } from "@/server/cockpit-policy";
```

After `const pack = casePack(caseState);` (or immediately before the `return`):

```ts
  assertCertificationVisible("ADVISOR");
  const chainFreeEnabled = canUseChainFree(caseState);
  const chainFree = chainFreeEnabled ? await loadCertification(caseState, now) : null;
  const chainFreeView = chainFree
    ? advisorCertificationView(chainFree.certification)
    : null;
```

In the JSX, immediately above `<CaseAdminControls ...>`:

```tsx
      {chainFreeView && (
        <ChainFreeCertificationPanel caseId={caseId} view={chainFreeView} />
      )}
```

In `src/app/cockpit/panel/page.tsx` replace the subtitle sentence with:

```tsx
        Curated panel scored from the stage ledger. Scorecards unlock chain-free
        certification on a case; hard client SLAs stay off.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/chain-free-policy.test.ts tests/server/cockpit-playbook-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChainFreeCertificationPanel.tsx src/app/cockpit/cases/[caseId]/page.tsx src/app/cockpit/panel/page.tsx tests/server/chain-free-policy.test.ts
git commit -m "feat: show chain-free badge and criteria checklist in the advisor cockpit"
```

---

### Task 7: Client portal status copy (CERTIFIED / IN_PROGRESS only)

**Files:**
- Create: `src/components/ChainFreeStatusCard.tsx`
- Modify: `src/app/portal/cases/[caseId]/page.tsx`
- Create: `tests/server/chain-free-portal.test.ts`

**Interfaces:**
- Consumes: `clientCertificationCopy` from `src/domain/chain-free.ts`; `loadCertification`, `canUseChainFree` from `src/server/chain-free.ts`.
- Produces: `ChainFreeStatusCard` props `{ headline: string; body: string }`. Portal page renders the card only when `clientCertificationCopy(...)` is non-null.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/chain-free-portal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyCertificationOverride,
  CHAIN_FREE_REQUIRED_EVIDENCE,
  assessCertification,
  clientCertificationCopy,
  type PartnerParticipationSignal,
} from "../../src/domain/chain-free";
import { createCase, type CaseState } from "../../src/domain/stage-engine";

function acceptKinds(caseState: CaseState, kinds: readonly string[]): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      acceptedEvidenceKinds: [
        ...new Set([
          ...stage.acceptedEvidenceKinds,
          ...kinds.filter((kind) => stage.requiredEvidenceKinds.includes(kind)),
        ]),
      ],
    })),
  };
}

const signals: PartnerParticipationSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    participatedOnCase: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

describe("portal copy surface", () => {
  it("shows copy only for CERTIFIED and IN_PROGRESS", () => {
    const paid = createCase({
      id: "cfp_p",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(
      clientCertificationCopy(
        assessCertification({ caseState: paid, moduleEnabled: true, partnerSignals: [] }),
      )?.status,
    ).toBe("IN_PROGRESS");

    const certified = applyCertificationOverride(
      acceptKinds(paid, CHAIN_FREE_REQUIRED_EVIDENCE),
      {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: signals,
      },
    );
    expect(
      clientCertificationCopy(
        assessCertification({
          caseState: certified,
          moduleEnabled: true,
          partnerSignals: signals,
        }),
      )?.status,
    ).toBe("CERTIFIED");

    const ineligible = applyCertificationOverride(certified, {
      action: "INELIGIBLE",
      reason: "Household still selling a flat.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
    });
    expect(
      clientCertificationCopy(
        assessCertification({
          caseState: ineligible,
          moduleEnabled: true,
          partnerSignals: signals,
        }),
      ),
    ).toBeNull();
  });

  it("keeps scorecard numbers, partner SLA and guarantee language out of the portal page", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const card = readFileSync(
      path.resolve(process.cwd(), "src/components/ChainFreeStatusCard.tsx"),
      "utf8",
    );
    expect(portal).toContain("ChainFreeStatusCard");
    expect(portal).toContain("clientCertificationCopy");
    expect(portal).not.toContain("qualityScore");
    expect(portal).not.toContain("participationRate");
    expect(portal).not.toContain("advisorCertificationView");
    expect(card).not.toMatch(/slaDays|guarantee|qualityScore/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/chain-free-portal.test.ts`
Expected: FAIL — `ChainFreeStatusCard.tsx` does not exist.

- [ ] **Step 3: Add the card and mount it**

Create `src/components/ChainFreeStatusCard.tsx` (server-safe, no actions):

```tsx
type Props = {
  headline: string;
  body: string;
};

export function ChainFreeStatusCard({ headline, body }: Props) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">{headline}</h2>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
```

In `src/app/portal/cases/[caseId]/page.tsx` import `ChainFreeStatusCard`, `clientCertificationCopy`, `canUseChainFree` and `loadCertification`. After `const pack = casePack(caseState);`:

```ts
  const chainFreeCopy =
    canUseChainFree(caseState)
      ? clientCertificationCopy((await loadCertification(caseState, now)).certification)
      : null;
```

In the JSX, immediately after the paid/free tier line (before `showUpgrade`):

```tsx
      {chainFreeCopy && (
        <ChainFreeStatusCard
          headline={chainFreeCopy.headline}
          body={chainFreeCopy.body}
        />
      )}
```

Do not pass `criteria`, scorecards, referrals, SLA days or due dates into this card.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/chain-free-portal.test.ts tests/server/chain-free-policy.test.ts tests/server/portal-actions.test.ts`
Expected: PASS. The cockpit-wiring test from Task 6 still requires the portal to stay free of `ChainFreeCertificationPanel`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChainFreeStatusCard.tsx src/app/portal/cases/[caseId]/page.tsx tests/server/chain-free-portal.test.ts
git commit -m "feat: show chain-free status copy on the client portal when in progress or certified"
```

---

### Task 8: Light marketing hook (no funnel rebuild)

**Files:**
- Modify: `src/content/marketing.ts`
- Modify: `src/app/(marketing)/page.tsx`
- Modify: `tests/content/marketing-copy.test.ts`

**Interfaces:**
- Consumes: existing `HERO`, `ENTRY_STORIES`, `FORBIDDEN_CLAIM_PATTERNS`, `marketingClaimStrings`, `REGULATORY_DISCLOSURES`.
- Produces: `CHAIN_FREE_HOOK` (`{ eyebrow: string; headline: string; body: string }`), `FORBIDDEN_INVENTORY_PATTERNS`. Removes `/chain[- ]free/i` from `FORBIDDEN_CLAIM_PATTERNS`. Softens the two "nine-stage" strings so the tenth overlay stage does not make the homepage a lie.

Do not add routes, stories, pricing cards or a new acquisition funnel. One optional section on the existing homepage.

- [ ] **Step 1: Write the failing tests**

Add to `tests/content/marketing-copy.test.ts`:

```ts
import {
  CHAIN_FREE_HOOK,
  FORBIDDEN_INVENTORY_PATTERNS,
} from "../../src/content/marketing";

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
```

Also extend the existing `never advertises paid-only...` / claim loop is enough once `marketingClaimStrings()` includes the hook. Change the two stale counts in `src/content/marketing.ts` as part of Step 3; no extra test is required beyond the existing "England & Wales" presence check.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/marketing-copy.test.ts`
Expected: FAIL — `CHAIN_FREE_HOOK` is not exported.

- [ ] **Step 3: Add hook copy and the homepage section**

In `src/content/marketing.ts`:

1. Remove `/chain[- ]free/i` from `FORBIDDEN_CLAIM_PATTERNS`. Keep `/guarantee/i`, `/guaranteed/i`, `/mortgage advice/i`, `/we advise/i`, `/rightmove/i`, `/zoopla/i`.
2. Add:

```ts
export const FORBIDDEN_INVENTORY_PATTERNS: RegExp[] = [
  /seller[- ]side/i,
  /private seller/i,
  /listing feed/i,
  /onward chain inventory/i,
  /introduc(?:e|tion) .{0,40}seller/i,
];

export const CHAIN_FREE_HOOK = {
  eyebrow: "Beachhead, not the product",
  headline: "Chain-free buyers use the same engine.",
  body: "Paid orchestration certifies a household as chain-free from the stage ledger — not from star ratings, and not from a seller inventory. UK-resident speed-seekers enter the same way. We do not introduce buyers to sellers for a fee.",
};
```

3. Include the three hook strings at the end of `marketingClaimStrings()` so guarantee / Rightmove guards still apply.
4. Replace `"The full nine-stage purchase map for England & Wales"` with `"The full purchase stage map for England & Wales"`.
5. Replace `"The same nine-stage ledger, without the currency and shipping steps"` with `"The same stage ledger, without the currency and shipping steps"`.

In `src/app/(marketing)/page.tsx` import `CHAIN_FREE_HOOK` and add this section after the hero CTAs and before "Where are you starting from?":

```tsx
      <section className="mt-16 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {CHAIN_FREE_HOOK.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {CHAIN_FREE_HOOK.headline}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{CHAIN_FREE_HOOK.body}</p>
      </section>
```

Do not touch `/start`, `/pricing`, stories, or `docs/playbooks/diaspora-outreach-checklist.md`. Outreach is still forbidden from guarantee / Rightmove claims via the existing `FORBIDDEN_CLAIM_PATTERNS` import; it may now mention chain-free and that is acceptable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/content/marketing-copy.test.ts tests/content/outreach-checklist.test.ts tests/lib/marketing-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/marketing.ts src/app/(marketing)/page.tsx tests/content/marketing-copy.test.ts
git commit -m "feat: add a chain-free beachhead hook without rebuilding the acquisition funnel"
```

---

### Task 9: Demo script and README

**Files:**
- Create: `docs/superpowers/plans/demo-script-chain-free.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md`
- Modify: `docs/superpowers/plans/demo-script-speed-rails.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the shipped overlay from Tasks 1–8; seed logins already in `README.md` (`advisor@example.com`, `client@example.com`, password `password`); `/cockpit/market-packs`, `/cockpit/cases`, `/portal/cases`, `/`.
- Produces: a founder walkthrough that proves buyer-side certification, the matching stage, flag split (`ew` on / `au` off / `hard_client_sla` off), and the explicit non-goals.

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-chain-free.md`:

````md
# Chain-free overlay demo script

Founder validation script for the **buyer-side certification overlay, not a seller inventory** thesis: England & Wales cases can be certified chain-free from the stage ledger and partner scorecards; clients see status copy without numbers or dates; marketing may say chain-free; we still do not list sellers or promise a completion day.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. Re-seed is required so new E&W cases pick up the `chain_free_matching` stage. All logins use password `password`.

---

## 1. The module is on for ew, and it is still not a hard SLA

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew · England & Wales`**. Under **Modules**, confirm `fx_deposit`, `partner_speed_rails` and `chain_free_inventory` are **on**; `hard_client_sla` is **off**.
3. The stage table now lists **Chain-free position** (`chain_free_matching`) between **Search readiness** and **Offer → instruct**, SLA 7 days, evidence `chain_free_position`.
4. Select the **`au`** stub. Confirm `chain_free_inventory` and `hard_client_sla` are **off**. The stub still has no matching stage.
5. `chain_free_inventory` being on means the buyer overlay exists as pack data. It does **not** mean we hold seller stock or that any date is guaranteed.

## 2. A new paid case carries the matching stage

1. `/cockpit/cases` → **Bloggs return (paid)** (re-seeded). Confirm the timeline includes **Chain-free position** after **Search readiness**.
2. Open **Smith DIY journey**. The stage is visible on the map (`freeVisible`) but there is no self-advance and no certification checklist on the portal. Free stays `NOT_ASSESSED` because paid orchestration is a criterion.
3. Entry context **UK resident — speed seeker** uses the same stage title and the same evidence kind. No FX or vehicle steps appear on it.

## 3. Scorecards unlock the badge — they do not print stars

1. Still as advisor on **Bloggs return (paid)**. Scroll to **Chain-free certification**.
2. Badge starts **IN PROGRESS** once the case is paid. Checklist shows three gates: paid tier (met), partner participation (open until a warm intro / evidence lands), evidence complete (open until `source_of_funds`, `dip_aip` and `buyer_ready` are accepted).
3. **Certify chain-free** is disabled or refused until every gate is green. Typing a short reason fails with the domain message.
4. Drive the ledger, using the existing Plan 1–3 motions:
   - Accept `profile_complete` → advance.
   - Accept `source_of_funds` (and `fx_plan` on this returner case) → advance.
   - Warm-intro Priya Nair on `mortgage_path`. As `mortgage@example.com`, submit `dip_aip`. As advisor, accept it.
   - Advance through move + search until `buyer_ready` is accepted.
5. Checklist: partner participation met (referral + `EVIDENCE_SUBMITTED` or a WATCH/STRONG scorecard), evidence complete met. Status is still **IN PROGRESS** — rules never auto-certify.
6. **Certify chain-free** with reason `Ledger gates green; no onward chain.` Badge becomes **CERTIFIED**. The event is on the case ledger.

## 4. The client sees copy, not numbers

1. Sign in as **`client@example.com`** → the Bloggs case.
2. A card reads **Certified chain-free buyer** and says the status is not a completion date.
3. Confirm what is absent: no quality score, no participation rate, no partner SLA days, no criterion checklist, no playbook prose, no promised date.

## 5. Ineligible and reset stay on the cockpit

1. Back as advisor. **Mark ineligible** with reason `Household still selling a flat.` Badge becomes **INELIGIBLE**. The portal card disappears.
2. **Reset certification** with reason `Sale completed; re-check the ledger.` Status returns to **IN PROGRESS** (rules still green). Certify again if you want the badge back.

## 6. Marketing may say chain-free

1. Sign out → `/`.
2. The homepage has a short **Beachhead, not the product** section. It names chain-free buyers and paid orchestration, and it does not mention listings, a seller introduction, or a guarantee.
3. `/start` and `/pricing` are unchanged. This is not a new funnel.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `ChainFreeCertification` derived from ledger + scorecard signals; advisor override events; `chain_free_matching` stage + playbook on `ew`; cockpit checklist; portal status copy; `chain_free_inventory: true` on `ew` |
| **Stubbed** | Nothing new. Partner adapters and the inbound webhook stay Plan 5 stubs. |
| **Absent** | Seller listings / inventory, private seller–buyer introductions, agent or developer lead fees, Rightmove/Zoopla, hard client SLAs, guaranteed completion dates, AU/US corridor content, document vault, open marketplace |

---

## Automated verification

```bash
npm test -- tests/domain/chain-free.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/ew-playbook.test.ts tests/server/chain-free-policy.test.ts tests/server/chain-free-actions.test.ts tests/server/chain-free-portal.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
````

- [ ] **Step 2: Point the older demos and README at the new flag**

In `docs/superpowers/plans/demo-script-market-packs.md` section 1 step 4, replace the modules sentence with:

```md
4. Modules: `fx_deposit`, `partner_speed_rails` and `chain_free_inventory` are **on**. `hard_client_sla`, `corridor_inbound`, `corridor_outbound` and `document_vault` are **off**. `chain_free_inventory` is buyer-side overlay data, not seller stock; `hard_client_sla` staying off is the rest of the spec §9 rule.
```

In the same file, change "the nine E&W stages" to "the E&W stages (canonical spine plus chain-free position when the module is on)".

In `docs/superpowers/plans/demo-script-speed-rails.md` section 1 steps 2–3, say `chain_free_inventory` is **on** for `ew` and **off** for `au`; `hard_client_sla` is **off** in both. In the Absent row, remove "chain-free inventory" and keep "hard client SLAs, and any client-facing guaranteed date". Add: "Chain-free certification is Plan 6 — a buyer overlay, not a vendor rail."

In `README.md`:

1. Market-packs table: change `ew-stages.ts` responsibility from "the nine stage templates" to "the canonical stage templates plus optional `chain_free_matching` when `chain_free_inventory` is on".
2. Replace the module-toggles paragraph with:

```md
**Module toggles are data, not scattered ifs.** `MarketFlags` on the pack are read through
`isModuleEnabled`. The `ew` pack runs `fx_deposit`, `partner_speed_rails` and
`chain_free_inventory`; `hard_client_sla`, `corridor_inbound`, `corridor_outbound` and
`document_vault` stay **off** in every pack. `chain_free_inventory` is a buyer-side
certification overlay (see below), not seller listings and not a promised date.
Enforced by `tests/domain/market-pack-flags.test.ts`.
```

3. Add this section immediately after the Market packs section (before "Advisor operating IP"):

```md
## Chain-free overlay (buyer-side, post-proof)

Spec §13 sub-project 6. After the stage engine and partner scorecards shipped, `ew`
may turn `chain_free_inventory` on as **data**. That flag unlocks:

- `ChainFreeCertification` on a case — `NOT_ASSESSED` / `IN_PROGRESS` / `CERTIFIED` /
  `INELIGIBLE` — derived from paid tier, partner participation / scorecard signals, and
  accepted `source_of_funds` + `dip_aip` + `buyer_ready`. Advisors may certify, mark
  ineligible, or reset with a written reason; each write is a ledger event.
- A `chain_free_matching` stage between search and offer (title **Chain-free position**).
  Same engine for `UK_RESIDENT_SPEED`. Not a parallel track.
- Cockpit checklist (operating IP). Portal copy only when `CERTIFIED` or `IN_PROGRESS`.
- A homepage hook. Paid orchestration remains the product.

**Not in this overlay:** seller inventory, private seller–buyer introductions, agent or
developer lead fees, hard client SLAs, Rightmove/Zoopla, an open marketplace.

Walkthrough: [`docs/superpowers/plans/demo-script-chain-free.md`](docs/superpowers/plans/demo-script-chain-free.md).
```

- [ ] **Step 3: Full verification**

Run: `npm test`
Expected: PASS, no failing files. Confirm specifically that `tests/domain/market-pack-flags.test.ts`, `tests/domain/ew-pack.test.ts`, `tests/domain/ew-playbook.test.ts`, `tests/lib/case-pack.test.ts`, `tests/content/marketing-copy.test.ts`, `tests/domain/engine-country-agnostic.test.ts`, `tests/server/warm-intro.test.ts` and `tests/server/scorecards.test.ts` are green — those are the regression surfaces this plan edits or sits next to.

Run: `npm run build`
Expected: `✓ Compiled successfully` with no TypeScript errors.

Run: `npm run db:push && npm run db:seed`
Expected: both exit 0. Seeded E&W cases now include `chain_free_matching`.

- [ ] **Step 4: Manual smoke check**

`npm run dev`, then walk sections 1–6 of `docs/superpowers/plans/demo-script-chain-free.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/demo-script-chain-free.md docs/superpowers/plans/demo-script-market-packs.md docs/superpowers/plans/demo-script-speed-rails.md README.md
git commit -m "docs: chain-free overlay demo script and README buyer-side positioning"
```

---

## Self-review notes

**Spec coverage:**
- §1 beachhead vs product / paid orchestration is what we sell → Task 8 hook + Global Constraints; certification never becomes the homepage primary CTA.
- §1 / §4 UK-resident speed-seekers use the same engine → Task 1 shared assessor; Task 3 same matching stage without FX/vehicle evidence.
- §5 IP behind paid / free is a funnel → Task 1 `paid_tier` criterion; Task 6 checklist on cockpit only; Task 7 portal copy only for `CERTIFIED` / `IN_PROGRESS` (free cannot reach those).
- §7 buyer-side orchestrator, no private seller–buyer intro → Task 3 playbook estate-agency guard; Task 8 `FORBIDDEN_INVENTORY_PATTERNS`.
- §8 partner scorecard derived from the ledger → Task 1 consumes `ScorecardRating` / participation, never a star field.
- §9 dependency rule → Task 2 turns `chain_free_inventory` on for `ew` only after Plans 1–3; `hard_client_sla` stays in `GATED_MODULES`.
- §9 Phase 3/4 "verified chain-free certification/matching" without seller views or agent/developer leads → Tasks 1–7; those monetisation lines stay non-goals.
- §13 sub-project 6 goals 1–8 → Task 1 (goals 1, 3), Task 3 (goal 2), Tasks 5–6 (goal 4), Task 7 (goal 5), Task 8 (goal 6), Task 2 (goal 7), Task 9 (goal 8).

**Non-goals honoured:** no seller listings or inventory product, no hard client-facing SLA or completion date, no Rightmove/Zoopla, no open marketplace, no document vault, no AU/US corridor journeys (the `au` stub only proves the flag is off), no rewrite of Plans 1–5 except flag/tests/copy the overlay requires.

**Placeholder scan:** no TBD / TODO / "implement later" / "similar to Task N". Every new export is named in Task 1 or Task 4 Interfaces and reused with the same spelling later.

**Type-consistency ledger:** `ChainFreeStatus` is the four-value union from Task 1; cockpit badge and portal copy use that union only. Event types are `CHAIN_FREE_CERTIFIED` / `CHAIN_FREE_MARKED_INELIGIBLE` / `CHAIN_FREE_RESET` with payload `{ action, reason }`. Stage key is `chain_free_matching` (already referenced by pack tests); display title is `Chain-free position`. `LoadedCertification` is the only server DTO and is created in the same task as `loadCertification`. Actions take `(caseId, reason)` and return `{ ok: true } | { ok: false; error: string }`.

**Existing tests that must change, and why:** `ew-pack` nine-key snapshot and null playbook (the stage becomes real); `ew-playbook` unknown-key example (use `not_a_real_stage`); `market-pack-flags` gated list (remove `chain_free_inventory`); inspector module row; `case-pack` fallback (keep SLA 7, add a true unknown key); marketing `FORBIDDEN_CLAIM_PATTERNS` (allow the words, forbid inventory). `warm-intro` and scorecard tests are not edited.

**Deliberate non-migration:** cases persisted before this plan keep their original stage list until re-seed. `createCase` is the only factory that picks up the new template. YAGNI — no `ensureOverlayStages` helper.
