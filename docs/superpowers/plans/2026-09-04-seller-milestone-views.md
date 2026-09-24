# Seller Milestone Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a buyer-side, read-only seller-facing milestone summary derived from the existing buyer case ledger, plus advisor-export copy and an optional HMAC share link — without a seller login, inventory, listing feed, or private introduction.

**Architecture:** Four layers, no cycles. Same overlay shape as chain-free / client-SLA.

1. **Pure domain** (`src/domain/seller-milestones.ts`) — collapse each ledger stage to `NOT_STARTED` / `IN_PROGRESS` / `DONE`, reconstruct share issue/revoke from events, advisor export copy, public-facing copy. No Prisma, no Next.js, no jurisdiction literals, no HMAC secret.
2. **Market-local data** (`ew-config` flag only) — `seller_milestone_views: true` on `ew`. Corridor packs and the `au` stub stay off. No new stage and no playbook insert.
3. **Policy + token** (`src/server/seller-milestones.ts`) — fail-closed flag + paid-tier gate; HMAC share token (`caseId` + `SELLER_VIEW_SHARE_SECRET`); `loadCase` after verify. No Prisma share table.
4. **Surfaces** — cockpit preview + export + issue/revoke (operating IP); unauthenticated `/share/milestones/[caseId]/[signature]` showing public copy only.

**The invariant that makes this an overlay and not a seller product:** the summary is a projection of the buyer’s existing stage ledger. Advisors share it. There is no `SELLER` role, no seller inventory, no listing, and no introduction. The share page is read-only and names that we act for the buyer only.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3, Node `crypto` (server token only).

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§2 seller-side inventory is a v1 non-goal; §6 search stays external; §7 buyer-side orchestrator / no private seller–buyer introduction; §9 Phase 4 “seller views” after ledger proof).

**Builds on (already shipped, do not rebuild):**
- Plans 1–3 — stage ledger, portal, scorecards, referrals.
- Plan 4 — `MarketModuleKey` / `isModuleEnabled` / inspector.
- Plans 5–6 — speed rails and chain-free overlay. Do not import chain-free into seller-milestones.
- Plan 7 — corridor packs. This flag stays off on `au_uk` / `uk_au` / `us_uk` / `uk_us`.
- Plan 8 — document vault. Leave `document_vault` untouched.
- Plan 9 — `hard_client_sla` on for `ew`. Leave SLA copy and that flag untouched.
- Plan 10 — `case_threads` on for `ew`. Leave that flag untouched.

**Follow-on plans (not this plan):** open marketplace stub (Plan 12), corridor vault (Plan 13), S3 vault backend (Plan 14), seller login, inventory, agent/developer lead fees.

**Current main:** `c2437b7` was Plan 9. This plan assumes Plan 10 (`case_threads`) is also on `ew`. Do not edit shipped flags.

## Global Constraints

Copied from the spec and the Plan 11 brief. Every task’s requirements implicitly include this section.

- **Buyer-side orchestrator only:** §7 “avoid estate-agency activity (no private seller–buyer introduction for a fee in v1)”. No seller login, no `SELLER` role, no inventory, no listing feed, no private intro, no lead fee.
- **Read-only projection:** derive rows from `CaseState.stages`. Do not add a Prisma seller table, a seller participant, or a new stage.
- **Share is optional:** advisors may export copy without minting a link. A live HMAC link is an extra. Revoke is a ledger event, not a DB row.
- **Freemium / IP:** issue/revoke controls and the full export block are advisor-only. `FREE_DIY` never becomes shareable. The public page shows public copy only — no playbook, no partner names, no evidence kinds, no SLA dates, no vault files, no thread.
- **Fail closed:** overlay is off unless the resolved pack enables `seller_milestone_views` **and** the case is `PAID_DWY`. Unknown or disabled packs still throw `MarketPackError` at `casePack`; policy treats that as off.
- **Country-agnostic domain:** no jurisdiction literals (`£`, `GBP`, `en-GB`, `england`, `wales`) in `src/domain/seller-milestones.ts` or `src/server/seller-milestones.ts`. Stage titles come from the pack already on the case.
- **Leave shipped flags alone:** `document_vault`, `hard_client_sla`, `partner_speed_rails`, `chain_free_inventory`, and `case_threads` stay on for `ew` and off everywhere else.
- **No Prisma schema change.** Reconstruct share status from `CaseState.events`. `loadCase(caseId)` already exists for the public page after token verify.
- **Middleware stays portal/cockpit/partner.** `/share` is public on purpose.
- **Engineering:** TDD per task; server actions keep `{ ok: true } | { ok: false; error: string }` (issue may add `sharePath` on success only); `npm test` stays green after each task’s own files; `npm test` + `npm run build` pass at the end; DRY, YAGNI.

## Locked design decisions

**Flag matrix (final, after Task 2):**

| Pack | enabled | fx_deposit | corridor_inbound | corridor_outbound | partner_speed_rails | chain_free_inventory | hard_client_sla | document_vault | case_threads | seller_milestone_views |
|---|---|---|---|---|---|---|---|---|---|---|
| `au` | false | off | off | off | off | off | off | off | off | off |
| `ew` | true | on | off | off | on | on | on | on | on | **on** |
| `au_uk` | true | on | on | on | off | off | off | off | off | off |
| `uk_au` | true | on | on | on | off | off | off | off | off | off |
| `us_uk` | true | on | on | on | off | off | off | off | off | off |
| `uk_us` | true | on | on | on | off | off | off | off | off | off |

**Stage collapse:** `DONE` → `DONE`. `ACTIVE` or `BLOCKED` → `IN_PROGRESS`. `PENDING` or `SKIPPED` → `NOT_STARTED`. One row per case stage, pack order, pack titles. Never emit owner roles, partner firms, evidence kinds, or dates.

**Share states:** `NONE` | `LIVE` | `REVOKED`. Last `SELLER_VIEW_SHARE_ISSUED` / `SELLER_VIEW_SHARE_REVOKED` event wins. Module off or free tier forces `NONE` for policy even if stale events exist.

**Events:** payload `{ action: "ISSUE" | "REVOKE"; reason: string }`. `MIN_SELLER_SHARE_REASON_LENGTH = 8`. Advisor only.

**Token:** HMAC-SHA256 hex of `caseId` with `process.env.SELLER_VIEW_SHARE_SECRET` (tests/dev fallback `"dev-seller-view-secret"`). URL `/share/milestones/{caseId}/{signature}`. Verify signature, then `loadCase`, then require `canUseSellerMilestones` and `shareStatus === "LIVE"`. Wrong sig / revoked / free / module-off → `notFound()` (do not leak that the case exists).

**Public copy (locked strings):**
- Headline: `"Buyer progress on this purchase"`
- Body: `"This summary is shared by the buyer's advisor from the purchase ledger. We act for the buyer only. This is not a property listing, not a seller login, and not an introduction to the buyer."`

**Export copy:** same disclaimer, then one `- {title}: {state}` line per row, states printed `not started` / `in progress` / `done`.

## File structure (locked)

```
src/
  domain/
    seller-milestones.ts                       # NEW (Task 1)
    market-packs/
      types.ts                                 # MODIFY (Task 2): seller_milestone_views key
      ew-config.ts                             # MODIFY (Task 2): flag on
  server/
    seller-milestones.ts                       # NEW (Task 3): canUse / token / load / perform
    cockpit-policy.ts                          # MODIFY (Task 3): assertSellerMilestonesVisible
  app/
    actions/
      seller-milestones.ts                     # NEW (Task 4): issue / revoke
    cockpit/cases/[caseId]/page.tsx            # MODIFY (Task 5)
    share/milestones/[caseId]/[signature]/page.tsx  # NEW (Task 6)
    (marketing)/page.tsx                       # MODIFY (Task 7): hook section
  components/
    SellerMilestonePanel.tsx                   # NEW (Task 5)
    SellerMilestoneShareCard.tsx               # NEW (Task 6)
  content/
    marketing.ts                               # MODIFY (Task 7)
tests/
  domain/seller-milestones.test.ts             # NEW (Task 1)
  domain/engine-country-agnostic.test.ts       # MODIFY (Task 1)
  domain/market-pack-flags.test.ts             # MODIFY (Task 2)
  domain/market-pack-inspector.test.ts         # MODIFY (Task 2)
  domain/ew-pack.test.ts                       # MODIFY (Task 2)
  domain/uk-au-pack.test.ts                    # MODIFY (Task 2)
  server/seller-milestone-policy.test.ts       # NEW (Task 3)
  server/seller-milestone-actions.test.ts      # NEW (Task 4)
  server/seller-milestone-share.test.ts        # NEW (Task 6)
  content/marketing-copy.test.ts               # MODIFY (Task 7)
docs/superpowers/plans/
  demo-script-seller-milestones.md             # NEW (Task 8)
  demo-script-market-packs.md                  # MODIFY (Task 8)
  demo-script-chain-free.md                    # MODIFY (Task 8)
README.md                                      # MODIFY (Task 8)
```

**Layering rule:** `src/domain/seller-milestones.ts` imports only `./stage-engine` and `./types`. It must not import market packs, Prisma, Next, `crypto`, chain-free, vault, threads, or client-sla. `src/server/seller-milestones.ts` is the only module that combines `casePack`, HMAC, and `loadCase`. Actions never mint tokens except by calling server helpers.

---

### Task 1: Seller-milestone vocabulary, ledger projection, share events and copy

**Files:**
- Create: `src/domain/seller-milestones.ts`
- Create: `tests/domain/seller-milestones.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/domain/seller-milestones.ts"` to `ENGINE_GLOBAL_FILES` immediately after `"src/domain/threads.ts"`

**Interfaces:**
- Consumes: `CaseState`, `getFocusStage` from `src/domain/stage-engine.ts`; `ActorRole`, `StageStatus` from `src/domain/types.ts`.
- Produces: `SellerMilestoneState`, `SELLER_MILESTONE_STATES`, `isSellerMilestoneState`, `SellerShareStatus`, `SELLER_SHARE_STATUSES`, `isSellerShareStatus`, `SellerShareAction`, `SELLER_SHARE_ACTIONS`, `SELLER_VIEW_EVENT_TYPES`, `MIN_SELLER_SHARE_REASON_LENGTH`, `SellerMilestoneRow`, `SellerMilestoneSummary`, `SellerShareEventPayload`, `SellerFacingCopy`, `AdvisorSellerView`, `SellerMilestoneError`, `deriveSellerMilestoneState`, `encodeSellerSharePayload`, `decodeSellerSharePayload`, `shareStatusFromEvents`, `buildSellerMilestoneSummary`, `sellerFacingCopy`, `sellerExportCopy`, `advisorSellerView`, `applySellerShareAction`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/seller-milestones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCase, type CaseState } from "../../src/domain/stage-engine";
import {
  advisorSellerView,
  applySellerShareAction,
  buildSellerMilestoneSummary,
  decodeSellerSharePayload,
  deriveSellerMilestoneState,
  encodeSellerSharePayload,
  MIN_SELLER_SHARE_REASON_LENGTH,
  SellerMilestoneError,
  sellerExportCopy,
  sellerFacingCopy,
  shareStatusFromEvents,
} from "../../src/domain/seller-milestones";

function paid(id = "sm1"): CaseState {
  return createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
  });
}

function withStages(
  caseState: CaseState,
  statuses: Record<string, CaseState["stages"][number]["status"]>,
): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      status: statuses[stage.key] ?? stage.status,
    })),
  };
}

describe("stage collapse", () => {
  it("maps ledger statuses onto three seller-facing states", () => {
    expect(deriveSellerMilestoneState("DONE")).toBe("DONE");
    expect(deriveSellerMilestoneState("ACTIVE")).toBe("IN_PROGRESS");
    expect(deriveSellerMilestoneState("BLOCKED")).toBe("IN_PROGRESS");
    expect(deriveSellerMilestoneState("PENDING")).toBe("NOT_STARTED");
    expect(deriveSellerMilestoneState("SKIPPED")).toBe("NOT_STARTED");
  });
});

describe("summary from the buyer ledger", () => {
  it("returns empty rows and NONE when the module is off", () => {
    const summary = buildSellerMilestoneSummary({
      caseState: paid(),
      moduleEnabled: false,
    });
    expect(summary.moduleEnabled).toBe(false);
    expect(summary.shareStatus).toBe("NONE");
    expect(summary.rows).toEqual([]);
    expect(sellerFacingCopy(summary)).toBeNull();
    expect(sellerExportCopy(summary)).toBe("");
  });

  it("projects every stage title and collapsed state in pack order", () => {
    const caseState = withStages(paid(), {
      purchase_profile: "DONE",
      money_readiness: "ACTIVE",
      mortgage_path: "PENDING",
    });
    const summary = buildSellerMilestoneSummary({ caseState, moduleEnabled: true });
    expect(summary.rows[0]).toEqual({
      key: "purchase_profile",
      title: "Purchase profile",
      state: "DONE",
    });
    expect(summary.rows[1]).toMatchObject({
      key: "money_readiness",
      state: "IN_PROGRESS",
    });
    expect(summary.rows.find((row) => row.key === "mortgage_path")?.state).toBe("NOT_STARTED");
    expect(summary.rows.map((row) => row.key)).toEqual(caseState.stages.map((s) => s.key));
    expect(JSON.stringify(summary)).not.toMatch(/MORTGAGE_PARTNER|CONVEYANCER|source_of_funds|dip_aip/);
  });

  it("reconstructs LIVE then REVOKED from ledger events", () => {
    const issued = applySellerShareAction(paid(), {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(shareStatusFromEvents(issued.events)).toBe("LIVE");
    const revoked = applySellerShareAction(issued, {
      action: "REVOKE",
      reason: "Offer fell through; stop sharing",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(shareStatusFromEvents(revoked.events)).toBe("REVOKED");
    expect(buildSellerMilestoneSummary({ caseState: revoked, moduleEnabled: true }).shareStatus).toBe(
      "REVOKED",
    );
  });
});

describe("share actions", () => {
  it("refuses non-advisors, short reasons, module-off, and illegal transitions", () => {
    expect(() =>
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
        actorRole: "CLIENT",
        moduleEnabled: true,
      }),
    ).toThrow(SellerMilestoneError);
    expect(() =>
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "short",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
    ).toThrow(/at least 8/i);
    expect(MIN_SELLER_SHARE_REASON_LENGTH).toBe(8);
    expect(() =>
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
        actorRole: "ADVISOR",
        moduleEnabled: false,
      }),
    ).toThrow(/not enabled/i);
    expect(() =>
      applySellerShareAction(paid(), {
        action: "REVOKE",
        reason: "Nothing to revoke yet here",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
    ).toThrow(/nothing to revoke/i);

    const live = applySellerShareAction(paid(), {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(() =>
      applySellerShareAction(live, {
        action: "ISSUE",
        reason: "Already live on this case now",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
    ).toThrow(/already live/i);
  });

  it("allows re-issue after revoke and round-trips the payload", () => {
    const revoked = applySellerShareAction(
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
      {
        action: "REVOKE",
        reason: "Offer fell through; stop sharing",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      },
    );
    const again = applySellerShareAction(revoked, {
      action: "ISSUE",
      reason: "New agent asked for the same snapshot",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(shareStatusFromEvents(again.events)).toBe("LIVE");
    const payload = decodeSellerSharePayload(again.events.at(-1)?.payload);
    expect(payload).toEqual({
      action: "ISSUE",
      reason: "New agent asked for the same snapshot",
    });
    expect(decodeSellerSharePayload(encodeSellerSharePayload(payload!))).toEqual(payload);
  });
});

describe("copy", () => {
  it("exports a buyer-only disclaimer and never names inventory or an introduction", () => {
    const summary = buildSellerMilestoneSummary({
      caseState: withStages(paid(), { purchase_profile: "DONE" }),
      moduleEnabled: true,
    });
    const facing = sellerFacingCopy(summary);
    expect(facing?.headline).toBe("Buyer progress on this purchase");
    expect(facing?.body).toMatch(/buyer only/i);
    expect(facing?.body).toMatch(/not a property listing/i);
    expect(facing?.body).toMatch(/not an introduction/i);
    const exported = sellerExportCopy(summary);
    expect(exported).toMatch(/purchase profile: done/i);
    expect(exported).not.toMatch(/introduc|inventory|listing feed|seller login/i);
    const view = advisorSellerView(summary);
    expect(view.canIssueShare).toBe(true);
    expect(view.canRevokeShare).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/domain/seller-milestones.test.ts`

Expected: FAIL with `Cannot find module '../../src/domain/seller-milestones'`.

- [ ] **Step 3: Write the domain module**

Create `src/domain/seller-milestones.ts` with exactly the exports listed in Interfaces. Lock these rules:

```ts
import { getFocusStage, type CaseState } from "./stage-engine";
import type { ActorRole, StageStatus } from "./types";

export const SELLER_MILESTONE_STATES = ["NOT_STARTED", "IN_PROGRESS", "DONE"] as const;
export type SellerMilestoneState = (typeof SELLER_MILESTONE_STATES)[number];

export function isSellerMilestoneState(value: string): value is SellerMilestoneState {
  return (SELLER_MILESTONE_STATES as readonly string[]).includes(value);
}

export const SELLER_SHARE_STATUSES = ["NONE", "LIVE", "REVOKED"] as const;
export type SellerShareStatus = (typeof SELLER_SHARE_STATUSES)[number];

export function isSellerShareStatus(value: string): value is SellerShareStatus {
  return (SELLER_SHARE_STATUSES as readonly string[]).includes(value);
}

export const SELLER_SHARE_ACTIONS = ["ISSUE", "REVOKE"] as const;
export type SellerShareAction = (typeof SELLER_SHARE_ACTIONS)[number];

export const SELLER_VIEW_EVENT_TYPES = {
  ISSUED: "SELLER_VIEW_SHARE_ISSUED",
  REVOKED: "SELLER_VIEW_SHARE_REVOKED",
} as const;

export const MIN_SELLER_SHARE_REASON_LENGTH = 8;

export type SellerMilestoneRow = {
  key: string;
  title: string;
  state: SellerMilestoneState;
};

export type SellerMilestoneSummary = {
  moduleEnabled: boolean;
  shareStatus: SellerShareStatus;
  rows: SellerMilestoneRow[];
  focusStageKey: string | null;
};

export type SellerShareEventPayload = {
  action: SellerShareAction;
  reason: string;
};

export type SellerFacingCopy = {
  headline: string;
  body: string;
};

export type AdvisorSellerView = {
  summary: SellerMilestoneSummary;
  exportCopy: string;
  canIssueShare: boolean;
  canRevokeShare: boolean;
};

export class SellerMilestoneError extends Error {
  constructor(
    public code:
      | "MODULE_OFF"
      | "FORBIDDEN_ROLE"
      | "REASON_REQUIRED"
      | "ALREADY_LIVE"
      | "NOTHING_TO_REVOKE"
      | "ALREADY_REVOKED"
      | "SHARE_INACTIVE"
      | "INVALID_TOKEN",
    message: string,
  ) {
    super(message);
    this.name = "SellerMilestoneError";
  }
}

export function deriveSellerMilestoneState(status: StageStatus): SellerMilestoneState {
  if (status === "DONE") return "DONE";
  if (status === "ACTIVE" || status === "BLOCKED") return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function encodeSellerSharePayload(payload: SellerShareEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeSellerSharePayload(raw: string | undefined): SellerShareEventPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SellerShareEventPayload>;
    if (
      (parsed.action !== "ISSUE" && parsed.action !== "REVOKE") ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return { action: parsed.action, reason: parsed.reason };
  } catch {
    return null;
  }
}

export function shareStatusFromEvents(
  events: ReadonlyArray<{ type: string; payload?: string }>,
): SellerShareStatus {
  let status: SellerShareStatus = "NONE";
  for (const event of events) {
    if (event.type === SELLER_VIEW_EVENT_TYPES.ISSUED) status = "LIVE";
    if (event.type === SELLER_VIEW_EVENT_TYPES.REVOKED) status = "REVOKED";
  }
  return status;
}

export function buildSellerMilestoneSummary(input: {
  caseState: CaseState;
  moduleEnabled: boolean;
}): SellerMilestoneSummary {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      shareStatus: "NONE",
      rows: [],
      focusStageKey: null,
    };
  }
  return {
    moduleEnabled: true,
    shareStatus: shareStatusFromEvents(input.caseState.events),
    rows: input.caseState.stages.map((stage) => ({
      key: stage.key,
      title: stage.title,
      state: deriveSellerMilestoneState(stage.status),
    })),
    focusStageKey: getFocusStage(input.caseState)?.key ?? null,
  };
}

const FACING_HEADLINE = "Buyer progress on this purchase";
const FACING_BODY =
  "This summary is shared by the buyer's advisor from the purchase ledger. We act for the buyer only. This is not a property listing, not a seller login, and not an introduction to the buyer.";

const STATE_LABEL: Record<SellerMilestoneState, string> = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  DONE: "done",
};

export function sellerFacingCopy(summary: SellerMilestoneSummary): SellerFacingCopy | null {
  if (!summary.moduleEnabled) return null;
  return { headline: FACING_HEADLINE, body: FACING_BODY };
}

export function sellerExportCopy(summary: SellerMilestoneSummary): string {
  const facing = sellerFacingCopy(summary);
  if (!facing) return "";
  const lines = summary.rows.map((row) => `- ${row.title}: ${STATE_LABEL[row.state]}`);
  return [facing.headline, "", facing.body, "", ...lines].join("\n");
}

export function advisorSellerView(summary: SellerMilestoneSummary): AdvisorSellerView {
  return {
    summary,
    exportCopy: sellerExportCopy(summary),
    canIssueShare: summary.moduleEnabled && summary.shareStatus !== "LIVE",
    canRevokeShare: summary.moduleEnabled && summary.shareStatus === "LIVE",
  };
}

export function applySellerShareAction(
  caseState: CaseState,
  input: {
    action: SellerShareAction;
    reason: string;
    actorRole: ActorRole;
    moduleEnabled: boolean;
    now?: Date;
  },
): CaseState {
  if (input.actorRole !== "ADVISOR") {
    throw new SellerMilestoneError(
      "FORBIDDEN_ROLE",
      "Only an advisor may issue or revoke a seller milestone share",
    );
  }
  const reason = input.reason.trim();
  if (reason.length < MIN_SELLER_SHARE_REASON_LENGTH) {
    throw new SellerMilestoneError(
      "REASON_REQUIRED",
      `A reason of at least ${MIN_SELLER_SHARE_REASON_LENGTH} characters is required`,
    );
  }
  if (!input.moduleEnabled) {
    throw new SellerMilestoneError("MODULE_OFF", "Seller milestone views are not enabled for this case");
  }

  const current = shareStatusFromEvents(caseState.events);
  if (input.action === "ISSUE" && current === "LIVE") {
    throw new SellerMilestoneError("ALREADY_LIVE", "A seller milestone share is already live");
  }
  if (input.action === "REVOKE" && current === "NONE") {
    throw new SellerMilestoneError("NOTHING_TO_REVOKE", "Nothing to revoke");
  }
  if (input.action === "REVOKE" && current === "REVOKED") {
    throw new SellerMilestoneError("ALREADY_REVOKED", "Seller milestone share is already revoked");
  }

  const focus = getFocusStage(caseState);
  const stageKey = focus?.key ?? caseState.stages[0]?.key ?? "unknown";
  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type:
          input.action === "ISSUE"
            ? SELLER_VIEW_EVENT_TYPES.ISSUED
            : SELLER_VIEW_EVENT_TYPES.REVOKED,
        stageKey,
        actorRole: input.actorRole,
        at: (input.now ?? new Date()).toISOString(),
        payload: encodeSellerSharePayload({ action: input.action, reason }),
      },
    ],
  };
}
```

Add `"src/domain/seller-milestones.ts"` to `ENGINE_GLOBAL_FILES` in `tests/domain/engine-country-agnostic.test.ts`. Do not put `£`, `GBP`, `en-GB`, `england` or `wales` in the new file.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/domain/seller-milestones.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/seller-milestones.ts tests/domain/seller-milestones.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: derive seller milestone summary from the buyer ledger"
```

---

### Task 2: `seller_milestone_views` module flag on England & Wales only

**Files:**
- Modify: `src/domain/market-packs/types.ts` — append `"seller_milestone_views"` to `MarketModuleKey` and `MARKET_MODULE_KEYS`
- Modify: `src/domain/market-packs/ew-config.ts` — `seller_milestone_views: true` and a one-line comment
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-inspector.test.ts`
- Modify: `tests/domain/ew-pack.test.ts`
- Modify: `tests/domain/uk-au-pack.test.ts`

**Interfaces:**
- Consumes: existing `MarketModuleKey` / `isModuleEnabled` / pack flag objects from Plans 4–10.
- Produces: `MarketModuleKey` includes `"seller_milestone_views"`; `EW_FLAGS.seller_milestone_views === true`; every other registered pack resolves the key as off.

- [ ] **Step 1: Write the failing flag tests**

In `tests/domain/market-pack-flags.test.ts`, add this block after the case-thread example:

```ts
  it("runs seller milestone views in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "seller_milestone_views"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "seller_milestone_views"),
    ).toBe(false);
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au_uk")!.flags, "seller_milestone_views"),
    ).toBe(false);
    expect(isModuleEnabled(EW_FLAGS, "seller_milestone_views")).toBe(true);
  });
```

In `tests/domain/market-pack-inspector.test.ts`, inside the “lists every module” example, add:

```ts
    expect(summary.modules.find((m) => m.key === "seller_milestone_views")?.enabled).toBe(true);
```

and inside the corridor summary example, add:

```ts
    expect(inbound.modules.find((m) => m.key === "seller_milestone_views")?.enabled).toBe(false);
```

In `tests/domain/ew-pack.test.ts`, change the flags snapshot to:

```ts
    expect(ewMarketPack.flags).toEqual({
      fx_deposit: true,
      partner_speed_rails: true,
      chain_free_inventory: true,
      document_vault: true,
      hard_client_sla: true,
      case_threads: true,
      seller_milestone_views: true,
    });
```

In `tests/domain/uk-au-pack.test.ts`, after the existing `document_vault` assertion, add:

```ts
    expect(isModuleEnabled(ukAuMarketPack.flags, "seller_milestone_views")).toBe(false);
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/uk-au-pack.test.ts`

Expected: FAIL — `"seller_milestone_views"` is not assignable to `MarketModuleKey`, and/or the `ew` flags snapshot does not contain `seller_milestone_views: true`.

- [ ] **Step 3: Add the key and turn it on for `ew` only**

In `src/domain/market-packs/types.ts`, append the key. Do not reorder existing keys:

```ts
export type MarketModuleKey =
  | "fx_deposit"
  | "corridor_inbound"
  | "corridor_outbound"
  | "chain_free_inventory"
  | "hard_client_sla"
  | "document_vault"
  | "partner_speed_rails"
  | "case_threads"
  | "seller_milestone_views";

export const MARKET_MODULE_KEYS: readonly MarketModuleKey[] = [
  "fx_deposit",
  "corridor_inbound",
  "corridor_outbound",
  "chain_free_inventory",
  "hard_client_sla",
  "document_vault",
  "partner_speed_rails",
  "case_threads",
  "seller_milestone_views",
];
```

In `src/domain/market-packs/ew-config.ts`, extend the comment and flags:

```ts
/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are
 * adapter plumbing. Spec §13 sub-project 6: chain_free_inventory is on as
 * buyer-side certification/matching data — not seller listings. Spec §8:
 * document_vault is on for ew only. Spec §5/§9: hard_client_sla is on for ew
 * only as published target timelines with legal carve-outs — not a marketing
 * guarantee. Spec §8: case_threads is on for ew only as the append-only
 * multi-party case thread. Spec §9 Phase 4: seller_milestone_views is on for
 * ew only as a read-only buyer-ledger projection — not a seller login or
 * inventory product.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
  chain_free_inventory: true,
  document_vault: true,
  hard_client_sla: true,
  case_threads: true,
  seller_milestone_views: true,
};
```

Do **not** add `seller_milestone_views` to corridor configs or `au-stub`. A missing key is off.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/uk-au-pack.test.ts`

Expected: PASS. `ew` is the only pack with `seller_milestone_views` on.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/types.ts src/domain/market-packs/ew-config.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/ew-pack.test.ts tests/domain/uk-au-pack.test.ts
git commit -m "feat: enable seller_milestone_views for England and Wales only"
```

---

### Task 3: Fail-closed policy, HMAC token, and load

**Files:**
- Create: `src/server/seller-milestones.ts`
- Modify: `src/server/cockpit-policy.ts` — add `assertSellerMilestonesVisible`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/server/seller-milestones.ts"` to `ENGINE_GLOBAL_FILES`
- Create: `tests/server/seller-milestone-policy.test.ts`

**Interfaces:**
- Consumes: domain exports from Task 1; `isModuleEnabled` / `casePack`; `createHmac` from `node:crypto`.
- Produces: `canUseSellerMilestones(caseState: CaseState): boolean`, `assertSellerMilestonesEnabled(caseState: CaseState): void`, `sellerViewShareSecret(): string`, `signSellerShare(caseId: string, secret?: string): string`, `verifySellerShare(caseId: string, signature: string, secret?: string): boolean`, `sellerSharePath(caseId: string, signature: string): string`, `loadSellerMilestoneView(caseState: CaseState): AdvisorSellerView`, `performSellerShareAction(caseState, { action, reason, now? }): CaseState`, `assertSellerMilestonesVisible(viewerRole: ActorRole): void`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/seller-milestone-policy.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { SellerMilestoneError } from "../../src/domain/seller-milestones";
import { CockpitPolicyError } from "../../src/server/cockpit-policy";
import {
  assertSellerMilestonesEnabled,
  canUseSellerMilestones,
  loadSellerMilestoneView,
  performSellerShareAction,
  sellerSharePath,
  sellerViewShareSecret,
  signSellerShare,
  verifySellerShare,
} from "../../src/server/seller-milestones";
import { assertSellerMilestonesVisible } from "../../src/server/cockpit-policy";

function paid(id = "smp1") {
  return createCase({ id, entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("seller milestone module gate", () => {
  it("is open for paid England & Wales and closed otherwise", () => {
    expect(canUseSellerMilestones(paid())).toBe(true);
    expect(canUseSellerMilestones({ ...paid(), marketPackId: "au_uk" })).toBe(false);
    expect(canUseSellerMilestones({ ...paid("smp2"), tier: "FREE_DIY" })).toBe(false);
    expect(() => assertSellerMilestonesEnabled(paid())).not.toThrow();
    expect(() => assertSellerMilestonesEnabled({ ...paid(), marketPackId: "au_uk" })).toThrow(
      SellerMilestoneError,
    );
  });
});

describe("HMAC share token", () => {
  it("signs caseId and rejects a tampered signature", () => {
    const secret = sellerViewShareSecret();
    const signature = signSellerShare("smp1", secret);
    expect(signature).toBe(createHmac("sha256", secret).update("smp1").digest("hex"));
    expect(verifySellerShare("smp1", signature, secret)).toBe(true);
    expect(verifySellerShare("smp1", "ab".repeat(32), secret)).toBe(false);
    expect(verifySellerShare("other", signature, secret)).toBe(false);
    expect(sellerSharePath("smp1", signature)).toBe(`/share/milestones/smp1/${signature}`);
  });
});

describe("load and perform", () => {
  it("builds the advisor view and issues a share only when the gate is open", () => {
    const view = loadSellerMilestoneView(paid());
    expect(view.summary.rows.length).toBeGreaterThan(0);
    expect(view.canIssueShare).toBe(true);
    const live = performSellerShareAction(paid(), {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
    });
    expect(loadSellerMilestoneView(live).canRevokeShare).toBe(true);
    expect(() =>
      performSellerShareAction({ ...paid(), marketPackId: "au_uk" }, {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
      }),
    ).toThrow(SellerMilestoneError);
  });
});

describe("cockpit visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertSellerMilestonesVisible("ADVISOR")).not.toThrow();
    expect(() => assertSellerMilestonesVisible("CLIENT")).toThrow(CockpitPolicyError);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/seller-milestone-policy.test.ts`

Expected: FAIL with `Cannot find module '../../src/server/seller-milestones'`.

- [ ] **Step 3: Implement policy and token helpers**

Create `src/server/seller-milestones.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { isModuleEnabled } from "../domain/market-packs/types";
import {
  advisorSellerView,
  applySellerShareAction,
  buildSellerMilestoneSummary,
  SellerMilestoneError,
  type AdvisorSellerView,
  type SellerShareAction,
} from "../domain/seller-milestones";
import type { CaseState } from "../domain/stage-engine";
import { casePack } from "../lib/case-pack";

export function canUseSellerMilestones(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "seller_milestone_views");
  } catch {
    return false;
  }
}

export function assertSellerMilestonesEnabled(caseState: CaseState): void {
  if (!canUseSellerMilestones(caseState)) {
    throw new SellerMilestoneError(
      "MODULE_OFF",
      `Seller milestone views are not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export function sellerViewShareSecret(): string {
  return process.env.SELLER_VIEW_SHARE_SECRET ?? "dev-seller-view-secret";
}

export function signSellerShare(caseId: string, secret: string = sellerViewShareSecret()): string {
  return createHmac("sha256", secret).update(caseId).digest("hex");
}

export function verifySellerShare(
  caseId: string,
  signature: string,
  secret: string = sellerViewShareSecret(),
): boolean {
  const expected = signSellerShare(caseId, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function sellerSharePath(caseId: string, signature: string): string {
  return `/share/milestones/${caseId}/${signature}`;
}

export function loadSellerMilestoneView(caseState: CaseState): AdvisorSellerView {
  return advisorSellerView(
    buildSellerMilestoneSummary({
      caseState,
      moduleEnabled: canUseSellerMilestones(caseState),
    }),
  );
}

export function performSellerShareAction(
  caseState: CaseState,
  input: { action: SellerShareAction; reason: string; now?: Date },
): CaseState {
  assertSellerMilestonesEnabled(caseState);
  return applySellerShareAction(caseState, {
    action: input.action,
    reason: input.reason,
    actorRole: "ADVISOR",
    moduleEnabled: true,
    now: input.now,
  });
}
```

Append to `src/server/cockpit-policy.ts`:

```ts
export function assertSellerMilestonesVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "Seller milestone share controls are advisor-only operating IP",
    );
  }
}
```

Add `"src/server/seller-milestones.ts"` to `ENGINE_GLOBAL_FILES`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/seller-milestone-policy.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seller-milestones.ts src/server/cockpit-policy.ts tests/server/seller-milestone-policy.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: gate seller milestone views and sign optional share tokens"
```

---

### Task 4: Advisor issue / revoke server actions

**Files:**
- Create: `src/app/actions/seller-milestones.ts`
- Create: `tests/server/seller-milestone-actions.test.ts`

**Interfaces:**
- Consumes: `performSellerShareAction`, `signSellerShare`, `sellerSharePath`, `loadCaseForUser`, `saveCase`.
- Produces: `issueSellerShareAction(caseId: string, reason: string): Promise<{ ok: true; sharePath: string } | { ok: false; error: string }>`, `revokeSellerShareAction(caseId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/seller-milestone-actions.test.ts`. This is a source-shape test (same style as `tests/server/vault-ui.test.ts` / chain-free actions) plus a direct perform check:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { performSellerShareAction, sellerSharePath, signSellerShare } from "../../src/server/seller-milestones";

const source = readFileSync(
  path.resolve(process.cwd(), "src/app/actions/seller-milestones.ts"),
  "utf8",
);

describe("seller milestone actions", () => {
  it("are advisor-only mutations that persist through saveCase", () => {
    expect(source).toMatch(/export async function issueSellerShareAction/);
    expect(source).toMatch(/export async function revokeSellerShareAction/);
    expect(source).toMatch(/role !== "ADVISOR"/);
    expect(source).toMatch(/performSellerShareAction/);
    expect(source).toMatch(/saveCase/);
    expect(source).toMatch(/sharePath/);
    expect(source).not.toMatch(/SELLER_ROLE|"SELLER"/);
  });

  it("returns the signed path after a live issue", () => {
    const caseState = createCase({
      id: "sma1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    const live = performSellerShareAction(caseState, {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
    });
    expect(live.events.some((event) => event.type === "SELLER_VIEW_SHARE_ISSUED")).toBe(true);
    expect(sellerSharePath("sma1", signSellerShare("sma1"))).toMatch(/^\/share\/milestones\/sma1\//);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/seller-milestone-actions.test.ts`

Expected: FAIL — `src/app/actions/seller-milestones.ts` does not exist.

- [ ] **Step 3: Implement the actions**

Create `src/app/actions/seller-milestones.ts`:

```ts
"use server";

import { SellerMilestoneError } from "@/domain/seller-milestones";
import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import {
  performSellerShareAction,
  sellerSharePath,
  signSellerShare,
} from "@/server/seller-milestones";
import { revalidatePath } from "next/cache";

export type SellerShareIssueResult =
  | { ok: true; sharePath: string }
  | { ok: false; error: string };
export type SellerShareRevokeResult = { ok: true } | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof SellerMilestoneError ||
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
}

export async function issueSellerShareAction(
  caseId: string,
  reason: string,
): Promise<SellerShareIssueResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) return authResult;
  try {
    const caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const next = performSellerShareAction(caseState, { action: "ISSUE", reason });
    await saveCase(next);
    revalidateCasePaths(caseId);
    return { ok: true, sharePath: sellerSharePath(caseId, signSellerShare(caseId)) };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function revokeSellerShareAction(
  caseId: string,
  reason: string,
): Promise<SellerShareRevokeResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) return authResult;
  try {
    const caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    const next = performSellerShareAction(caseState, { action: "REVOKE", reason });
    await saveCase(next);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/seller-milestone-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/seller-milestones.ts tests/server/seller-milestone-actions.test.ts
git commit -m "feat: add advisor actions to issue and revoke seller milestone shares"
```

---

### Task 5: Cockpit preview, export copy, and share controls

**Files:**
- Create: `src/components/SellerMilestonePanel.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx`

**Interfaces:**
- Consumes: `AdvisorSellerView`, `issueSellerShareAction`, `revokeSellerShareAction`, `assertSellerMilestonesVisible`, `canUseSellerMilestones`, `loadSellerMilestoneView`, `signSellerShare`, `sellerSharePath`.
- Produces: advisor-only panel that lists rows, a read-only export `<textarea>`, issue/revoke forms, and the live path when `shareStatus === "LIVE"`.

- [ ] **Step 1: Write the failing UI-shape test**

Add `tests/server/seller-milestone-ui.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cockpit = readFileSync(
  path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
  "utf8",
);
const panel = readFileSync(
  path.resolve(process.cwd(), "src/components/SellerMilestonePanel.tsx"),
  "utf8",
);

describe("seller milestone cockpit surface", () => {
  it("renders the advisor panel only when the overlay is on", () => {
    expect(cockpit).toMatch(/canUseSellerMilestones/);
    expect(cockpit).toMatch(/SellerMilestonePanel/);
    expect(cockpit).toMatch(/assertSellerMilestonesVisible/);
    expect(panel).toMatch(/issueSellerShareAction/);
    expect(panel).toMatch(/revokeSellerShareAction/);
    expect(panel).toMatch(/exportCopy/);
    expect(panel).not.toMatch(/seller login|inventory|introduce the buyer/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/server/seller-milestone-ui.test.ts`

Expected: FAIL — `SellerMilestonePanel.tsx` does not exist and the cockpit page does not import it.

- [ ] **Step 3: Implement the panel and mount it**

Create `src/components/SellerMilestonePanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  issueSellerShareAction,
  revokeSellerShareAction,
} from "@/app/actions/seller-milestones";
import type { AdvisorSellerView } from "@/domain/seller-milestones";

const STATE_LABEL = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  DONE: "done",
} as const;

type Props = {
  caseId: string;
  view: AdvisorSellerView;
  sharePath: string | null;
};

export function SellerMilestonePanel({ caseId, view, sharePath }: Props) {
  const [issueReason, setIssueReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(sharePath);

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Seller milestone view</h2>
      <p className="mt-1 text-sm text-slate-600">
        Read-only buyer-ledger projection. Not a listing and not an introduction.
      </p>
      <p className="mt-2 text-xs uppercase text-slate-500">Share {view.summary.shareStatus}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-700">
        {view.summary.rows.map((row) => (
          <li key={row.key}>
            {row.title}: {STATE_LABEL[row.state]}
          </li>
        ))}
      </ul>
      <label className="mt-4 block text-xs uppercase text-slate-500">
        Advisor export copy
        <textarea
          readOnly
          value={view.exportCopy}
          className="mt-1 h-40 w-full rounded border border-slate-300 p-2 text-sm text-slate-800"
        />
      </label>
      {path && (
        <p className="mt-3 text-sm text-slate-700">
          Live share path: <code>{path}</code>
        </p>
      )}
      {view.canIssueShare && (
        <form
          className="mt-4 space-y-2"
          action={async (formData) => {
            const result = await issueSellerShareAction(
              caseId,
              String(formData.get("reason") ?? ""),
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            setPath(result.sharePath);
            setIssueReason("");
          }}
        >
          <input
            name="reason"
            value={issueReason}
            onChange={(event) => setIssueReason(event.target.value)}
            placeholder="Why share this snapshot?"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
          >
            Issue share link
          </button>
        </form>
      )}
      {view.canRevokeShare && (
        <form
          className="mt-4 space-y-2"
          action={async (formData) => {
            const result = await revokeSellerShareAction(
              caseId,
              String(formData.get("reason") ?? ""),
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            setPath(null);
            setRevokeReason("");
          }}
        >
          <input
            name="reason"
            value={revokeReason}
            onChange={(event) => setRevokeReason(event.target.value)}
            placeholder="Why revoke this share?"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1 text-sm"
          >
            Revoke share link
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
```

In `src/app/cockpit/cases/[caseId]/page.tsx`:

1. Import `SellerMilestonePanel` from `@/components/SellerMilestonePanel`.
2. Import `assertSellerMilestonesVisible` from `@/server/cockpit-policy`.
3. Import `canUseSellerMilestones`, `loadSellerMilestoneView`, `sellerSharePath`, `signSellerShare` from `@/server/seller-milestones`.
4. After the client-SLA block (the `clientSlaView` assignment), add:

```ts
  assertSellerMilestonesVisible("ADVISOR");
  const sellerViewEnabled = canUseSellerMilestones(caseState);
  const sellerView = sellerViewEnabled ? loadSellerMilestoneView(caseState) : null;
  const sellerSharePathValue =
    sellerView?.summary.shareStatus === "LIVE"
      ? sellerSharePath(caseId, signSellerShare(caseId))
      : null;
```

5. In the JSX, immediately after `{clientSlaView && ( <ClientSlaPublishPanel ... /> )}`. insert:

```tsx
      {sellerView && (
        <SellerMilestonePanel
          caseId={caseId}
          view={sellerView}
          sharePath={sellerSharePathValue}
        />
      )}
```

Do not add a seller login, a partner directory of agents, or a listing form.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/seller-milestone-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SellerMilestonePanel.tsx src/app/cockpit/cases/[caseId]/page.tsx tests/server/seller-milestone-ui.test.ts
git commit -m "feat: show advisor seller-milestone export and share controls"
```

---

### Task 6: Public share page (no seller login)

**Files:**
- Create: `src/components/SellerMilestoneShareCard.tsx`
- Create: `src/app/share/milestones/[caseId]/[signature]/page.tsx`
- Create: `tests/server/seller-milestone-share.test.ts`

**Interfaces:**
- Consumes: `verifySellerShare`, `canUseSellerMilestones`, `buildSellerMilestoneSummary`, `sellerFacingCopy`, `loadCase`.
- Produces: unauthenticated page that renders `SellerFacingCopy` + rows when the signature is valid **and** share status is `LIVE`. Otherwise `notFound()`. Middleware matcher is unchanged.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/seller-milestone-share.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import {
  buildSellerMilestoneSummary,
  sellerFacingCopy,
} from "../../src/domain/seller-milestones";
import { performSellerShareAction } from "../../src/server/seller-milestones";

const page = readFileSync(
  path.resolve(process.cwd(), "src/app/share/milestones/[caseId]/[signature]/page.tsx"),
  "utf8",
);
const card = readFileSync(
  path.resolve(process.cwd(), "src/components/SellerMilestoneShareCard.tsx"),
  "utf8",
);
const middleware = readFileSync(path.resolve(process.cwd(), "src/middleware.ts"), "utf8");

describe("public seller milestone share page", () => {
  it("is an unauthenticated read-only projection", () => {
    expect(page).toMatch(/verifySellerShare/);
    expect(page).toMatch(/loadCase/);
    expect(page).toMatch(/notFound/);
    expect(page).not.toMatch(/auth\(/);
    expect(page).not.toMatch(/login|password|SELLER/);
    expect(card).toMatch(/Buyer progress on this purchase/);
    expect(card).toMatch(/not an introduction/);
    expect(middleware).toMatch(/\/portal\/:path\*/);
    expect(middleware).not.toMatch(/\/share/);
  });

  it("hides public copy unless the share is live", () => {
    const paid = createCase({
      id: "sms1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(sellerFacingCopy(buildSellerMilestoneSummary({ caseState: paid, moduleEnabled: true }))).not.toBeNull();
    const live = performSellerShareAction(paid, {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
    });
    expect(buildSellerMilestoneSummary({ caseState: live, moduleEnabled: true }).shareStatus).toBe("LIVE");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/seller-milestone-share.test.ts`

Expected: FAIL — the share page file does not exist.

- [ ] **Step 3: Implement the public page**

Create `src/components/SellerMilestoneShareCard.tsx`:

```tsx
import type { SellerFacingCopy, SellerMilestoneRow } from "@/domain/seller-milestones";

const STATE_LABEL = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  DONE: "done",
} as const;

type Props = {
  copy: SellerFacingCopy;
  rows: SellerMilestoneRow[];
};

export function SellerMilestoneShareCard({ copy, rows }: Props) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">{copy.headline}</h1>
      <p className="mt-3 text-sm text-slate-600">{copy.body}</p>
      <ul className="mt-6 space-y-2 text-sm text-slate-800">
        {rows.map((row) => (
          <li key={row.key} className="flex justify-between border-b border-slate-100 py-2">
            <span>{row.title}</span>
            <span className="text-slate-500">{STATE_LABEL[row.state]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `src/app/share/milestones/[caseId]/[signature]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { SellerMilestoneShareCard } from "@/components/SellerMilestoneShareCard";
import {
  buildSellerMilestoneSummary,
  sellerFacingCopy,
} from "@/domain/seller-milestones";
import { loadCase } from "@/server/cases";
import {
  canUseSellerMilestones,
  verifySellerShare,
} from "@/server/seller-milestones";

type Props = {
  params: Promise<{ caseId: string; signature: string }>;
};

export default async function SellerMilestoneSharePage({ params }: Props) {
  const { caseId, signature } = await params;
  if (!verifySellerShare(caseId, signature)) {
    notFound();
  }

  let caseState;
  try {
    caseState = await loadCase(caseId);
  } catch {
    notFound();
  }

  if (!canUseSellerMilestones(caseState)) {
    notFound();
  }

  const summary = buildSellerMilestoneSummary({
    caseState,
    moduleEnabled: true,
  });
  const copy = sellerFacingCopy(summary);
  if (!copy || summary.shareStatus !== "LIVE") {
    notFound();
  }

  return <SellerMilestoneShareCard copy={copy} rows={summary.rows} />;
}
```

Do **not** change `src/middleware.ts`. `/share` is already outside the matcher.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/seller-milestone-share.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SellerMilestoneShareCard.tsx src/app/share/milestones/[caseId]/[signature]/page.tsx tests/server/seller-milestone-share.test.ts
git commit -m "feat: add unauthenticated seller milestone share page"
```

---

### Task 7: Marketing hook and inventory discipline

**Files:**
- Modify: `src/content/marketing.ts` — add `SELLER_VIEW_HOOK`; include it in `marketingClaimStrings`
- Modify: `src/app/(marketing)/page.tsx` — render the hook after `CASE_THREAD_HOOK` (or after `CLIENT_SLA_HOOK` if the thread hook is not on the homepage)
- Modify: `tests/content/marketing-copy.test.ts`

**Interfaces:**
- Consumes: existing `FORBIDDEN_INVENTORY_PATTERNS` / `FORBIDDEN_CLAIM_PATTERNS`.
- Produces: `SELLER_VIEW_HOOK = { eyebrow, headline, body }` that names a buyer-ledger snapshot and forbids inventory / intro / seller-login language.

- [ ] **Step 1: Write the failing marketing tests**

Add this import to `tests/content/marketing-copy.test.ts`: `SELLER_VIEW_HOOK`.

Add this describe block after the case-thread hook tests:

```ts
describe("seller milestone hook is a buyer ledger snapshot", () => {
  it("names advisor-shared buyer progress without inventory or introductions", () => {
    const blob = `${SELLER_VIEW_HOOK.eyebrow} ${SELLER_VIEW_HOOK.headline} ${SELLER_VIEW_HOOK.body}`;
    expect(blob).toMatch(/buyer/i);
    expect(blob).toMatch(/ledger|progress/i);
    expect(blob).toMatch(/advisor/i);
    expect(blob).not.toMatch(/seller login/i);
    expect(blob).not.toMatch(/inventory|listing feed/i);
    expect(blob.replace(/not an introduction/gi, "")).not.toMatch(/introduc/i);
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
    for (const pattern of FORBIDDEN_INVENTORY_PATTERNS) {
      expect(pattern.test(blob), `${pattern} matched hook`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: FAIL — `SELLER_VIEW_HOOK` is not exported.

- [ ] **Step 3: Add the hook and render it**

In `src/content/marketing.ts`, after `CASE_THREAD_HOOK`:

```ts
export const SELLER_VIEW_HOOK = {
  eyebrow: "Buyer progress, shared by the advisor",
  headline: "A milestone snapshot from the purchase ledger.",
  body: "When it helps a sale, your advisor can share a read-only view of buyer-side progress. We act for the buyer only. This is not a seller login, not a listing, and not an introduction.",
};
```

Append these three strings to `marketingClaimStrings()`:

```ts
    SELLER_VIEW_HOOK.eyebrow,
    SELLER_VIEW_HOOK.headline,
    SELLER_VIEW_HOOK.body,
```

On `src/app/(marketing)/page.tsx`, add `SELLER_VIEW_HOOK` to the content import. Immediately after the `CASE_THREAD_HOOK` section, insert:

```tsx
      <section className="mt-16 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {SELLER_VIEW_HOOK.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {SELLER_VIEW_HOOK.headline}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{SELLER_VIEW_HOOK.body}</p>
      </section>
```

Do not add a “browse listings” or “talk to a seller” CTA.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/marketing.ts src/app/(marketing)/page.tsx tests/content/marketing-copy.test.ts
git commit -m "feat: add marketing hook for advisor-shared buyer milestone views"
```

---

### Task 8: Demo script and README

**Files:**
- Create: `docs/superpowers/plans/demo-script-seller-milestones.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md` — list `seller_milestone_views` as **on** for `ew`
- Modify: `docs/superpowers/plans/demo-script-chain-free.md` — Absent row keeps inventory / private intros; add “seller login / inventory product still absent”
- Modify: `README.md` — new “Seller milestone views” section after Client SLA / threads

**Interfaces:**
- Produces: a founder click-script that states what is real (ew-only flag, ledger projection, export copy, optional HMAC share, revoke) and what is absent (seller login, inventory, introductions, corridor flag, Prisma share table).

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-seller-milestones.md`:

```md
# Seller milestone views demo script

Founder validation script for spec §9 Phase 4 **seller views** as a buyer-side overlay: England & Wales advisors can export or optionally share a read-only milestone snapshot derived from the buyer case ledger. There is still no seller login, inventory, or introduction.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The flag is ew-only

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla`, `case_threads` and `seller_milestone_views` are **on**.
3. Select **`au_uk`**. `seller_milestone_views` is **off**. Repeat for `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub.

## 2. Free DIY cannot share

1. Open **Smith DIY journey**. There is no Seller milestone view panel (or issue is refused).
2. Sign in as **`client@example.com`** → Smith. There is no public share control and no seller login.

## 3. Paid advisor: export without a link

1. As advisor, open **Bloggs return (paid)**.
2. **Seller milestone view** lists every stage as not started / in progress / done from the ledger.
3. The export textarea contains the buyer-only disclaimer and those rows. Copy it. There is still no share path until you issue one.

## 4. Optional share link, then revoke

1. Issue with reason `Agent asked for a progress snapshot`.
2. The live path `/share/milestones/<caseId>/<signature>` appears.
3. Open that URL in a private window — no login. Headline is **Buyer progress on this purchase**. The page says we act for the buyer only and that this is not a listing or an introduction.
4. Revoke with reason `Offer fell through; stop sharing`. Refresh the private window — 404.
5. A wrong signature also 404s.

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | ew-only flag; ledger-derived rows; advisor export copy; HMAC share; revoke event; public read-only page |
| **Stubbed** | Share secret falls back to `dev-seller-view-secret` when `SELLER_VIEW_SHARE_SECRET` is unset |
| **Absent** | Seller login, seller role, inventory, listing feed, private introduction, corridor flag, Prisma share table, S3 |

## Automated verification

```bash
npm test -- tests/domain/seller-milestones.test.ts tests/server/seller-milestone-policy.test.ts tests/server/seller-milestone-actions.test.ts tests/server/seller-milestone-ui.test.ts tests/server/seller-milestone-share.test.ts tests/domain/market-pack-flags.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
```

In `docs/superpowers/plans/demo-script-market-packs.md` section 1 step 4, add `seller_milestone_views` as **on** for `ew` and state it is a buyer-ledger snapshot, not seller stock.

In `README.md`, add a section **Seller milestone views (buyer-side, post-proof)** after the client-SLA / threads sections:

```md
## Seller milestone views (buyer-side, post-proof)

Spec §9 Phase 4. After the stage ledger exists, `ew` may turn `seller_milestone_views`
on as **data**. That flag unlocks a read-only milestone snapshot projected from the
buyer case stages, advisor export copy, and an optional HMAC share link.

**Not in this overlay:** a seller login, inventory, listing feed, private
seller–buyer introduction, corridor enablement, or a Prisma share table.

Walkthrough: [`docs/superpowers/plans/demo-script-seller-milestones.md`](docs/superpowers/plans/demo-script-seller-milestones.md).
```

- [ ] **Step 2: Full verification**

Run: `npm test` then `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/demo-script-seller-milestones.md docs/superpowers/plans/demo-script-market-packs.md docs/superpowers/plans/demo-script-chain-free.md README.md
git commit -m "docs: add seller milestone views demo script and README"
```

---

## Self-review

**Spec coverage:**
- §2 seller-side inventory is a non-goal → Tasks 1, 5–8 never add inventory or a seller role.
- §6 search stays external → no listing UI.
- §7 buyer-side orchestrator / no private intro → public copy and marketing hook locked strings.
- §9 Phase 4 seller views after ledger proof → Tasks 1–6 project the existing ledger.

**Placeholder scan:** no TBD / “implement later” / “similar to Task N” leftovers.

**Type consistency:** `SellerShareAction`, `AdvisorSellerView`, `sellerSharePath`, `canUseSellerMilestones`, and event type strings are identical from Task 1 through Task 6.

**Non-goals honoured:** no seller login, no inventory, no introductions, no corridor flag, no Prisma share table, no S3, no SLA/vault/thread flag edits.
