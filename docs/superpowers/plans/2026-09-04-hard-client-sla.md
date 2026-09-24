# Hard Client SLA Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `hard_client_sla` on for England & Wales only as data: advisors publish, amend, or withdraw a **target** completion date reconstructed from ledger events, always attached to legal carve-outs. The client portal shows that date only when published. Copy says *target* / *working toward* / *subject to carve-outs* — never a marketing guarantee or Rightmove-style promise.

**Architecture:** Four layers, no cycles. Same overlay shape as chain-free.

1. **Pure domain** (`src/domain/client-sla.ts`) — commitment states, carve-out boilerplate, eligibility from ledger + scorecards, publish / amend / withdraw events, client copy, advisor view. No Prisma, no Next.js, no jurisdiction literals.
2. **Market-local data** (`ew-config` flag only) — `hard_client_sla: true` on `ew`. Corridor packs and the `au` stub stay off. No new stage and no playbook insert.
3. **Policy + load** (`src/server/client-sla.ts`, `src/server/cockpit-policy.ts`) — fail-closed flag gate; assemble scorecard signals; run `assessClientSla`.
4. **Surfaces** — cockpit publish panel (operating IP); portal read-only target date card when a live commitment exists; a homepage hook that names targets and carve-outs without promising a completion day.

**The invariant that makes this an overlay and not a guarantee product:** a commitment is derived from `CaseState.events` plus live eligibility. Advisor publish is an audit event, never a Prisma column and never a star rating. Portal copy is a published **target**, subject to carve-outs. Free DIY never becomes eligible because `paid_tier` is unmet, so free never sees a date card or the publish controls.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§2 hard completion guarantees are a v1 non-goal and remain forbidden in copy; §5 later promise of published target timelines then hard dates with legal disclaimers; §7 hard guarantees only after legal review of carve-outs; §9 Phase 1 soft timelines / Phase 2 optional hard guarantees / dependency rule; §10 country-agnostic engine).

**Builds on (already shipped, do not rebuild):**
- Plan 1 — `src/domain/stage-engine.ts` (`CaseState`, evidence accept/advance, `events: Array<{ type, stageKey, actorRole, at, payload? }>`).
- Plan 2 — `src/content/marketing.ts` (`FORBIDDEN_CLAIM_PATTERNS` already forbids `guarantee` / `rightmove` / `zoopla`; `REGULATORY_DISCLOSURES` already calls portal dates planning targets).
- Plan 3 — `src/domain/scorecard.ts` (`ScorecardRating`), `src/server/scorecards.ts`, `src/server/referrals.ts`.
- Plan 4 — `MarketPack` / `isModuleEnabled` / `hard_client_sla` key / `tests/domain/market-pack-flags.test.ts` (currently gates the flag off everywhere).
- Plan 5 — `partner_speed_rails` on for `ew` only. Leave that flag untouched.
- Plan 6 — chain-free overlay pattern (`src/domain/chain-free.ts` → server policy → actions → cockpit panel / portal card). Do not import chain-free into client-sla; copy the layering, not the types.
- Plan 7 — corridor packs; `hard_client_sla` stays off on `au_uk` / `uk_au` / `us_uk` / `uk_us`.
- Plan 8 — document vault on for `ew` only. Leave `document_vault` untouched.

**Follow-on plans (not this plan):** seller milestone views, threads, open marketplace, corridor packs as a product rewrite, `document_vault` on corridors, S3, FCA Appointed Representative status, enabling the `au` stub as a domestic Australia product.

**Current main:** `f4b70e5` — 345 tests. `hard_client_sla` is the last globally gated module in `tests/domain/market-pack-flags.test.ts`.

## Global Constraints

Copied from the spec and the Plan 9 brief. Every task's requirements implicitly include this section.

- **Targets, not guarantees:** §2 lists hard completion guarantees as a v1 non-goal. §5/§9 allow published target timelines with legal carve-outs after ledger proof. Portal and marketing copy must say *target* / *working toward* / *subject to carve-outs*. Never write "guaranteed completion", "we guarantee", or a Rightmove-style "complete in N days" claim. Existing `FORBIDDEN_CLAIM_PATTERNS` (`/guarantee/i`, `/rightmove/i`, `/zoopla/i`) stay in force.
- **Published only:** the client sees a committed target only after an advisor publishes. Unpublished, withdrawn, and free-DIY cases render no date card.
- **Freemium / IP:** §5. Eligibility checklist, scorecard gates, and publish / amend / withdraw controls are advisor-only operating IP. Free DIY never meets `paid_tier`, so it never receives a live commitment and never sees that IP on the portal.
- **Carve-outs always attach:** every live commitment carries the full standard carve-out list (lender / finance-provider delay, survey or inspection defects, title or tenure document pack delay, client inaction, events outside the pipeline). Advisors do not pick and choose. Domain labels stay country-agnostic — do not write `leasehold`, `England`, or `Wales` in `client-sla.ts`.
- **Dependency rule, now complete:** §9 "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real." Plans 1–8 satisfied the dependency. This plan turns `hard_client_sla` **on for `ew` only as data**. `chain_free_inventory` and `partner_speed_rails` stay on for `ew` and off everywhere else — do not edit those flags.
- **Fail closed:** overlay is off unless the case's resolved pack enables `hard_client_sla`. Unknown or disabled packs still throw `MarketPackError` at `casePack`; policy treats that as off.
- **No Prisma column:** reconstruct the commitment from `CaseState.events`. Do not add a `clientSlaStatus` or `targetDate` field to `schema.prisma`. `StageEvent.payload` already stores optional strings.
- **No new stage:** unlike chain-free, do not insert a stage or playbook. The SLA rides on the existing linear engine.
- **Country-agnostic domain:** no jurisdiction literals (`£`, `GBP`, `en-GB`, `england`, `wales`) in `src/domain/client-sla.ts` or `src/server/client-sla.ts`. Local names stay in market packs and brand copy.
- **Corridor / au stay off:** do not enable `hard_client_sla` on `au`, `au_uk`, `uk_au`, `us_uk`, or `uk_us`.
- **Engineering:** TDD per task; pure domain imports no framework / Next / Prisma / chain-free / vault; server actions keep `{ ok: true } | { ok: false; error: string }`; existing tests keep passing (`npm test`); `npm run build` passes at the end; DRY, YAGNI.

## Locked design decisions

**Flag matrix (final, after Task 2):**

| Pack | enabled | fx_deposit | corridor_inbound | corridor_outbound | partner_speed_rails | chain_free_inventory | hard_client_sla | document_vault |
|---|---|---|---|---|---|---|---|---|
| `au` | false | off | off | off | off | off | off | off |
| `ew` | true | on | off | off | on | on | **on** | on |
| `au_uk` | true | on | on | on | off | off | off | off |
| `uk_au` | true | on | on | on | off | off | off | off |
| `us_uk` | true | on | on | on | off | off | off | off |
| `uk_us` | true | on | on | on | off | off | off | off |

**Commitment states:** `UNPUBLISHED` | `PUBLISHED` | `AMENDED` | `WITHDRAWN`. Module off forces `UNPUBLISHED` and hides client copy even if stale events exist.

**Eligibility to publish (all must be met):**
- `paid_tier` — `caseState.tier === "PAID_DWY"`
- `partner_scorecard` — at least one active partner referral whose scorecard is `STRONG`, `WATCH`, or `participationRate >= 0.5`
- `ledger_started` — at least one accepted evidence kind on the case

Rules never auto-publish. An advisor action writes the event.

**Events:** `CLIENT_SLA_PUBLISHED` / `CLIENT_SLA_AMENDED` / `CLIENT_SLA_WITHDRAWN` with payload `{ action, targetDate, reason }`. `targetDate` is a calendar day `YYYY-MM-DD` (not a timestamp). Withdraw stores `targetDate: null`.

**Date rules:** publish and amend require a real calendar date on or after UTC today (`now.toISOString().slice(0, 10)`). Domain copy prints that ISO date — no `en-GB` formatting in the domain module.

**Re-publish after withdraw:** allowed when eligibility still holds; status returns to `PUBLISHED`.

**Past published dates:** a live commitment whose date is now in the past stays `PUBLISHED` or `AMENDED` until the advisor amends or withdraws. Do not auto-withdraw.

## File structure (locked)

```
src/
  domain/
    client-sla.ts                              # NEW (Task 1): states, carve-outs, assess, apply, copy
    market-packs/
      ew-config.ts                             # MODIFY (Task 2): hard_client_sla: true
  server/
    client-sla.ts                              # NEW (Task 3): canUse / assert / load / perform
    cockpit-policy.ts                          # MODIFY (Task 3): assertClientSlaVisible
  app/
    actions/
      client-sla.ts                            # NEW (Task 4): publish / amend / withdraw
    cockpit/cases/[caseId]/page.tsx            # MODIFY (Task 5): render publish panel
    cockpit/panel/page.tsx                     # MODIFY (Task 5): scorecards unlock published targets
    portal/cases/[caseId]/page.tsx             # MODIFY (Task 6): target card when copy exists
    (marketing)/page.tsx                       # MODIFY (Task 7): targets-not-promises hook
  components/
    ClientSlaPublishPanel.tsx                  # NEW (Task 5): advisor badge + criteria + forms
    ClientSlaTargetCard.tsx                    # NEW (Task 6): client date + carve-outs
  content/
    marketing.ts                               # MODIFY (Task 7): CLIENT_SLA_HOOK; keep guarantee forbidden
tests/
  domain/client-sla.test.ts                    # NEW (Task 1)
  domain/engine-country-agnostic.test.ts       # MODIFY (Task 1): add client-sla.ts
  domain/market-pack-flags.test.ts             # MODIFY (Task 2): ew-only on; GATED_MODULES emptied
  domain/market-pack-inspector.test.ts         # MODIFY (Task 2): module row true for ew
  domain/ew-pack.test.ts                       # MODIFY (Task 2): flags snapshot
  domain/uk-au-pack.test.ts                    # MODIFY (Task 2): explicit off
  server/client-sla-policy.test.ts             # NEW (Task 3)
  server/client-sla-actions.test.ts            # NEW (Task 4)
  server/client-sla-portal.test.ts             # NEW (Task 6)
  content/marketing-copy.test.ts               # MODIFY (Task 7)
docs/
  superpowers/plans/demo-script-client-sla.md  # NEW (Task 8)
  superpowers/plans/demo-script-*.md           # MODIFY (Task 8): flag now on for ew
README.md                                      # MODIFY (Task 9)
```

**Layering rule:** `src/domain/client-sla.ts` imports only `./stage-engine`, `./types` and `./scorecard` (type `ScorecardRating`). It must not import market packs, Prisma, Next, chain-free, or vault. `src/server/client-sla.ts` is the only module that combines referrals, scorecards and the domain assessor. Actions never call `assessClientSla` without going through `loadClientSla` or a test-injected signal list.

---

### Task 1: Commitment vocabulary, carve-outs, publish events and copy

**Files:**
- Create: `src/domain/client-sla.ts`
- Create: `tests/domain/client-sla.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/domain/client-sla.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `CaseState`, `getFocusStage` from `src/domain/stage-engine.ts`; `ActorRole`, `isPartnerActorRole` from `src/domain/types.ts`; `ScorecardRating` from `src/domain/scorecard.ts`.
- Produces: `ClientSlaStatus`, `CLIENT_SLA_STATUSES`, `isClientSlaStatus`, `ClientSlaCriterionKey`, `CLIENT_SLA_CRITERION_KEYS`, `ClientSlaCarveOutKey`, `CLIENT_SLA_CARVE_OUT_KEYS`, `CLIENT_SLA_CARVE_OUTS`, `CLIENT_SLA_EVENT_TYPES`, `ClientSlaAction`, `CLIENT_SLA_ACTIONS`, `MIN_CLIENT_SLA_REASON_LENGTH`, `SlaScorecardSignal`, `ClientSlaCriterion`, `ClientSlaCarveOut`, `ClientSlaPublication`, `ClientSlaEventPayload`, `ClientSlaCommitment`, `ClientSlaTargetCopy`, `AdvisorSlaView`, `ClientSlaError`, `encodeClientSlaPayload`, `decodeClientSlaPayload`, `isIsoCalendarDate`, `acceptedEvidenceKinds`, `partnerSlaMet`, `evaluateSlaCriteria`, `slaSignalsFrom`, `assessClientSla`, `applyClientSlaAction`, `clientSlaTargetCopy`, `advisorSlaView`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/client-sla.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import type { CaseState } from "../../src/domain/stage-engine";
import {
  acceptedEvidenceKinds,
  advisorSlaView,
  applyClientSlaAction,
  assessClientSla,
  CLIENT_SLA_CARVE_OUTS,
  ClientSlaError,
  clientSlaTargetCopy,
  decodeClientSlaPayload,
  encodeClientSlaPayload,
  evaluateSlaCriteria,
  isIsoCalendarDate,
  partnerSlaMet,
  slaSignalsFrom,
  type SlaScorecardSignal,
} from "../../src/domain/client-sla";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const TARGET = "2026-12-15";

function paidUk(id = "sla1"): CaseState {
  return createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
    now: NOW,
  });
}

function acceptAny(caseState: CaseState): CaseState {
  const kind = caseState.stages[0]?.requiredEvidenceKinds[0];
  if (!kind) {
    return caseState;
  }
  return {
    ...caseState,
    stages: caseState.stages.map((stage, index) =>
      index === 0
        ? { ...stage, acceptedEvidenceKinds: [...stage.acceptedEvidenceKinds, kind] }
        : stage,
    ),
  };
}

function scorecard(): SlaScorecardSignal[] {
  return [
    {
      partnerId: "p_mortgage",
      roleType: "MORTGAGE_PARTNER",
      hasReferral: true,
      scorecardRating: "STRONG",
      participationRate: 0.8,
    },
  ];
}

function eligibleCase(): CaseState {
  return acceptAny(paidUk("sla_ok"));
}

function publish(caseState: CaseState, targetDate = TARGET): CaseState {
  return applyClientSlaAction(caseState, {
    action: "PUBLISH",
    targetDate,
    reason: "Ledger is live; partner scorecard supports a target.",
    actorRole: "ADVISOR",
    moduleEnabled: true,
    partnerSignals: scorecard(),
    now: NOW,
  });
}

describe("criteria from the ledger, not a marketing promise", () => {
  it("requires paid tier, a partner scorecard signal, and accepted ledger evidence", () => {
    const free = createCase({
      id: "sla_free",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
      now: NOW,
    });
    const unpaid = evaluateSlaCriteria({ caseState: free, partnerSignals: scorecard() });
    expect(unpaid.find((c) => c.key === "paid_tier")?.met).toBe(false);

    const noPartner = evaluateSlaCriteria({ caseState: paidUk(), partnerSignals: [] });
    expect(noPartner.find((c) => c.key === "partner_scorecard")?.met).toBe(false);

    const watchCounts = evaluateSlaCriteria({
      caseState: paidUk(),
      partnerSignals: [
        {
          partnerId: "p2",
          roleType: "CONVEYANCER",
          hasReferral: true,
          scorecardRating: "WATCH",
          participationRate: 0.2,
        },
      ],
    });
    expect(watchCounts.find((c) => c.key === "partner_scorecard")?.met).toBe(true);

    const missingLedger = evaluateSlaCriteria({
      caseState: paidUk(),
      partnerSignals: scorecard(),
    });
    expect(missingLedger.find((c) => c.key === "ledger_started")?.met).toBe(false);

    const ready = evaluateSlaCriteria({
      caseState: eligibleCase(),
      partnerSignals: scorecard(),
    });
    expect(ready.every((c) => c.met)).toBe(true);
    expect(acceptedEvidenceKinds(eligibleCase()).length).toBeGreaterThan(0);
  });

  it("treats a superseded referral as no signal and ignores client-role rows", () => {
    const signals = slaSignalsFrom({
      referrals: [
        { partnerId: "old", partnerRole: "MORTGAGE_PARTNER", supersededAt: "2026-09-03T00:00:00.000Z" },
        { partnerId: "new", partnerRole: "MORTGAGE_PARTNER", supersededAt: null },
        { partnerId: "clientish", partnerRole: "CLIENT", supersededAt: null },
      ],
      scorecards: [{ partnerId: "new", rating: "NO_DATA", participationRate: 0.6 }],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.partnerId).toBe("new");
    expect(partnerSlaMet(signals)).toBe(true);
  });
});

describe("assessClientSla", () => {
  it("stays UNPUBLISHED when the module is off, even if every criterion is green", () => {
    const commitment = assessClientSla({
      caseState: eligibleCase(),
      moduleEnabled: false,
      partnerSignals: scorecard(),
    });
    expect(commitment.status).toBe("UNPUBLISHED");
    expect(commitment.moduleEnabled).toBe(false);
    expect(commitment.eligibleByRules).toBe(false);
    expect(commitment.publication).toBeNull();
    expect(clientSlaTargetCopy(commitment)).toBeNull();
  });

  it("stays UNPUBLISHED until an advisor publishes, then AMENDED, then WITHDRAWN", () => {
    const unpublished = assessClientSla({
      caseState: eligibleCase(),
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(unpublished.status).toBe("UNPUBLISHED");
    expect(unpublished.eligibleByRules).toBe(true);
    expect(clientSlaTargetCopy(unpublished)).toBeNull();

    const published = publish(eligibleCase());
    const live = assessClientSla({
      caseState: published,
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(live.status).toBe("PUBLISHED");
    expect(live.publication?.targetDate).toBe(TARGET);
    expect(live.carveOuts).toEqual(CLIENT_SLA_CARVE_OUTS);

    const amended = applyClientSlaAction(published, {
      action: "AMEND",
      targetDate: "2027-01-20",
      reason: "Survey booked later than first assumed.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: scorecard(),
      now: NOW,
    });
    expect(
      assessClientSla({
        caseState: amended,
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }).status,
    ).toBe("AMENDED");

    const withdrawn = applyClientSlaAction(amended, {
      action: "WITHDRAW",
      targetDate: null,
      reason: "Client paused the purchase.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: scorecard(),
      now: NOW,
    });
    const after = assessClientSla({
      caseState: withdrawn,
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(after.status).toBe("WITHDRAWN");
    expect(after.publication?.targetDate).toBeNull();
    expect(clientSlaTargetCopy(after)).toBeNull();
  });
});

describe("applyClientSlaAction", () => {
  it("refuses clients, short reasons, a closed module, unpaid cases, and bad dates", () => {
    const ready = eligibleCase();
    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "CLIENT",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/advisor/i);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "short",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/reason/i);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "ADVISOR",
        moduleEnabled: false,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/not enabled/i);

    expect(() =>
      applyClientSlaAction(paidUk(), {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "I just like a date.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: [],
        now: NOW,
      }),
    ).toThrow(/eligib/i);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: "2026-13-40",
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(ClientSlaError);

    expect(() =>
      applyClientSlaAction(ready, {
        action: "PUBLISH",
        targetDate: "2026-01-01",
        reason: "Ledger is live; partner scorecard supports a target.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/past|date/i);
  });

  it("refuses a second publish, amend/withdraw with nothing live, then allows re-publish after withdraw", () => {
    const live = publish(eligibleCase());
    expect(() => publish(live)).toThrow(/already published/i);

    expect(() =>
      applyClientSlaAction(eligibleCase(), {
        action: "AMEND",
        targetDate: "2027-01-20",
        reason: "Survey booked later than first assumed.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/nothing to amend/i);

    expect(() =>
      applyClientSlaAction(eligibleCase(), {
        action: "WITHDRAW",
        targetDate: null,
        reason: "Client paused the purchase.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: scorecard(),
        now: NOW,
      }),
    ).toThrow(/nothing to withdraw/i);

    const withdrawn = applyClientSlaAction(live, {
      action: "WITHDRAW",
      targetDate: null,
      reason: "Client paused the purchase.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: scorecard(),
      now: NOW,
    });
    const again = publish(withdrawn, "2027-02-01");
    expect(
      assessClientSla({
        caseState: again,
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }).status,
    ).toBe("PUBLISHED");
  });

  it("round-trips the payload codec and ignores bare strings", () => {
    const encoded = encodeClientSlaPayload({
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "ok enough",
    });
    expect(decodeClientSlaPayload(encoded)).toEqual({
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "ok enough",
    });
    expect(decodeClientSlaPayload("dip_aip")).toBeNull();
    expect(decodeClientSlaPayload(undefined)).toBeNull();
    expect(isIsoCalendarDate(TARGET)).toBe(true);
    expect(isIsoCalendarDate("2026-02-31")).toBe(false);
    expect(isIsoCalendarDate("15/12/2026")).toBe(false);
  });
});

describe("client copy is a target with carve-outs, never a guarantee", () => {
  it("uses target / working toward / subject to carve-outs and omits guarantee language", () => {
    const copy = clientSlaTargetCopy(
      assessClientSla({
        caseState: publish(eligibleCase()),
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }),
    );
    expect(copy?.status).toBe("PUBLISHED");
    expect(copy?.targetDate).toBe(TARGET);
    expect(copy?.headline).toMatch(/target/i);
    expect(copy?.body).toMatch(/working toward/i);
    expect(copy?.body).toMatch(/subject to.{0,20}carve-outs/i);
    expect(copy?.carveOuts).toHaveLength(CLIENT_SLA_CARVE_OUTS.length);
    const blob = JSON.stringify(copy);
    expect(blob).not.toMatch(/guarante/i);
    expect(blob).not.toMatch(/qualityScore|participationRate|slaDays/i);
    expect(blob).not.toMatch(/england|wales|leasehold/i);
  });

  it("hides copy from free DIY even if a stale publish event is present", () => {
    const published = publish(eligibleCase());
    const asFree = { ...published, tier: "FREE_DIY" as const };
    const commitment = assessClientSla({
      caseState: asFree,
      moduleEnabled: true,
      partnerSignals: scorecard(),
    });
    expect(clientSlaTargetCopy(commitment)).toBeNull();
  });
});

describe("advisor view is operating IP", () => {
  it("exposes criteria and action gates without auto-publishing", () => {
    const unpublished = advisorSlaView(
      assessClientSla({
        caseState: eligibleCase(),
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }),
    );
    expect(unpublished.canPublish).toBe(true);
    expect(unpublished.canAmend).toBe(false);
    expect(unpublished.canWithdraw).toBe(false);
    expect(unpublished.criteria.every((c) => c.met)).toBe(true);

    const live = advisorSlaView(
      assessClientSla({
        caseState: publish(eligibleCase()),
        moduleEnabled: true,
        partnerSignals: scorecard(),
      }),
    );
    expect(live.canPublish).toBe(false);
    expect(live.canAmend).toBe(true);
    expect(live.canWithdraw).toBe(true);
    expect(live.publication?.targetDate).toBe(TARGET);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/client-sla.test.ts`
Expected: FAIL with `Cannot find module '../../src/domain/client-sla'` (or the first import error).

- [ ] **Step 3: Write the domain module**

Create `src/domain/client-sla.ts`:

```ts
import { getFocusStage, type CaseState } from "./stage-engine";
import type { ScorecardRating } from "./scorecard";
import { isPartnerActorRole, type ActorRole } from "./types";

export const CLIENT_SLA_STATUSES = [
  "UNPUBLISHED",
  "PUBLISHED",
  "AMENDED",
  "WITHDRAWN",
] as const;

export type ClientSlaStatus = (typeof CLIENT_SLA_STATUSES)[number];

export function isClientSlaStatus(value: string): value is ClientSlaStatus {
  return (CLIENT_SLA_STATUSES as readonly string[]).includes(value);
}

export const CLIENT_SLA_CRITERION_KEYS = [
  "paid_tier",
  "partner_scorecard",
  "ledger_started",
] as const;

export type ClientSlaCriterionKey = (typeof CLIENT_SLA_CRITERION_KEYS)[number];

export const CLIENT_SLA_CARVE_OUT_KEYS = [
  "lender_delay",
  "survey_defects",
  "title_pack_delay",
  "client_inaction",
  "outside_pipeline",
] as const;

export type ClientSlaCarveOutKey = (typeof CLIENT_SLA_CARVE_OUT_KEYS)[number];

export type ClientSlaCarveOut = {
  key: ClientSlaCarveOutKey;
  label: string;
};

export const CLIENT_SLA_CARVE_OUTS: ClientSlaCarveOut[] = [
  { key: "lender_delay", label: "Lender or finance-provider delay" },
  { key: "survey_defects", label: "Survey or inspection defects" },
  { key: "title_pack_delay", label: "Title or tenure document pack delay" },
  { key: "client_inaction", label: "Client inaction or late evidence" },
  { key: "outside_pipeline", label: "Events outside the orchestrated pipeline" },
];

export const CLIENT_SLA_EVENT_TYPES = [
  "CLIENT_SLA_PUBLISHED",
  "CLIENT_SLA_AMENDED",
  "CLIENT_SLA_WITHDRAWN",
] as const;

export const CLIENT_SLA_ACTIONS = ["PUBLISH", "AMEND", "WITHDRAW"] as const;

export type ClientSlaAction = (typeof CLIENT_SLA_ACTIONS)[number];

export const MIN_CLIENT_SLA_REASON_LENGTH = 8;

export type SlaScorecardSignal = {
  partnerId: string;
  roleType: ActorRole;
  hasReferral: boolean;
  scorecardRating: ScorecardRating;
  participationRate: number;
};

export type ClientSlaCriterion = {
  key: ClientSlaCriterionKey;
  label: string;
  met: boolean;
};

export type ClientSlaPublication = {
  action: ClientSlaAction;
  targetDate: string | null;
  reason: string;
  at: string;
};

export type ClientSlaEventPayload = {
  action: ClientSlaAction;
  targetDate: string | null;
  reason: string;
};

export type ClientSlaCommitment = {
  status: ClientSlaStatus;
  criteria: ClientSlaCriterion[];
  eligibleByRules: boolean;
  publication: ClientSlaPublication | null;
  carveOuts: ClientSlaCarveOut[];
  moduleEnabled: boolean;
};

export type ClientSlaTargetCopy = {
  status: "PUBLISHED" | "AMENDED";
  headline: string;
  body: string;
  targetDate: string;
  carveOuts: ClientSlaCarveOut[];
};

export type AdvisorSlaView = {
  status: ClientSlaStatus;
  criteria: ClientSlaCriterion[];
  publication: ClientSlaPublication | null;
  carveOuts: ClientSlaCarveOut[];
  canPublish: boolean;
  canAmend: boolean;
  canWithdraw: boolean;
};

export class ClientSlaError extends Error {
  constructor(
    public code:
      | "MODULE_OFF"
      | "NOT_ELIGIBLE"
      | "REASON_REQUIRED"
      | "FORBIDDEN_ROLE"
      | "INVALID_TARGET_DATE"
      | "ALREADY_PUBLISHED"
      | "NOTHING_TO_AMEND"
      | "NOTHING_TO_WITHDRAW"
      | "ALREADY_WITHDRAWN",
    message: string,
  ) {
    super(message);
    this.name = "ClientSlaError";
  }
}

const CRITERION_LABELS: Record<ClientSlaCriterionKey, string> = {
  paid_tier: "Paid orchestration tier",
  partner_scorecard: "Partner scorecard or participation signal",
  ledger_started: "Accepted evidence on the stage ledger",
};

const EVENT_TYPE_FOR_ACTION: Record<
  ClientSlaAction,
  (typeof CLIENT_SLA_EVENT_TYPES)[number]
> = {
  PUBLISH: "CLIENT_SLA_PUBLISHED",
  AMEND: "CLIENT_SLA_AMENDED",
  WITHDRAW: "CLIENT_SLA_WITHDRAWN",
};

export function encodeClientSlaPayload(payload: ClientSlaEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeClientSlaPayload(
  payload: string | undefined,
): ClientSlaEventPayload | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "action" in parsed &&
      "reason" in parsed &&
      typeof (parsed as ClientSlaEventPayload).action === "string" &&
      typeof (parsed as ClientSlaEventPayload).reason === "string" &&
      ((parsed as ClientSlaEventPayload).targetDate === null ||
        typeof (parsed as ClientSlaEventPayload).targetDate === "string")
    ) {
      return parsed as ClientSlaEventPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function acceptedEvidenceKinds(caseState: CaseState): string[] {
  const kinds = new Set<string>();
  for (const stage of caseState.stages) {
    for (const kind of stage.acceptedEvidenceKinds) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}

export function partnerSlaMet(signals: SlaScorecardSignal[]): boolean {
  return signals.some(
    (signal) =>
      signal.hasReferral &&
      isPartnerActorRole(signal.roleType) &&
      (signal.scorecardRating === "STRONG" ||
        signal.scorecardRating === "WATCH" ||
        signal.participationRate >= 0.5),
  );
}

export function evaluateSlaCriteria(input: {
  caseState: CaseState;
  partnerSignals: SlaScorecardSignal[];
}): ClientSlaCriterion[] {
  return CLIENT_SLA_CRITERION_KEYS.map((key) => {
    let met = false;
    if (key === "paid_tier") {
      met = input.caseState.tier === "PAID_DWY";
    } else if (key === "partner_scorecard") {
      met = partnerSlaMet(input.partnerSignals);
    } else if (key === "ledger_started") {
      met = acceptedEvidenceKinds(input.caseState).length > 0;
    }
    return { key, label: CRITERION_LABELS[key], met };
  });
}

export function slaSignalsFrom(input: {
  referrals: Array<{
    partnerId: string;
    partnerRole: ActorRole;
    supersededAt: string | null;
  }>;
  scorecards: Array<{
    partnerId: string;
    rating: ScorecardRating;
    participationRate: number;
  }>;
}): SlaScorecardSignal[] {
  const activeReferrals = input.referrals.filter(
    (referral) => referral.supersededAt === null && isPartnerActorRole(referral.partnerRole),
  );

  return activeReferrals.map((referral) => {
    const scorecard = input.scorecards.find((row) => row.partnerId === referral.partnerId);
    return {
      partnerId: referral.partnerId,
      roleType: referral.partnerRole,
      hasReferral: true,
      scorecardRating: scorecard?.rating ?? "NO_DATA",
      participationRate: scorecard?.participationRate ?? 0,
    };
  });
}

function resolvePublication(caseState: CaseState): ClientSlaPublication | null {
  for (let i = caseState.events.length - 1; i >= 0; i--) {
    const event = caseState.events[i];
    if (!(CLIENT_SLA_EVENT_TYPES as readonly string[]).includes(event.type)) {
      continue;
    }
    const payload = decodeClientSlaPayload(event.payload);
    if (!payload) {
      continue;
    }
    return {
      action: payload.action,
      targetDate: payload.targetDate,
      reason: payload.reason,
      at: event.at,
    };
  }
  return null;
}

function statusFromPublication(publication: ClientSlaPublication | null): ClientSlaStatus {
  if (!publication) {
    return "UNPUBLISHED";
  }
  if (publication.action === "PUBLISH") {
    return "PUBLISHED";
  }
  if (publication.action === "AMEND") {
    return "AMENDED";
  }
  return "WITHDRAWN";
}

export function assessClientSla(input: {
  caseState: CaseState;
  moduleEnabled: boolean;
  partnerSignals: SlaScorecardSignal[];
}): ClientSlaCommitment {
  const criteria = evaluateSlaCriteria({
    caseState: input.caseState,
    partnerSignals: input.partnerSignals,
  });
  const allMet = criteria.every((criterion) => criterion.met);

  if (!input.moduleEnabled) {
    return {
      status: "UNPUBLISHED",
      criteria,
      eligibleByRules: false,
      publication: null,
      carveOuts: CLIENT_SLA_CARVE_OUTS,
      moduleEnabled: false,
    };
  }

  return {
    status: statusFromPublication(resolvePublication(input.caseState)),
    criteria,
    eligibleByRules: allMet,
    publication: resolvePublication(input.caseState),
    carveOuts: CLIENT_SLA_CARVE_OUTS,
    moduleEnabled: true,
  };
}

function assertTargetDate(targetDate: string | null, now: Date): string {
  if (!targetDate || !isIsoCalendarDate(targetDate)) {
    throw new ClientSlaError(
      "INVALID_TARGET_DATE",
      "A calendar target date (YYYY-MM-DD) is required",
    );
  }
  if (targetDate < todayIso(now)) {
    throw new ClientSlaError(
      "INVALID_TARGET_DATE",
      "Target date must be on or after today",
    );
  }
  return targetDate;
}

export function applyClientSlaAction(
  caseState: CaseState,
  input: {
    action: ClientSlaAction;
    targetDate: string | null;
    reason: string;
    actorRole: ActorRole;
    now?: Date;
    moduleEnabled: boolean;
    partnerSignals: SlaScorecardSignal[];
  },
): CaseState {
  if (input.actorRole !== "ADVISOR") {
    throw new ClientSlaError(
      "FORBIDDEN_ROLE",
      "Only an advisor may publish, amend, or withdraw a client SLA target",
    );
  }

  const trimmed = input.reason.trim();
  if (trimmed.length < MIN_CLIENT_SLA_REASON_LENGTH) {
    throw new ClientSlaError(
      "REASON_REQUIRED",
      "A reason of at least 8 characters is required",
    );
  }

  if (!input.moduleEnabled) {
    throw new ClientSlaError("MODULE_OFF", "Client SLA overlay is not enabled for this case");
  }

  const now = input.now ?? new Date();
  const current = assessClientSla({
    caseState,
    moduleEnabled: input.moduleEnabled,
    partnerSignals: input.partnerSignals,
  });
  const live = current.status === "PUBLISHED" || current.status === "AMENDED";

  let storedDate: string | null = null;
  if (input.action === "PUBLISH") {
    if (!current.eligibleByRules) {
      throw new ClientSlaError(
        "NOT_ELIGIBLE",
        "Every SLA criterion must be met before publishing a target",
      );
    }
    if (live) {
      throw new ClientSlaError(
        "ALREADY_PUBLISHED",
        "A target is already published; amend or withdraw it first",
      );
    }
    storedDate = assertTargetDate(input.targetDate, now);
  } else if (input.action === "AMEND") {
    if (!live) {
      throw new ClientSlaError("NOTHING_TO_AMEND", "No published target to amend");
    }
    storedDate = assertTargetDate(input.targetDate, now);
  } else if (input.action === "WITHDRAW") {
    if (!live) {
      throw new ClientSlaError("NOTHING_TO_WITHDRAW", "No published target to withdraw");
    }
    storedDate = null;
  }

  const focus = getFocusStage(caseState);
  const stageKey = focus?.key ?? caseState.stages[0]?.key ?? "unknown";

  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: EVENT_TYPE_FOR_ACTION[input.action],
        stageKey,
        actorRole: input.actorRole,
        at: now.toISOString(),
        payload: encodeClientSlaPayload({
          action: input.action,
          targetDate: storedDate,
          reason: trimmed,
        }),
      },
    ],
  };
}

export function clientSlaTargetCopy(
  commitment: ClientSlaCommitment,
): ClientSlaTargetCopy | null {
  if (!commitment.moduleEnabled) {
    return null;
  }
  const paid = commitment.criteria.find((row) => row.key === "paid_tier")?.met ?? false;
  if (!paid) {
    return null;
  }
  if (commitment.status !== "PUBLISHED" && commitment.status !== "AMENDED") {
    return null;
  }
  const targetDate = commitment.publication?.targetDate;
  if (!targetDate) {
    return null;
  }

  const amendedNote = commitment.status === "AMENDED" ? " (amended)" : "";
  return {
    status: commitment.status,
    headline: "Target completion date",
    body: `We are working toward ${targetDate}${amendedNote}. This is a published target, subject to the carve-outs below.`,
    targetDate,
    carveOuts: commitment.carveOuts,
  };
}

export function advisorSlaView(commitment: ClientSlaCommitment): AdvisorSlaView {
  const live = commitment.status === "PUBLISHED" || commitment.status === "AMENDED";
  return {
    status: commitment.status,
    criteria: commitment.criteria,
    publication: commitment.publication,
    carveOuts: commitment.carveOuts,
    canPublish: commitment.moduleEnabled && commitment.eligibleByRules && !live,
    canAmend: commitment.moduleEnabled && live,
    canWithdraw: commitment.moduleEnabled && live,
  };
}
```

In `tests/domain/engine-country-agnostic.test.ts`, add `"src/domain/client-sla.ts"` to `ENGINE_GLOBAL_FILES` immediately after `"src/domain/chain-free.ts"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/client-sla.test.ts tests/domain/engine-country-agnostic.test.ts`
Expected: PASS. Country-agnostic scan must stay green — `client-sla.ts` uses "title or tenure document pack", not leasehold / England / Wales.

- [ ] **Step 5: Commit**

```bash
git add src/domain/client-sla.ts tests/domain/client-sla.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: add client SLA domain with target dates and carve-outs"
```

---

### Task 2: Turn `hard_client_sla` on for `ew` only

**Files:**
- Modify: `src/domain/market-packs/ew-config.ts`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-inspector.test.ts`
- Modify: `tests/domain/ew-pack.test.ts`
- Modify: `tests/domain/uk-au-pack.test.ts`

**Interfaces:**
- Consumes: `MarketFlags` / `isModuleEnabled` already exported from `src/domain/market-packs/types.ts`. `hard_client_sla` is already a `MarketModuleKey`.
- Produces: `EW_FLAGS.hard_client_sla === true`. Every other registered pack stays `false`. `GATED_MODULES` is removed — nothing is globally gated after this plan. `chain_free_inventory` and `partner_speed_rails` stay exactly as they are.

- [ ] **Step 1: Write the failing flag tests**

In `tests/domain/market-pack-flags.test.ts`:

1. Delete `const GATED_MODULES = ["hard_client_sla"] as const;` and delete the `keeps every globally gated module off` test.
2. Add this test after the document-vault test (replace the `EW_FLAGS.hard_client_sla` false assertion inside the vault test — delete that `expect(isModuleEnabled(EW_FLAGS, "hard_client_sla")).toBe(false)` line):

```ts
  it("runs hard client SLA in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "hard_client_sla"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "hard_client_sla"),
    ).toBe(false);
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au_uk")!.flags, "hard_client_sla"),
    ).toBe(false);
    expect(isModuleEnabled(EW_FLAGS, "hard_client_sla")).toBe(true);
  });
```

3. In `lists every module key with its resolved state for a pack`, change:

```ts
    expect(rows.find((r) => r.key === "hard_client_sla")?.enabled).toBe(true);
```

In `tests/domain/market-pack-inspector.test.ts`, change the `hard_client_sla` row to `true`, and after the inbound corridor `document_vault` assertion add:

```ts
    expect(inbound.modules.find((m) => m.key === "hard_client_sla")?.enabled).toBe(false);
```

In `tests/domain/ew-pack.test.ts`, change the flags snapshot to:

```ts
    expect(ewMarketPack.flags).toEqual({
      fx_deposit: true,
      partner_speed_rails: true,
      chain_free_inventory: true,
      document_vault: true,
      hard_client_sla: true,
    });
```

In `tests/domain/uk-au-pack.test.ts`, after the `partner_speed_rails` assertion add:

```ts
    expect(isModuleEnabled(ukAuMarketPack.flags, "hard_client_sla")).toBe(false);
```

Do not edit `tests/domain/au-uk-pack.test.ts`, `tests/domain/us-uk-pack.test.ts`, or `tests/domain/uk-us-pack.test.ts` — they already assert `hard_client_sla` is false.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/ew-pack.test.ts tests/domain/uk-au-pack.test.ts`
Expected: FAIL on `hard_client_sla` expected `true` / `["ew"]` because `EW_FLAGS` still omits the key.

- [ ] **Step 3: Flip the E&W flag**

In `src/domain/market-packs/ew-config.ts` replace the comment and flags with:

```ts
/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are
 * adapter plumbing. Spec §13 sub-project 6: chain_free_inventory is on as
 * buyer-side certification/matching data — not seller listings. Spec §8:
 * document_vault is on for ew only. Spec §5/§9: hard_client_sla is on for ew
 * only as published target timelines with legal carve-outs — not a marketing
 * guarantee.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
  chain_free_inventory: true,
  document_vault: true,
  hard_client_sla: true,
};
```

Do not add `hard_client_sla` to any other pack config.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/ew-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-us-pack.test.ts`
Expected: PASS. `partner_speed_rails` and `chain_free_inventory` still resolve to `["ew"]` only.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/ew-config.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/ew-pack.test.ts tests/domain/uk-au-pack.test.ts
git commit -m "feat: enable hard_client_sla on the England and Wales pack only"
```

---

### Task 3: Server policy and load

**Files:**
- Create: `src/server/client-sla.ts`
- Create: `tests/server/client-sla-policy.test.ts`
- Modify: `src/server/cockpit-policy.ts` — add `assertClientSlaVisible`

**Interfaces:**
- Consumes: `assessClientSla`, `applyClientSlaAction`, `ClientSlaError`, `slaSignalsFrom`, `ClientSlaAction`, `SlaScorecardSignal`, `ClientSlaCommitment` from `src/domain/client-sla.ts`; `isModuleEnabled` from `src/domain/market-packs/types.ts`; `casePack` from `src/lib/case-pack.ts`; `listReferralsForCase` from `src/server/referrals.ts`; `loadPanelScorecards` from `src/server/scorecards.ts`.
- Produces: `LoadedClientSla` (`{ commitment: ClientSlaCommitment; partnerSignals: SlaScorecardSignal[] }`), `canUseClientSla(caseState: CaseState): boolean`, `assertClientSla(caseState: CaseState): void`, `loadClientSla(caseState: CaseState, now?: Date): Promise<LoadedClientSla>`, `performClientSlaAction(caseState, { action, targetDate, reason, partnerSignals, now? }): CaseState`, `assertClientSlaVisible(viewerRole: ActorRole): void`.

- [ ] **Step 1: Write the failing policy tests**

Create `tests/server/client-sla-policy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ClientSlaError } from "../../src/domain/client-sla";
import {
  assertClientSlaVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";
import { assertClientSla, canUseClientSla } from "../../src/server/client-sla";

function paid() {
  return createCase({ id: "slap1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("client SLA module gate", () => {
  it("is open for any tier on the England & Wales pack", () => {
    expect(canUseClientSla(paid())).toBe(true);
    expect(
      canUseClientSla(
        createCase({ id: "slap2", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" }),
      ),
    ).toBe(true);
    expect(() => assertClientSla(paid())).not.toThrow();
  });

  it("is closed when the resolved pack does not enable the module", () => {
    const other = { ...paid(), marketPackId: "au" };
    expect(canUseClientSla(other)).toBe(false);
    expect(() => assertClientSla(other)).toThrow(ClientSlaError);
  });
});

describe("SLA publish-panel visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertClientSlaVisible("ADVISOR")).not.toThrow();
    expect(() => assertClientSlaVisible("CLIENT")).toThrow(CockpitPolicyError);
    expect(() => assertClientSlaVisible("CONVEYANCER")).toThrow(/advisor-only/i);
  });
});

describe("cockpit wiring contract", () => {
  it("keeps the publish panel import off the portal page", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    expect(portal).not.toContain("ClientSlaPublishPanel");
    expect(portal).not.toContain("advisorSlaView");
    expect(portal).not.toContain("assertClientSlaVisible");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/client-sla-policy.test.ts`
Expected: FAIL with `Cannot find module '../../src/server/client-sla'` (or `assertClientSlaVisible` is not exported).

- [ ] **Step 3: Write policy and load**

Create `src/server/client-sla.ts`:

```ts
import {
  applyClientSlaAction,
  assessClientSla,
  ClientSlaError,
  slaSignalsFrom,
  type ClientSlaAction,
  type ClientSlaCommitment,
  type SlaScorecardSignal,
} from "../domain/client-sla";
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { casePack } from "../lib/case-pack";
import { listReferralsForCase } from "./referrals";
import { loadPanelScorecards } from "./scorecards";

export type LoadedClientSla = {
  commitment: ClientSlaCommitment;
  partnerSignals: SlaScorecardSignal[];
};

export function canUseClientSla(caseState: CaseState): boolean {
  try {
    return isModuleEnabled(casePack(caseState).flags, "hard_client_sla");
  } catch {
    return false;
  }
}

export function assertClientSla(caseState: CaseState): void {
  if (!canUseClientSla(caseState)) {
    throw new ClientSlaError(
      "MODULE_OFF",
      `Client SLA overlay is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export async function loadClientSla(caseState: CaseState): Promise<LoadedClientSla> {
  const referrals = await listReferralsForCase(caseState.id);
  const rows = await loadPanelScorecards(new Date());
  const partnerSignals = slaSignalsFrom({
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
    commitment: assessClientSla({
      caseState,
      moduleEnabled: canUseClientSla(caseState),
      partnerSignals,
    }),
  };
}

export function performClientSlaAction(
  caseState: CaseState,
  input: {
    action: ClientSlaAction;
    targetDate: string | null;
    reason: string;
    partnerSignals: SlaScorecardSignal[];
    now?: Date;
  },
): CaseState {
  assertClientSla(caseState);
  return applyClientSlaAction(caseState, {
    action: input.action,
    targetDate: input.targetDate,
    reason: input.reason,
    actorRole: "ADVISOR",
    now: input.now,
    moduleEnabled: true,
    partnerSignals: input.partnerSignals,
  });
}
```

At the end of `src/server/cockpit-policy.ts` add:

```ts
export function assertClientSlaVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Client SLA publish controls are advisor-only operating IP",
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/client-sla-policy.test.ts tests/server/chain-free-policy.test.ts tests/server/cockpit-playbook-policy.test.ts`
Expected: PASS. Existing cockpit-policy tests keep passing; the new `assertClientSlaVisible` is additive.

- [ ] **Step 5: Commit**

```bash
git add src/server/client-sla.ts src/server/cockpit-policy.ts tests/server/client-sla-policy.test.ts
git commit -m "feat: add fail-closed client SLA policy and scorecard load"
```

---

### Task 4: Advisor publish, amend and withdraw actions

**Files:**
- Create: `src/app/actions/client-sla.ts`
- Create: `tests/server/client-sla-actions.test.ts`

**Interfaces:**
- Consumes: `ClientSlaAction`, `ClientSlaError` from `src/domain/client-sla.ts`; `loadClientSla`, `performClientSlaAction` from `src/server/client-sla.ts`; `auth` from `src/lib/auth.ts`; `loadCaseForUser`, `saveCase`, `CaseAccessError` from `src/server/cases.ts`; `revalidatePath` from `next/cache`.
- Produces: `ClientSlaActionResult = { ok: true } | { ok: false; error: string }`, `publishClientSlaAction(caseId: string, targetDate: string, reason: string)`, `amendClientSlaAction(caseId: string, targetDate: string, reason: string)`, `withdrawClientSlaAction(caseId: string, reason: string)`.

- [ ] **Step 1: Write the failing action tests**

Create `tests/server/client-sla-actions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  applyClientSlaAction,
  assessClientSla,
  ClientSlaError,
  type SlaScorecardSignal,
} from "../../src/domain/client-sla";
import { createCase, type CaseState } from "../../src/domain/stage-engine";
import { performClientSlaAction } from "../../src/server/client-sla";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const TARGET = "2026-12-15";

function acceptAny(caseState: CaseState): CaseState {
  const kind = caseState.stages[0]?.requiredEvidenceKinds[0];
  if (!kind) {
    return caseState;
  }
  return {
    ...caseState,
    stages: caseState.stages.map((stage, index) =>
      index === 0
        ? { ...stage, acceptedEvidenceKinds: [...stage.acceptedEvidenceKinds, kind] }
        : stage,
    ),
  };
}

const signals: SlaScorecardSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

function ready(): CaseState {
  return acceptAny(
    createCase({
      id: "slaa1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      now: NOW,
    }),
  );
}

describe("performClientSlaAction", () => {
  it("writes PUBLISHED through the policy gate", () => {
    const next = performClientSlaAction(ready(), {
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "Ledger is live; partner scorecard supports a target.",
      partnerSignals: signals,
      now: NOW,
    });
    expect(
      assessClientSla({
        caseState: next,
        moduleEnabled: true,
        partnerSignals: signals,
      }).status,
    ).toBe("PUBLISHED");
  });

  it("maps domain refusals to ClientSlaError codes the action will surface", () => {
    try {
      performClientSlaAction(
        createCase({
          id: "slaa2",
          entryContext: "UK_RESIDENT_SPEED",
          tier: "PAID_DWY",
          now: NOW,
        }),
        {
          action: "PUBLISH",
          targetDate: TARGET,
          reason: "I just like a date.",
          partnerSignals: [],
          now: NOW,
        },
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ClientSlaError);
      expect((err as ClientSlaError).code).toBe("NOT_ELIGIBLE");
    }
  });

  it("refuses the overlay when the pack flag is off", () => {
    const other = { ...ready(), marketPackId: "au" };
    expect(() =>
      performClientSlaAction(other, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "Ledger is live; partner scorecard supports a target.",
        partnerSignals: signals,
        now: NOW,
      }),
    ).toThrow(/not enabled/i);
  });
});

describe("error mapping contract", () => {
  it("exposes the domain message, not a generic failure, for ClientSlaError", () => {
    const err = new ClientSlaError(
      "REASON_REQUIRED",
      "A reason of at least 8 characters is required",
    );
    expect(err.message).toMatch(/reason/i);
    expect(err).toBeInstanceOf(Error);
  });

  it("does not let applyClientSlaAction skip the server gate", () => {
    const published = applyClientSlaAction(ready(), {
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "Ledger is live; partner scorecard supports a target.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
      now: NOW,
    });
    expect(published.events.some((event) => event.type === "CLIENT_SLA_PUBLISHED")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/client-sla-actions.test.ts`
Expected: FAIL only if `performClientSlaAction` were missing. After Task 3 it should already PASS for the perform tests. If it PASSES, that is the red-to-green for the server gate; the action module is still missing and is written in Step 3. If you need a failing surface before writing the action file, add this block at the bottom of the same test file (it reads the action module):

```ts
describe("action module", () => {
  it("exports advisor publish, amend and withdraw entry points", async () => {
    const actions = await import("../../src/app/actions/client-sla");
    expect(typeof actions.publishClientSlaAction).toBe("function");
    expect(typeof actions.amendClientSlaAction).toBe("function");
    expect(typeof actions.withdrawClientSlaAction).toBe("function");
  });
});
```

Expected before Step 3: FAIL with `Cannot find module '../../src/app/actions/client-sla'`.

- [ ] **Step 3: Write the server actions**

Create `src/app/actions/client-sla.ts`:

```ts
"use server";

import { type ClientSlaAction, ClientSlaError } from "@/domain/client-sla";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import { loadClientSla, performClientSlaAction } from "@/server/client-sla";
import { revalidatePath } from "next/cache";

export type ClientSlaActionResult = { ok: true } | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof ClientSlaError ||
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

async function runAction(
  caseId: string,
  action: ClientSlaAction,
  targetDate: string | null,
  reason: string,
): Promise<ClientSlaActionResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }
  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const loaded = await loadClientSla(caseState);
    caseState = performClientSlaAction(caseState, {
      action,
      targetDate,
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

export async function publishClientSlaAction(
  caseId: string,
  targetDate: string,
  reason: string,
): Promise<ClientSlaActionResult> {
  return runAction(caseId, "PUBLISH", targetDate, reason);
}

export async function amendClientSlaAction(
  caseId: string,
  targetDate: string,
  reason: string,
): Promise<ClientSlaActionResult> {
  return runAction(caseId, "AMEND", targetDate, reason);
}

export async function withdrawClientSlaAction(
  caseId: string,
  reason: string,
): Promise<ClientSlaActionResult> {
  return runAction(caseId, "WITHDRAW", null, reason);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/client-sla-actions.test.ts`
Expected: PASS, including the action-module export check.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/client-sla.ts tests/server/client-sla-actions.test.ts
git commit -m "feat: add advisor publish, amend and withdraw actions for client SLA"
```

---

### Task 5: Cockpit publish panel (operating IP)

**Files:**
- Create: `src/components/ClientSlaPublishPanel.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx`
- Modify: `src/app/cockpit/panel/page.tsx`
- Modify: `tests/server/client-sla-policy.test.ts` — add the cockpit wiring assertion

**Interfaces:**
- Consumes: `AdvisorSlaView` from `src/domain/client-sla.ts`; `advisorSlaView` from `src/domain/client-sla.ts`; `publishClientSlaAction`, `amendClientSlaAction`, `withdrawClientSlaAction` from `src/app/actions/client-sla.ts`; `assertClientSlaVisible` from `src/server/cockpit-policy.ts`; `canUseClientSla`, `loadClientSla` from `src/server/client-sla.ts`; `ActionErrorBanner` from `src/components/ActionErrorBanner.tsx`.
- Produces: `ClientSlaPublishPanel({ caseId: string; view: AdvisorSlaView })`. Cockpit case page renders it only when `canUseClientSla` is true. Portal still must not import the panel.

- [ ] **Step 1: Write the failing cockpit wiring test**

Append to `tests/server/client-sla-policy.test.ts` inside the existing `cockpit wiring contract` describe (replace the portal-only test with this pair):

```ts
describe("cockpit wiring contract", () => {
  it("renders the publish panel on the advisor case page and keeps checklist IP off the portal", () => {
    const cockpit = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/panel/page.tsx"),
      "utf8",
    );
    expect(cockpit).toContain("ClientSlaPublishPanel");
    expect(cockpit).toContain("assertClientSlaVisible");
    expect(cockpit).toContain("loadClientSla");
    expect(portal).not.toContain("ClientSlaPublishPanel");
    expect(portal).not.toContain("advisorSlaView");
    expect(panel).toMatch(/published target/i);
    expect(panel).not.toMatch(/guarante/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/client-sla-policy.test.ts`
Expected: FAIL — cockpit case page does not contain `ClientSlaPublishPanel`.

- [ ] **Step 3: Add the panel and wire the cockpit**

Create `src/components/ClientSlaPublishPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  amendClientSlaAction,
  publishClientSlaAction,
  withdrawClientSlaAction,
} from "@/app/actions/client-sla";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { AdvisorSlaView } from "@/domain/client-sla";

type Props = {
  caseId: string;
  view: AdvisorSlaView;
};

const BADGE: Record<AdvisorSlaView["status"], string> = {
  UNPUBLISHED: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  AMENDED: "bg-amber-100 text-amber-900",
  WITHDRAWN: "bg-rose-100 text-rose-900",
};

export function ClientSlaPublishPanel({ caseId, view }: Props) {
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
        <h2 className="text-lg font-medium text-slate-900">Published target timeline</h2>
        <span className={`rounded px-2 py-1 text-xs font-medium ${BADGE[view.status]}`}>
          {view.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Advisor-published target we are working toward, subject to carve-outs. Not a
        marketing promise of a completion date.
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
      {view.publication && (
        <p className="text-xs text-slate-500">
          Last action: {view.publication.action.toLowerCase()}
          {view.publication.targetDate ? ` · ${view.publication.targetDate}` : ""} —{" "}
          {view.publication.reason}
        </p>
      )}
      <div>
        <h3 className="text-sm font-medium text-slate-800">Standard carve-outs</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {view.carveOuts.map((row) => (
            <li key={row.key}>{row.label}</li>
          ))}
        </ul>
      </div>
      {view.canPublish && (
        <form
          action={async (formData) => {
            await run(() =>
              publishClientSlaAction(
                caseId,
                String(formData.get("targetDate") ?? ""),
                String(formData.get("reason") ?? ""),
              ),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Target date
            <input
              name="targetDate"
              type="date"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Publish reason
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
            Publish target
          </button>
        </form>
      )}
      {view.canAmend && (
        <form
          action={async (formData) => {
            await run(() =>
              amendClientSlaAction(
                caseId,
                String(formData.get("targetDate") ?? ""),
                String(formData.get("reason") ?? ""),
              ),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Amended target date
            <input
              name="targetDate"
              type="date"
              required
              defaultValue={view.publication?.targetDate ?? ""}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Amend reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Amend target
          </button>
        </form>
      )}
      {view.canWithdraw && (
        <form
          action={async (formData) => {
            await run(() =>
              withdrawClientSlaAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Withdraw reason
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
            Withdraw target
          </button>
        </form>
      )}
    </div>
  );
}
```

In `src/app/cockpit/cases/[caseId]/page.tsx`:

1. Add these imports next to the existing chain-free imports:

```tsx
import { ClientSlaPublishPanel } from "@/components/ClientSlaPublishPanel";
import { advisorSlaView } from "@/domain/client-sla";
import { assertClientSlaVisible, assertCertificationVisible, assertPlaybookVisible } from "@/server/cockpit-policy";
import { canUseClientSla, loadClientSla } from "@/server/client-sla";
```

Keep the existing `assertCertificationVisible` / `canUseChainFree` / `loadCertification` imports — merge rather than duplicate. The cockpit-policy import line should include all three asserts in one import. The chain-free server import stays on its own line.

2. After the chain-free load block, add:

```tsx
  assertClientSlaVisible("ADVISOR");
  const clientSlaEnabled = canUseClientSla(caseState);
  const clientSla = clientSlaEnabled ? await loadClientSla(caseState) : null;
  const clientSlaView = clientSla ? advisorSlaView(clientSla.commitment) : null;
```

3. Immediately after `{chainFreeView && ( <ChainFreeCertificationPanel ... /> )}` add:

```tsx
      {clientSlaView && (
        <ClientSlaPublishPanel caseId={caseId} view={clientSlaView} />
      )}
```

In `src/app/cockpit/panel/page.tsx` replace the subtitle paragraph with:

```tsx
      <p className="mt-1 text-sm text-slate-600">
        Curated panel scored from the stage ledger. Scorecards unlock chain-free
        certification and published target timelines on a paid case. Dates stay
        targets, subject to carve-outs.
      </p>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/client-sla-policy.test.ts tests/server/chain-free-policy.test.ts`
Expected: PASS. The new cockpit file read finds `ClientSlaPublishPanel`; chain-free wiring is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClientSlaPublishPanel.tsx src/app/cockpit/cases/[caseId]/page.tsx src/app/cockpit/panel/page.tsx tests/server/client-sla-policy.test.ts
git commit -m "feat: add advisor client SLA publish panel as cockpit IP"
```

---

### Task 6: Portal read-only target date card

**Files:**
- Create: `src/components/ClientSlaTargetCard.tsx`
- Create: `tests/server/client-sla-portal.test.ts`
- Modify: `src/app/portal/cases/[caseId]/page.tsx`

**Interfaces:**
- Consumes: `ClientSlaTargetCopy` fields (`headline`, `body`, `targetDate`, `carveOuts`) from `src/domain/client-sla.ts`; `clientSlaTargetCopy` from `src/domain/client-sla.ts`; `canUseClientSla`, `loadClientSla` from `src/server/client-sla.ts`.
- Produces: `ClientSlaTargetCard({ headline, body, targetDate, carveOuts })`. Portal renders it only when `clientSlaTargetCopy` returns a value. Card must not contain guarantee language, criteria, or scorecard numbers.

- [ ] **Step 1: Write the failing portal tests**

Create `tests/server/client-sla-portal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyClientSlaAction,
  assessClientSla,
  CLIENT_SLA_CARVE_OUTS,
  clientSlaTargetCopy,
  type SlaScorecardSignal,
} from "../../src/domain/client-sla";
import { createCase, type CaseState } from "../../src/domain/stage-engine";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const TARGET = "2026-12-15";

function acceptAny(caseState: CaseState): CaseState {
  const kind = caseState.stages[0]?.requiredEvidenceKinds[0];
  if (!kind) {
    return caseState;
  }
  return {
    ...caseState,
    stages: caseState.stages.map((stage, index) =>
      index === 0
        ? { ...stage, acceptedEvidenceKinds: [...stage.acceptedEvidenceKinds, kind] }
        : stage,
    ),
  };
}

const signals: SlaScorecardSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

describe("portal copy surface", () => {
  it("shows a target card only for PUBLISHED and AMENDED", () => {
    const paid = acceptAny(
      createCase({
        id: "slap_p",
        entryContext: "UK_RESIDENT_SPEED",
        tier: "PAID_DWY",
        now: NOW,
      }),
    );
    expect(
      clientSlaTargetCopy(
        assessClientSla({ caseState: paid, moduleEnabled: true, partnerSignals: signals }),
      ),
    ).toBeNull();

    const published = applyClientSlaAction(paid, {
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "Ledger is live; partner scorecard supports a target.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
      now: NOW,
    });
    const publishedCopy = clientSlaTargetCopy(
      assessClientSla({
        caseState: published,
        moduleEnabled: true,
        partnerSignals: signals,
      }),
    );
    expect(publishedCopy?.status).toBe("PUBLISHED");
    expect(publishedCopy?.carveOuts).toEqual(CLIENT_SLA_CARVE_OUTS);

    const withdrawn = applyClientSlaAction(published, {
      action: "WITHDRAW",
      targetDate: null,
      reason: "Client paused the purchase.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
      now: NOW,
    });
    expect(
      clientSlaTargetCopy(
        assessClientSla({
          caseState: withdrawn,
          moduleEnabled: true,
          partnerSignals: signals,
        }),
      ),
    ).toBeNull();
  });

  it("keeps scorecard numbers, publish controls and guarantee language out of the portal page", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const card = readFileSync(
      path.resolve(process.cwd(), "src/components/ClientSlaTargetCard.tsx"),
      "utf8",
    );
    expect(portal).toContain("ClientSlaTargetCard");
    expect(portal).toContain("clientSlaTargetCopy");
    expect(portal).not.toContain("ClientSlaPublishPanel");
    expect(portal).not.toContain("qualityScore");
    expect(portal).not.toContain("participationRate");
    expect(portal).not.toContain("advisorSlaView");
    expect(card).not.toMatch(/guarante|qualityScore|canPublish/i);
    expect(card).toMatch(/carveOuts/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/client-sla-portal.test.ts`
Expected: FAIL — `ClientSlaTargetCard.tsx` does not exist.

- [ ] **Step 3: Add the card and wire the portal**

Create `src/components/ClientSlaTargetCard.tsx`:

```tsx
type CarveOut = {
  key: string;
  label: string;
};

type Props = {
  headline: string;
  body: string;
  targetDate: string;
  carveOuts: CarveOut[];
};

export function ClientSlaTargetCard({ headline, body, targetDate, carveOuts }: Props) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">{headline}</h2>
      <p className="mt-1 text-sm font-medium text-slate-800">{targetDate}</p>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {carveOuts.map((row) => (
          <li key={row.key}>{row.label}</li>
        ))}
      </ul>
    </div>
  );
}
```

In `src/app/portal/cases/[caseId]/page.tsx`:

1. Add imports next to the chain-free imports:

```tsx
import { ClientSlaTargetCard } from "@/components/ClientSlaTargetCard";
import { clientSlaTargetCopy } from "@/domain/client-sla";
import { canUseClientSla, loadClientSla } from "@/server/client-sla";
```

Keep the existing `canUseChainFree` / `loadCertification` import on its own line.

2. After the `chainFreeCopy` block, add:

```tsx
  const clientSlaCopy =
    canUseClientSla(caseState)
      ? clientSlaTargetCopy((await loadClientSla(caseState)).commitment)
      : null;
```

3. Immediately after the `{chainFreeCopy && ( <ChainFreeStatusCard ... /> )}` block, add:

```tsx
      {clientSlaCopy && (
        <ClientSlaTargetCard
          headline={clientSlaCopy.headline}
          body={clientSlaCopy.body}
          targetDate={clientSlaCopy.targetDate}
          carveOuts={clientSlaCopy.carveOuts}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/client-sla-portal.test.ts tests/server/client-sla-policy.test.ts tests/server/chain-free-portal.test.ts`
Expected: PASS. Chain-free portal card wiring is unchanged. Policy test still asserts the publish panel is absent from the portal.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClientSlaTargetCard.tsx src/app/portal/cases/[caseId]/page.tsx tests/server/client-sla-portal.test.ts
git commit -m "feat: show published SLA target and carve-outs on the client portal"
```

---

### Task 7: Marketing hook that names targets, not guarantees

**Files:**
- Modify: `src/content/marketing.ts`
- Modify: `src/app/(marketing)/page.tsx`
- Modify: `tests/content/marketing-copy.test.ts`

**Interfaces:**
- Consumes: existing `FORBIDDEN_CLAIM_PATTERNS`, `REGULATORY_DISCLOSURES`, `marketingClaimStrings`.
- Produces: `CLIENT_SLA_HOOK = { eyebrow, headline, body }`. Hook strings are included in `marketingClaimStrings()` so `/guarantee/i`, `/rightmove/i` and `/zoopla/i` still apply. Homepage renders the hook after `CHAIN_FREE_HOOK`. No `/start` or `/pricing` changes.

- [ ] **Step 1: Write the failing marketing tests**

Append to `tests/content/marketing-copy.test.ts` (add `CLIENT_SLA_HOOK` to the existing import from `../../src/content/marketing`):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/content/marketing-copy.test.ts`
Expected: FAIL — `CLIENT_SLA_HOOK` is not exported; regulatory array has no carve-out line yet.

- [ ] **Step 3: Add the hook and strengthen the disclosure**

In `src/content/marketing.ts`, immediately after `CHAIN_FREE_HOOK`, add:

```ts
export const CLIENT_SLA_HOOK = {
  eyebrow: "Targets, not promises",
  headline: "Published target timelines, subject to carve-outs.",
  body: "When the ledger supports it, your advisor can publish a target completion date we are working toward. Dates stay subject to carve-outs. This is not a marketing promise of a completion date.",
};
```

Replace the dates disclosure in `REGULATORY_DISCLOSURES` with:

```ts
  "Any dates you see in the portal are planning targets from our own stage ledger, subject to carve-outs, not a promise of a completion date.",
```

Do not add the word `guarantee` anywhere in this file.

In `marketingClaimStrings()`, after the three `CHAIN_FREE_HOOK` lines, add:

```ts
    CLIENT_SLA_HOOK.eyebrow,
    CLIENT_SLA_HOOK.headline,
    CLIENT_SLA_HOOK.body,
```

In `src/app/(marketing)/page.tsx`, change the import to:

```ts
import { CHAIN_FREE_HOOK, CLIENT_SLA_HOOK, ENTRY_STORIES, HERO } from "@/content/marketing";
```

Immediately after the `CHAIN_FREE_HOOK` section and before "Where are you starting from?", add:

```tsx
      <section className="mt-16 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {CLIENT_SLA_HOOK.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {CLIENT_SLA_HOOK.headline}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{CLIENT_SLA_HOOK.body}</p>
      </section>
```

Do not touch `/start`, `/pricing`, stories, or `docs/playbooks/diaspora-outreach-checklist.md`. Outreach stays forbidden from guarantee / Rightmove claims via the existing `FORBIDDEN_CLAIM_PATTERNS` import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/content/marketing-copy.test.ts tests/content/outreach-checklist.test.ts tests/lib/marketing-links.test.ts`
Expected: PASS. `makes no forbidden claims anywhere in the sales copy` still covers the new hook.

- [ ] **Step 5: Commit**

```bash
git add src/content/marketing.ts src/app/(marketing)/page.tsx tests/content/marketing-copy.test.ts
git commit -m "feat: add a client SLA target hook without guarantee language"
```

---

### Task 8: Demo script and older walkthroughs

**Files:**
- Create: `docs/superpowers/plans/demo-script-client-sla.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md`
- Modify: `docs/superpowers/plans/demo-script-speed-rails.md`
- Modify: `docs/superpowers/plans/demo-script-chain-free.md`
- Modify: `docs/superpowers/plans/demo-script-document-vault.md`
- Modify: `docs/superpowers/plans/demo-script-corridor-packs.md`

**Interfaces:**
- Consumes: the shipped overlay from Tasks 1–7; seed logins already in `README.md` (`advisor@example.com`, `client@example.com`, password `password`); `/cockpit/market-packs`, `/cockpit/cases`, `/portal/cases`, `/`.
- Produces: a founder walkthrough that proves published targets with carve-outs, the flag split (`ew` on / every other pack off), free DIY seeing no date, and the explicit non-goals.

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-client-sla.md`:

````md
# Client SLA overlay demo script

Founder validation script for the **published target timelines, not a marketing guarantee** thesis: after the stage ledger and partner scorecards exist, an England & Wales advisor can publish a target completion date with legal carve-outs; the client sees that date only when published; marketing may say target / working toward / subject to carve-outs; we still do not promise a completion day.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The module is on for ew, and it is still not a guarantee

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew · England & Wales`**. Under **Modules**, confirm `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault` and `hard_client_sla` are **on**. `corridor_inbound` and `corridor_outbound` stay **off**.
3. Select the **`au`** stub. Confirm `hard_client_sla` is **off**. Repeat for `au_uk`, `uk_au`, `us_uk` and `uk_us`.
4. `hard_client_sla` being on means the publish overlay exists as pack data. It does **not** mean any date is guaranteed.

## 2. Free DIY never sees the operating IP

1. `/cockpit/cases` → **Smith DIY journey**.
2. Scroll to **Published target timeline**. Badge is **UNPUBLISHED**. Paid-tier criterion is **Open**. There is no publish form (or Publish is refused).
3. Sign in as **`client@example.com`** → Smith. There is no target date card and no carve-out list.

## 3. Scorecards and the ledger unlock publish — they do not print a promise

1. Back as advisor on **Bloggs return (paid)**. Scroll to **Published target timeline**.
2. Badge starts **UNPUBLISHED**. Checklist: paid tier (met), partner scorecard (open until a warm intro lands on a partner with a scorecard signal), ledger started (open until any evidence is accepted).
3. **Publish target** is refused until every gate is green. A short reason fails with the domain message. A past date fails.
4. Drive the ledger, using the existing Plan 1–3 motions:
   - Accept `profile_complete` → ledger started is **Met**.
   - Warm-intro Priya Nair on `mortgage_path` (or any active panel partner whose scorecard is WATCH/STRONG). Partner scorecard is **Met**.
5. **Publish target** with date `2026-12-15` and reason `Ledger is live; partner scorecard supports a target.` Badge becomes **PUBLISHED**. The event is on the case ledger. Standard carve-outs are listed on the panel.

## 4. The client sees a target, not a guarantee

1. Sign in as **`client@example.com`** → the Bloggs case.
2. A card reads **Target completion date**, shows `2026-12-15`, says we are **working toward** that date, and lists carve-outs.
3. Confirm what is absent: the word guarantee, quality score, participation rate, criterion checklist, publish / amend / withdraw controls, playbook prose.

## 5. Amend and withdraw stay on the cockpit

1. Back as advisor. **Amend target** to `2027-01-20` with reason `Survey booked later than first assumed.` Badge becomes **AMENDED**. The portal card still shows, with the new date.
2. **Withdraw target** with reason `Client paused the purchase.` Badge becomes **WITHDRAWN**. The portal card disappears.
3. Publish again if eligibility still holds — status returns to **PUBLISHED**.

## 6. Marketing may say target, never guarantee

1. Sign out → `/`.
2. The homepage has a short **Targets, not promises** section. It names published target timelines and carve-outs, and it does not mention Rightmove, Zoopla, or a guarantee.
3. Footer disclosure still says portal dates are planning targets, subject to carve-outs, not a promise of a completion date.
4. `/start` and `/pricing` are unchanged. This is not a new funnel.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `ClientSlaCommitment` derived from ledger events + scorecard signals; advisor publish / amend / withdraw; cockpit checklist; portal target card + carve-outs; `hard_client_sla: true` on `ew` |
| **Stubbed** | Nothing new. Partner adapters and the inbound webhook stay Plan 5 stubs. |
| **Absent** | Marketing guarantees, Rightmove-style completion promises, Prisma SLA columns, a new stage, seller views, threads, marketplace, corridor SLA, S3, FCA AR, enabling the `au` stub |

## Automated verification

```bash
npm test -- tests/domain/client-sla.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/server/client-sla-policy.test.ts tests/server/client-sla-actions.test.ts tests/server/client-sla-portal.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
````

- [ ] **Step 2: Point the older demos at the new flag**

In `docs/superpowers/plans/demo-script-market-packs.md` section 1 step 4, replace the modules sentence with:

```md
4. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault` and `hard_client_sla` are **on**. `corridor_inbound` and `corridor_outbound` are **on for corridor packs only**; they stay **off** on `ew` and `au`. `chain_free_inventory` is buyer-side overlay data, not seller stock; `document_vault` is the paid E&W file store; `hard_client_sla` is published target timelines with carve-outs, not a marketing guarantee.
```

In section 6 step 2, replace the flags sentence with:

```md
2. `npm test -- tests/domain/market-pack-flags.test.ts` — `hard_client_sla` is on for `ew` only; corridor packs and the `au` stub stay off.
```

In `docs/superpowers/plans/demo-script-speed-rails.md` section 1 steps 2–3, say `hard_client_sla` is **on** for `ew` and **off** for `au`. Keep the sentence that speed rails being on does not guarantee a date. In any Absent row that still says "hard client SLAs", replace it with "marketing guarantees and Rightmove-style completion promises".

In `docs/superpowers/plans/demo-script-chain-free.md`:
- Section 1 title: **The module is on for ew; published dates are still targets**.
- Step 2: confirm `hard_client_sla` is **on** for `ew`.
- Step 4: confirm `hard_client_sla` is **off** on `au`.
- Step 5: add "Hard client SLA is Plan 9 — published targets with carve-outs, not a completion guarantee."
- Absent row: remove "hard client SLAs, guaranteed completion dates" and keep "seller listings / inventory, private seller–buyer introductions, Rightmove/Zoopla, open marketplace". Add "marketing guarantees".

In `docs/superpowers/plans/demo-script-document-vault.md` section 1 step 2, list `hard_client_sla` as **on** for `ew`. In the Absent row, remove "hard client SLAs" and keep "S3 / cloud storage, corridor vault, threads, seller views".

In `docs/superpowers/plans/demo-script-corridor-packs.md` section 1 step 3, list `hard_client_sla` as **on** for `ew`. Section 2 step 2 stays **off** on corridor packs.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/demo-script-client-sla.md docs/superpowers/plans/demo-script-market-packs.md docs/superpowers/plans/demo-script-speed-rails.md docs/superpowers/plans/demo-script-chain-free.md docs/superpowers/plans/demo-script-document-vault.md docs/superpowers/plans/demo-script-corridor-packs.md
git commit -m "docs: client SLA demo script and flag updates on older walkthroughs"
```

---

### Task 9: README and full verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–8. Seed logins unchanged.
- Produces: README module-toggle paragraph and a new Client SLA section. Full `npm test` and `npm run build` green.

- [ ] **Step 1: Update README**

In `README.md`, replace the module-toggles paragraph with:

```md
**Module toggles are data, not scattered ifs.** `MarketFlags` on the pack are read through
`isModuleEnabled`. The `ew` pack runs `fx_deposit`, `partner_speed_rails`,
`chain_free_inventory`, `document_vault` and `hard_client_sla`. The four corridor packs
(`au_uk`, `uk_au`, `us_uk`, `uk_us`) run `fx_deposit`, `corridor_inbound` and
`corridor_outbound`. `chain_free_inventory`, `partner_speed_rails`, `document_vault` and
`hard_client_sla` stay **ew-only**. Enforced by
`tests/domain/market-pack-flags.test.ts`.
```

In the Chain-free overlay section, change "hard client SLAs" in the **Not in this overlay** sentence to "seller inventory and marketplace matching" if that sentence still lists SLA as absent from chain-free (SLA now lives in its own section; chain-free still does not publish dates).

In the Document vault section, delete `hard_client_sla stays off.`

Add this section immediately after the Document vault section (before "Advisor operating IP"):

```md
## Client SLA overlay (published targets, post-proof)

Spec §5 / §9. After the stage engine and partner scorecards shipped, `ew` may turn
`hard_client_sla` on as **data**. That flag unlocks:

- `ClientSlaCommitment` on a case — `UNPUBLISHED` / `PUBLISHED` / `AMENDED` /
  `WITHDRAWN` — reconstructed from `CLIENT_SLA_*` ledger events. Publishing requires
  paid tier, a partner scorecard signal, and at least one accepted evidence kind.
- Advisor publish / amend / withdraw with a written reason and a calendar target date.
  Every live commitment carries the standard carve-out list (lender delay, survey
  defects, title/tenure packs, client inaction, events outside the pipeline).
- Cockpit publish panel (operating IP). Portal target card only when `PUBLISHED` or
  `AMENDED`. Copy says target / working toward / subject to carve-outs.
- A homepage hook. Paid orchestration remains the product. Marketing still forbids
  `guarantee`, Rightmove and Zoopla.

**Not in this overlay:** a promised or guaranteed completion date, a Prisma SLA
column, a new stage, seller views, threads, an open marketplace, corridor SLA,
S3, or FCA Appointed Representative status.

Walkthrough: [`docs/superpowers/plans/demo-script-client-sla.md`](docs/superpowers/plans/demo-script-client-sla.md).
```

- [ ] **Step 2: Full verification**

Run: `npm test`
Expected: PASS. Confirm specifically that `tests/domain/client-sla.test.ts`, `tests/domain/market-pack-flags.test.ts`, `tests/domain/ew-pack.test.ts`, `tests/domain/market-pack-inspector.test.ts`, `tests/domain/uk-au-pack.test.ts`, `tests/server/client-sla-policy.test.ts`, `tests/server/client-sla-actions.test.ts`, `tests/server/client-sla-portal.test.ts`, `tests/content/marketing-copy.test.ts`, `tests/domain/engine-country-agnostic.test.ts`, `tests/server/chain-free-policy.test.ts`, `tests/server/chain-free-portal.test.ts` and `tests/server/scorecards.test.ts` are green — those are the regression surfaces this plan edits or sits next to.

Run: `npm run build`
Expected: `✓ Compiled successfully` with no TypeScript errors.

Main started at 345 tests. This plan adds domain, policy, action, portal and marketing cases. The suite should land around 365–375 tests. If the count is lower, a describe was dropped; if it is much higher, an accidental extra file was committed.

- [ ] **Step 3: Manual smoke check**

`npm run dev`, then walk sections 1–6 of `docs/superpowers/plans/demo-script-client-sla.md`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the ew-only client SLA overlay as published targets"
```

---

## Self-review notes

**Spec coverage:**
- §2 hard completion guarantees are a v1 non-goal → Global Constraints + Task 1 copy tests + Task 7 `FORBIDDEN_CLAIM_PATTERNS` still applied to `CLIENT_SLA_HOOK`.
- §5 later promise of published target timelines with legal disclaimers (lender delay, survey defects, title packs, client inaction) → Task 1 `CLIENT_SLA_CARVE_OUTS` + `clientSlaTargetCopy`; Task 6 portal card lists those labels.
- §5 IP behind paid / free is a funnel → Task 1 `paid_tier` criterion and free-DIY copy guard; Task 5 checklist on cockpit only; Task 6 card only when published.
- §7 hard guarantees only after legal review of carve-outs → this plan publishes **targets** with boilerplate carve-outs; it does not add guarantee language or a legal-review workflow.
- §8 / §9 scorecards unlock speed credibility → Task 1 `partner_scorecard` + `ledger_started`; Task 3 `loadClientSla` reads referrals and `loadPanelScorecards`.
- §9 dependency rule → Task 2 turns `hard_client_sla` on for `ew` only after Plans 1–8; corridors and `au` stay off.
- §9 Phase 1/2 "soft published timelines" then optional hard guarantees → Plan 9 ships the published-target overlay. Copy never claims a hard guarantee.
- §10 country-agnostic engine → Task 1 adds `client-sla.ts` to `ENGINE_GLOBAL_FILES`; carve-out labels avoid leasehold / England / Wales.
- Non-goals honoured: no seller views, threads, marketplace, corridor SLA, vault-on-corridors, S3, FCA AR, or `au` stub enablement. `chain_free_inventory` and `partner_speed_rails` are not edited.

**Placeholder scan:** no TBD / TODO / "implement later" / "similar to Task N". Every new export is named in Task 1, Task 3 or Task 4 Interfaces and reused with the same spelling later.

**Type-consistency ledger:** `ClientSlaStatus` is the four-value union from Task 1; cockpit badge and portal copy use that union only. Event types are `CLIENT_SLA_PUBLISHED` / `CLIENT_SLA_AMENDED` / `CLIENT_SLA_WITHDRAWN` with payload `{ action, targetDate, reason }`. `LoadedClientSla` is the only server DTO and is created in the same task as `loadClientSla`. Publish/amend take `(caseId, targetDate, reason)`; withdraw takes `(caseId, reason)`. Actions return `{ ok: true } | { ok: false; error: string }`.

**Existing tests that must change, and why:** `market-pack-flags` (remove `GATED_MODULES`; add ew-only SLA test); inspector module row; `ew-pack` flags snapshot; `uk-au-pack` explicit off; marketing regulatory line + new hook describe; cockpit panel subtitle; older demo scripts that still say `hard_client_sla` is off. `warm-intro`, scorecard computation, vault, and chain-free domain tests are not edited.

**Deliberate non-migration:** cases persisted before this plan have no `CLIENT_SLA_*` events, so they stay `UNPUBLISHED` until an advisor publishes. YAGNI — no backfill.
