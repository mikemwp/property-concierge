# Case-Scoped Threads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a case-scoped, append-only human message thread with role ACL (advisor, paid client, assigned partners) as the audit trail for the multi-party conversation — Prisma `CaseMessage` rows, no websockets — and mount the same thread panel on portal, cockpit, and partner case pages for paid England & Wales.

**Architecture:** Four layers, no cycles. Same shape as the document vault.

1. **Pure domain** (`src/domain/threads.ts`) — permission, post/read ACL, body rules, append-only invariant, visibility. No Prisma, no Next, no `fs`, no jurisdiction literals.
2. **Persistence** (`CaseMessage` in Prisma + `src/server/thread-store.ts`) — one row per post (`caseId`, `authorUserId`, `authorRole`, `body`, `createdAt`). Insert and list only. No update. No delete. No `updatedAt`.
3. **Policy + port** (`src/server/threads.ts`) — fail closed when `case_threads` is off or the case is `FREE_DIY`; combine pack flag, ACL, and store. Actions never write rows except by calling `performPostMessage`.
4. **Surfaces** — one `ThreadPanel` on `/portal/cases/[caseId]`, `/cockpit/cases/[caseId]`, and `/partner/cases/[caseId]` (including the partner “not your stage” empty state). Post via server action + `revalidatePath`. Refresh to see new posts.

**The invariant that makes this a thread and not a second ledger:** the stage engine stays the source of truth for ownership, evidence, and pressure. `CaseMessage` is the human conversation and its own audit trail (who, role, body, when). Do **not** write a `StageEvent` per post. Do **not** open a websocket.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§5 freemium / “warm-intro threads” behind paid, §6 client portal “thread” + advisor “notes” + partner mini-view, §8 case-scoped thread with audit trail, country-agnostic engine).

**Builds on (already shipped, do not rebuild):**
- Plan 1 — `src/domain/stage-engine.ts`, stage ledger, evidence accept/advance.
- Plan 2 — intake, portal, playbooks, marketing freemium.
- Plan 3 — panel, scorecards, referrals, `listReferralsForCase` / `activeReferralForRole`, `attachPartnerParticipant`.
- Plan 4 — `MarketPack` / `isModuleEnabled` / `MARKET_MODULE_KEYS`.
- Plan 5 — partner ports and adapter authority. Leave them untouched.
- Plan 6 — chain-free overlay. Do not import chain-free into threads.
- Plan 7 — corridor packs. `case_threads` stays off on `au_uk` / `uk_au` / `us_uk` / `uk_us` and the `au` stub.
- Plan 8 — document vault on for `ew` only. Leave `document_vault` untouched. Copy the layering (domain → store → policy → action → panel), not the types.
- Plan 9 — `hard_client_sla` on for `ew` only. Leave that flag and the guarantee-language rules untouched.

**Follow-on plans (not this plan):** seller milestone views, open marketplace, turning `case_threads` on for corridor packs, websocket / SSE / push, message edit or delete, @mentions, attachments inside the thread, hard-guarantee copy changes.

## Global Constraints

Copied from the spec and the Plan 10 brief. Every task's requirements implicitly include this section.

- **Country-agnostic engine:** no jurisdiction literals (`£`, `GBP`, `en-GB`, `england`, `wales`) in `src/domain/threads.ts`, `src/server/threads.ts`, or `src/server/thread-store.ts`. Local names stay in market packs and brand copy.
- **Fail closed when `case_threads` is off:** unknown or disabled packs still throw `MarketPackError` at `casePack`; policy treats that as off. Corridor packs and the `au` stub stay off.
- **`case_threads` on for `ew` only.** Do not enable it on `au`, `au_uk`, `uk_au`, `us_uk`, or `uk_us`.
- **Leave shipped flags alone:** `document_vault`, `hard_client_sla`, `partner_speed_rails`, and `chain_free_inventory` stay on for `ew` and off everywhere else. Do not edit those keys.
- **Freemium (explicit, locked):** `FREE_DIY` may not read messages, may not post, and does not see thread UI. The thread is paid operating IP (spec §5 “warm-intro threads”).
- **IP / ACL (locked):** advisor reads and posts every message on a paid case they can load. Paid client reads every message on their case and may post. A partner reads and posts only when they are a `CaseParticipant` on the case **or** have an active referral for their role. Unassigned partners get nothing. All readers on a case see the **whole** thread (this is a multi-party conversation, not vault-style “own uploads only”).
- **Append-only:** insert and list only. No edit, no delete, no `updatedAt`, no `deletedAt`. The `CaseMessage` row is the audit trail.
- **No realtime in v1:** no WebSocket, no `socket.io`, no `EventSource`, no Pusher/Ably. Post is a server action; `revalidatePath` plus a browser refresh is how new posts appear.
- **Do not rebuild the stage engine.** Do not write `THREAD_MESSAGE_POSTED` (or any other) `StageEvent` for ordinary posts. Do not add a Prisma SLA / guarantee column. Do not change hard-guarantee copy.
- **Server actions keep existing result shapes:** `{ ok: true; messageId: string } | { ok: false; error: string }`.
- **Engineering:** TDD per task; `npm test` stays green after each task's own files; `npm test` + `npm run build` pass at the end; DRY, YAGNI, frequent commits.

## Locked design decisions

**Flag matrix (final, after Task 2):**

| Pack | enabled | fx_deposit | corridor_inbound | corridor_outbound | partner_speed_rails | chain_free_inventory | hard_client_sla | document_vault | case_threads |
|---|---|---|---|---|---|---|---|---|---|
| `au` | false | off | off | off | off | off | off | off | off |
| `ew` | true | on | off | off | on | on | on | on | **on** |
| `au_uk` | true | on | on | on | off | off | off | off | off |
| `uk_au` | true | on | on | on | off | off | off | off | off |
| `us_uk` | true | on | on | on | off | off | off | off | off |
| `uk_us` | true | on | on | on | off | off | off | off | off |

**Permissions:** `NONE` | `READ` | `POST`. v1 never issues `READ` without `POST` — if you are on the case and the module is on and the case is paid, you may post. `threadPermission` returns `POST` or `NONE` only; `canReadThread` is `permission !== "NONE"`.

**Who may post (all must hold):**
- Module on (`case_threads`) and `canUseThreads` (also requires `PAID_DWY`).
- `ADVISOR` — yes.
- `CLIENT` — yes (paid already required).
- Partner role — `assigned === true` **or** `hasActiveReferral === true`.
- Anyone else — `NONE`.

`loadCaseForUser` already requires a `CaseParticipant` row, so the action passes `assigned: true` after a successful load. Domain tests still cover `assigned: false`.

**Body rules:** trim; strip NUL; after normalize, length `1..=4000` (`MIN_THREAD_BODY_LENGTH = 1`, `MAX_THREAD_BODY_LENGTH = 4000`). Store the normalized body. Render as plain text (`whitespace-pre-wrap`), never `dangerouslySetInnerHTML`.

**Prisma model (exact columns from the brief, plus `id`):**

```
CaseMessage
  id            String   @id @default(cuid())
  caseId        String
  authorUserId  String
  authorRole    String
  body          String
  createdAt     DateTime @default(now())
```

No `User` relation (same as `VaultDocument.uploadedByUserId`). `authorName` is resolved at read time from `User.name` and is **not** a Prisma column.

**Seed:** wipe `caseMessage` first. After creating **Bloggs return (paid)**, insert one advisor welcome post so the demo is not an empty box. Do not seed messages on Smith (free) or Chen (corridor).

**Surfaces:**
- Portal: paid `ew` only; compose form on. Free Smith: no panel.
- Cockpit: paid `ew` only; compose form on. Smith: no panel (`canUseThreads` is false).
- Partner: show the panel whenever the partner can load the case **and** the flag is on — including the existing “No assigned stage” early return. Assigned partners stay in the thread when it is not their turn.

**Marketing:** one homepage hook. Copy may say thread / append-only / refresh. Must not say live chat, realtime, websocket, or guarantee. Existing `FORBIDDEN_CLAIM_PATTERNS` stay in force. Do not change `CLIENT_SLA_HOOK`.

## File structure (locked)

```
src/
  domain/
    threads.ts                                 # NEW (Task 1): ACL, body, append-only
    market-packs/
      types.ts                                 # MODIFY (Task 2): add case_threads
      ew-config.ts                             # MODIFY (Task 2): case_threads: true
  server/
    thread-store.ts                            # NEW (Task 3): Prisma insert + list
    threads.ts                                 # NEW (Task 4): canUse / assert / perform
  app/
    actions/
      threads.ts                               # NEW (Task 5): postCaseMessageAction
    portal/cases/[caseId]/page.tsx             # MODIFY (Task 6): ThreadPanel
    cockpit/cases/[caseId]/page.tsx            # MODIFY (Task 7): ThreadPanel
    partner/cases/[caseId]/page.tsx            # MODIFY (Task 7): ThreadPanel on both branches
    (marketing)/page.tsx                       # MODIFY (Task 8): CASE_THREAD_HOOK
  components/
    ThreadPanel.tsx                            # NEW (Task 6)
  content/
    marketing.ts                               # MODIFY (Task 8): hook + free limit
prisma/schema.prisma                           # MODIFY (Task 3): CaseMessage
prisma/seed.ts                                 # MODIFY (Task 3): deleteMany + Bloggs welcome
tests/
  domain/threads.test.ts                       # NEW (Task 1)
  domain/engine-country-agnostic.test.ts       # MODIFY (Tasks 1, 4)
  domain/market-pack-flags.test.ts             # MODIFY (Task 2)
  domain/market-pack-inspector.test.ts         # MODIFY (Task 2)
  domain/ew-pack.test.ts                       # MODIFY (Task 2)
  domain/uk-au-pack.test.ts                    # MODIFY (Task 2)
  server/thread-schema.test.ts                 # NEW (Task 3)
  server/thread-store.test.ts                  # NEW (Task 3)
  server/thread-policy.test.ts                 # NEW (Task 4)
  server/thread-actions.test.ts                # NEW (Task 5)
  server/thread-ui.test.ts                     # NEW (Tasks 6–7)
  content/marketing-copy.test.ts               # MODIFY (Task 8)
docs/superpowers/plans/
  demo-script-case-threads.md                  # NEW (Task 9)
  demo-script-*.md                             # MODIFY (Task 9): flag + Absent rows
README.md                                      # MODIFY (Task 9)
```

**Layering rule:** `src/domain/threads.ts` imports only `./types` (`ActorRole`, `Tier`, `isPartnerActorRole`). It must not import stage-engine, market packs, Prisma, Next, vault, chain-free, or client-sla. `src/server/thread-store.ts` is the only module that touches `prisma.caseMessage`. `src/server/threads.ts` is the only module that combines `casePack` / flag / store / ACL. Actions never call `prisma.caseMessage` directly. Adapters never import the thread store.

---

### Task 1: Thread vocabulary, role ACL, append-only, body rules

**Files:**
- Create: `src/domain/threads.ts`
- Create: `tests/domain/threads.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/domain/threads.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `ActorRole`, `Tier`, `isPartnerActorRole` from `src/domain/types.ts`.
- Produces: `ThreadPermission`, `THREAD_PERMISSIONS`, `ThreadError`, `ThreadErrorCode`, `CaseMessageRecord`, `ThreadActor`, `ThreadViewer`, `MIN_THREAD_BODY_LENGTH`, `MAX_THREAD_BODY_LENGTH`, `normalizeThreadBody`, `assertValidThreadBody`, `threadPermission`, `canReadThread`, `canPostThread`, `assertCanPostThread`, `visibleCaseMessages`, `assertAppendOnly`, `assertMessageImmutable`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/threads.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assertAppendOnly,
  assertCanPostThread,
  assertMessageImmutable,
  assertValidThreadBody,
  canPostThread,
  canReadThread,
  MAX_THREAD_BODY_LENGTH,
  MIN_THREAD_BODY_LENGTH,
  normalizeThreadBody,
  ThreadError,
  threadPermission,
  visibleCaseMessages,
  type CaseMessageRecord,
  type ThreadViewer,
} from "../../src/domain/threads";

function message(overrides: Partial<CaseMessageRecord> = {}): CaseMessageRecord {
  return {
    id: "msg_1",
    caseId: "case_1",
    authorUserId: "user_advisor",
    authorRole: "ADVISOR",
    body: "Welcome to the case thread.",
    createdAt: "2026-09-04T10:00:00.000Z",
    authorName: "Demo Advisor",
    ...overrides,
  };
}

function viewer(overrides: Partial<ThreadViewer> = {}): ThreadViewer {
  return {
    role: "CLIENT",
    userId: "user_client",
    tier: "PAID_DWY",
    assigned: true,
    hasActiveReferral: false,
    ...overrides,
  };
}

describe("thread ACL", () => {
  it("lets the advisor and paid client post, and hides the thread from free DIY", () => {
    expect(threadPermission(viewer({ role: "ADVISOR" }))).toBe("POST");
    expect(threadPermission(viewer({ role: "CLIENT" }))).toBe("POST");
    expect(threadPermission(viewer({ role: "CLIENT", tier: "FREE_DIY" }))).toBe("NONE");
    expect(threadPermission(viewer({ role: "ADVISOR", tier: "FREE_DIY" }))).toBe("NONE");
    expect(canReadThread(viewer({ tier: "FREE_DIY" }))).toBe(false);
    expect(canPostThread(viewer({ tier: "FREE_DIY" }))).toBe(false);
  });

  it("lets assigned or referred partners post and refuses strangers", () => {
    expect(
      threadPermission(
        viewer({
          role: "MORTGAGE_PARTNER",
          userId: "user_mortgage",
          assigned: true,
          hasActiveReferral: false,
        }),
      ),
    ).toBe("POST");
    expect(
      threadPermission(
        viewer({
          role: "CONVEYANCER",
          userId: "user_conv",
          assigned: false,
          hasActiveReferral: true,
        }),
      ),
    ).toBe("POST");
    expect(
      threadPermission(
        viewer({
          role: "MOVE_PARTNER",
          userId: "user_move",
          assigned: false,
          hasActiveReferral: false,
        }),
      ),
    ).toBe("NONE");
  });

  it("throws FREE_TIER for a free client and FORBIDDEN for an unassigned partner", () => {
    expect(() => assertCanPostThread(viewer({ tier: "FREE_DIY" }))).toThrow(ThreadError);
    try {
      assertCanPostThread(viewer({ tier: "FREE_DIY" }));
    } catch (err) {
      expect(err).toBeInstanceOf(ThreadError);
      expect((err as ThreadError).code).toBe("FREE_TIER");
    }
    try {
      assertCanPostThread(
        viewer({
          role: "MORTGAGE_PARTNER",
          assigned: false,
          hasActiveReferral: false,
        }),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(ThreadError);
      expect((err as ThreadError).code).toBe("FORBIDDEN");
    }
  });
});

describe("visibility is the whole thread or nothing", () => {
  it("returns every message to a permitted viewer and none to a free or unassigned viewer", () => {
    const rows = [
      message(),
      message({
        id: "msg_2",
        authorUserId: "user_client",
        authorRole: "CLIENT",
        body: "Here is the ID pack.",
        authorName: "Demo Client",
      }),
    ];
    expect(visibleCaseMessages(rows, viewer({ role: "ADVISOR" })).map((row) => row.id)).toEqual([
      "msg_1",
      "msg_2",
    ]);
    expect(visibleCaseMessages(rows, viewer({ role: "CLIENT" }))).toHaveLength(2);
    expect(
      visibleCaseMessages(
        rows,
        viewer({ role: "MORTGAGE_PARTNER", assigned: true }),
      ),
    ).toHaveLength(2);
    expect(visibleCaseMessages(rows, viewer({ tier: "FREE_DIY" }))).toEqual([]);
    expect(
      visibleCaseMessages(
        rows,
        viewer({
          role: "MORTGAGE_PARTNER",
          assigned: false,
          hasActiveReferral: false,
        }),
      ),
    ).toEqual([]);
  });
});

describe("body rules", () => {
  it("trims, strips NUL, and enforces 1..4000 characters", () => {
    expect(normalizeThreadBody("  hello\0  ")).toBe("hello");
    expect(assertValidThreadBody("  hello  ")).toBe("hello");
    expect(MIN_THREAD_BODY_LENGTH).toBe(1);
    expect(MAX_THREAD_BODY_LENGTH).toBe(4000);
    expect(() => assertValidThreadBody("   ")).toThrow(ThreadError);
    expect(() => assertValidThreadBody("x".repeat(4001))).toThrow(ThreadError);
    try {
      assertValidThreadBody("");
    } catch (err) {
      expect((err as ThreadError).code).toBe("INVALID_BODY");
    }
  });
});

describe("append-only", () => {
  it("refuses a second write against an existing message id or a mutated body", () => {
    const existing = message();
    expect(() => assertAppendOnly(existing)).toThrow(ThreadError);
    expect(() => assertAppendOnly(null)).not.toThrow();
    expect(() =>
      assertMessageImmutable(existing, {
        body: existing.body,
        authorUserId: existing.authorUserId,
        authorRole: existing.authorRole,
      }),
    ).not.toThrow();
    try {
      assertMessageImmutable(existing, {
        body: "edited",
        authorUserId: existing.authorUserId,
        authorRole: existing.authorRole,
      });
    } catch (err) {
      expect((err as ThreadError).code).toBe("APPEND_ONLY");
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/domain/threads.test.ts`

Expected: FAIL — `Cannot find module '../../src/domain/threads'` (or the named exports are missing).

- [ ] **Step 3: Write the minimal domain module**

Create `src/domain/threads.ts`:

```ts
import { isPartnerActorRole, type ActorRole, type Tier } from "./types";

export const THREAD_PERMISSIONS = ["NONE", "READ", "POST"] as const;
export type ThreadPermission = (typeof THREAD_PERMISSIONS)[number];

export type ThreadErrorCode =
  | "THREAD_DISABLED"
  | "FORBIDDEN"
  | "FREE_TIER"
  | "INVALID_BODY"
  | "APPEND_ONLY"
  | "NOT_FOUND";

export class ThreadError extends Error {
  constructor(
    public code: ThreadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ThreadError";
  }
}

export type CaseMessageRecord = {
  id: string;
  caseId: string;
  authorUserId: string;
  authorRole: ActorRole;
  body: string;
  createdAt: string;
  authorName: string | null;
};

export type ThreadActor = {
  role: ActorRole;
  userId: string;
};

export type ThreadViewer = {
  role: ActorRole;
  userId: string;
  tier: Tier;
  assigned: boolean;
  hasActiveReferral: boolean;
};

export const MIN_THREAD_BODY_LENGTH = 1;
export const MAX_THREAD_BODY_LENGTH = 4000;

export function normalizeThreadBody(body: string): string {
  return body.replace(/\0/g, "").trim();
}

export function assertValidThreadBody(body: string): string {
  const normalized = normalizeThreadBody(body);
  if (normalized.length < MIN_THREAD_BODY_LENGTH) {
    throw new ThreadError("INVALID_BODY", "Message body cannot be empty");
  }
  if (normalized.length > MAX_THREAD_BODY_LENGTH) {
    throw new ThreadError(
      "INVALID_BODY",
      `Message body must be at most ${MAX_THREAD_BODY_LENGTH} characters`,
    );
  }
  return normalized;
}

export function threadPermission(input: {
  role: ActorRole;
  tier: Tier;
  assigned: boolean;
  hasActiveReferral: boolean;
}): ThreadPermission {
  if (input.tier !== "PAID_DWY") {
    return "NONE";
  }
  if (input.role === "ADVISOR" || input.role === "CLIENT") {
    return "POST";
  }
  if (isPartnerActorRole(input.role) && (input.assigned || input.hasActiveReferral)) {
    return "POST";
  }
  return "NONE";
}

export function canReadThread(viewer: ThreadViewer): boolean {
  return threadPermission(viewer) !== "NONE";
}

export function canPostThread(viewer: ThreadViewer): boolean {
  return threadPermission(viewer) === "POST";
}

export function assertCanPostThread(viewer: ThreadViewer): void {
  if (viewer.tier !== "PAID_DWY") {
    throw new ThreadError("FREE_TIER", "Case thread is a paid Done-With-You capability");
  }
  if (!canPostThread(viewer)) {
    throw new ThreadError("FORBIDDEN", "Not allowed to post on this case thread");
  }
}

export function visibleCaseMessages(
  messages: readonly CaseMessageRecord[],
  viewer: ThreadViewer,
): CaseMessageRecord[] {
  if (!canReadThread(viewer)) {
    return [];
  }
  return [...messages];
}

export function assertAppendOnly(existing: CaseMessageRecord | null): void {
  if (existing) {
    throw new ThreadError(
      "APPEND_ONLY",
      "Case messages are append-only and cannot be edited or replaced",
    );
  }
}

export function assertMessageImmutable(
  existing: CaseMessageRecord,
  proposed: Pick<CaseMessageRecord, "body" | "authorUserId" | "authorRole">,
): void {
  if (
    existing.body !== proposed.body ||
    existing.authorUserId !== proposed.authorUserId ||
    existing.authorRole !== proposed.authorRole
  ) {
    throw new ThreadError(
      "APPEND_ONLY",
      "Case messages are append-only and cannot be edited or replaced",
    );
  }
}
```

In `tests/domain/engine-country-agnostic.test.ts`, add `"src/domain/threads.ts"` to `ENGINE_GLOBAL_FILES` immediately after `"src/domain/vault.ts"`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/domain/threads.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS. The country-agnostic scan must keep passing — `threads.ts` contains no `£`, `GBP`, `en-GB`, `england`, or `wales`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/threads.ts tests/domain/threads.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: add case-thread ACL and append-only body rules"
```

---

### Task 2: `case_threads` module flag on England & Wales only

**Files:**
- Modify: `src/domain/market-packs/types.ts` — add `"case_threads"` to `MarketModuleKey` and `MARKET_MODULE_KEYS`
- Modify: `src/domain/market-packs/ew-config.ts` — `case_threads: true` and a one-line comment
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-inspector.test.ts`
- Modify: `tests/domain/ew-pack.test.ts`
- Modify: `tests/domain/uk-au-pack.test.ts`

**Interfaces:**
- Consumes: existing `MarketModuleKey` / `isModuleEnabled` / pack flag objects from Plans 4–9.
- Produces: `MarketModuleKey` includes `"case_threads"`; `EW_FLAGS.case_threads === true`; every other registered pack resolves the key as off.

- [ ] **Step 1: Write the failing flag tests**

In `tests/domain/market-pack-flags.test.ts`, add this block after the document-vault example:

```ts
  it("runs the case thread in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "case_threads"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "case_threads")).toBe(
      false,
    );
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au_uk")!.flags, "case_threads"),
    ).toBe(false);
    expect(isModuleEnabled(EW_FLAGS, "case_threads")).toBe(true);
  });
```

In `tests/domain/market-pack-inspector.test.ts`, inside the “lists every module” example, add:

```ts
    expect(summary.modules.find((m) => m.key === "case_threads")?.enabled).toBe(true);
```

and inside the corridor summary example, add:

```ts
    expect(inbound.modules.find((m) => m.key === "case_threads")?.enabled).toBe(false);
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
    });
```

In `tests/domain/uk-au-pack.test.ts`, after the existing `hard_client_sla` assertion, add:

```ts
    expect(isModuleEnabled(ukAuMarketPack.flags, "case_threads")).toBe(false);
    expect(isModuleEnabled(ukAuMarketPack.flags, "document_vault")).toBe(false);
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/uk-au-pack.test.ts`

Expected: FAIL — `"case_threads"` is not assignable to `MarketModuleKey`, and/or the `ew` flags snapshot does not contain `case_threads: true`.

- [ ] **Step 3: Add the key and turn it on for `ew` only**

In `src/domain/market-packs/types.ts`, extend the union and the array. Do not reorder the existing keys; append `case_threads` at the end:

```ts
export type MarketModuleKey =
  | "fx_deposit"
  | "corridor_inbound"
  | "corridor_outbound"
  | "chain_free_inventory"
  | "hard_client_sla"
  | "document_vault"
  | "partner_speed_rails"
  | "case_threads";

export const MARKET_MODULE_KEYS: readonly MarketModuleKey[] = [
  "fx_deposit",
  "corridor_inbound",
  "corridor_outbound",
  "chain_free_inventory",
  "hard_client_sla",
  "document_vault",
  "partner_speed_rails",
  "case_threads",
];
```

In `src/domain/market-packs/ew-config.ts`, update the comment and flags:

```ts
/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are
 * adapter plumbing. Spec §13 sub-project 6: chain_free_inventory is on as
 * buyer-side certification/matching data — not seller listings. Spec §8:
 * document_vault is on for ew only. Spec §5/§9: hard_client_sla is on for ew
 * only as published target timelines with legal carve-outs — not a marketing
 * guarantee. Spec §8: case_threads is on for ew only as the append-only
 * multi-party case thread.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
  chain_free_inventory: true,
  document_vault: true,
  hard_client_sla: true,
  case_threads: true,
};
```

Do **not** add `case_threads` to corridor configs or `au-stub`. A missing key is off (`isModuleEnabled` requires `=== true`).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/uk-au-pack.test.ts`

Expected: PASS. `ew` is the only pack with `case_threads` on. Corridor and `au` stay off. Existing vault / SLA / speed-rail / chain-free assertions stay green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/types.ts src/domain/market-packs/ew-config.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/ew-pack.test.ts tests/domain/uk-au-pack.test.ts
git commit -m "feat: enable case_threads for England and Wales only"
```

---

### Task 3: Prisma `CaseMessage` and append-only store

**Files:**
- Modify: `prisma/schema.prisma` — `CaseMessage` model + `messages` on `Case`
- Modify: `prisma/seed.ts` — `caseMessage.deleteMany()` first; Bloggs welcome post
- Create: `src/server/thread-store.ts`
- Create: `tests/server/thread-schema.test.ts`
- Create: `tests/server/thread-store.test.ts`

**Interfaces:**
- Consumes: `CaseMessageRecord`, `assertAppendOnly` from `src/domain/threads.ts`; `ActorRole` from `src/domain/types.ts`; `prisma` from `src/lib/db.ts`; `createCaseRecord` from `src/server/cases.ts`.
- Produces: `toCaseMessageRecord`, `insertCaseMessage`, `listCaseMessages`, `getCaseMessageById`. Store exports **no** update or delete function.

- [ ] **Step 1: Write the failing schema and store tests**

Create `tests/server/thread-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const seed = readFileSync(path.resolve(process.cwd(), "prisma/seed.ts"), "utf8");
const store = readFileSync(path.resolve(process.cwd(), "src/server/thread-store.ts"), "utf8");

describe("CaseMessage is the append-only audit trail", () => {
  it("declares the brief columns, cascades from Case, and has no mutation columns", () => {
    expect(schema).toMatch(/model CaseMessage \{[\s\S]*caseId\s+String/);
    expect(schema).toMatch(/authorUserId\s+String/);
    expect(schema).toMatch(/authorRole\s+String/);
    expect(schema).toMatch(/body\s+String/);
    expect(schema).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(schema).toMatch(/messages\s+CaseMessage\[\]/);
    expect(schema).toMatch(/onDelete:\s*Cascade/);
    expect(schema).not.toMatch(/model CaseMessage \{[\s\S]*updatedAt/);
    expect(schema).not.toMatch(/model CaseMessage \{[\s\S]*deletedAt/);
  });

  it("wipes messages in seed and never updates or deletes from the store", () => {
    expect(seed).toMatch(/caseMessage\.deleteMany/);
    expect(seed).toMatch(/Welcome to the Bloggs case thread/);
    expect(store).not.toMatch(/caseMessage\.(update|updateMany|delete|deleteMany)/);
  });
});
```

Create `tests/server/thread-store.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { createCaseRecord } from "../../src/server/cases";
import {
  getCaseMessageById,
  insertCaseMessage,
  listCaseMessages,
} from "../../src/server/thread-store";
import { assertAppendOnly } from "../../src/domain/threads";

let caseId = "";

describe("thread store is insert + list only", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.caseMessage.deleteMany();
    await prisma.vaultDocument.deleteMany();
    await prisma.referral.deleteMany();
    await prisma.partnerPanel.deleteMany();
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.createMany({
      data: [
        {
          id: "ts_client",
          email: "ts-client@example.com",
          name: "Store Client",
          role: "CLIENT",
          passwordHash,
        },
        {
          id: "ts_advisor",
          email: "ts-advisor@example.com",
          name: "Store Advisor",
          role: "ADVISOR",
          passwordHash,
        },
      ],
    });
    const created = await createCaseRecord({
      title: "Thread store case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "ts_client",
      advisorUserId: "ts_advisor",
    });
    caseId = created.id;
  });

  beforeEach(async () => {
    await prisma.caseMessage.deleteMany({ where: { caseId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("inserts in createdAt order and resolves authorName from User", async () => {
    await insertCaseMessage({
      id: "ts_msg_1",
      caseId,
      authorUserId: "ts_advisor",
      authorRole: "ADVISOR",
      body: "First post.",
      createdAt: new Date("2026-09-04T10:00:00.000Z"),
    });
    await insertCaseMessage({
      id: "ts_msg_2",
      caseId,
      authorUserId: "ts_client",
      authorRole: "CLIENT",
      body: "Second post.",
      createdAt: new Date("2026-09-04T10:05:00.000Z"),
    });

    const listed = await listCaseMessages(caseId);
    expect(listed.map((row) => row.id)).toEqual(["ts_msg_1", "ts_msg_2"]);
    expect(listed[0]?.authorName).toBe("Store Advisor");
    expect(listed[1]?.authorName).toBe("Store Client");
    expect(listed[0]?.createdAt).toBe("2026-09-04T10:00:00.000Z");

    const existing = await getCaseMessageById("ts_msg_1");
    expect(existing?.body).toBe("First post.");
    expect(() => assertAppendOnly(existing)).toThrow(/append-only/i);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/thread-schema.test.ts tests/server/thread-store.test.ts`

Expected: FAIL — `src/server/thread-store.ts` is missing and/or `model CaseMessage` is not in the schema.

- [ ] **Step 3: Add the model, store, and seed wipe**

In `prisma/schema.prisma`, add the relation on `Case` next to `vaultDocuments`:

```
  vaultDocuments VaultDocument[]
  messages       CaseMessage[]
```

Add the model after `VaultDocument`:

```
model CaseMessage {
  id           String   @id @default(cuid())
  caseId       String
  authorUserId String
  authorRole   String
  body         String
  createdAt    DateTime @default(now())
  case         Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@index([caseId, createdAt])
}
```

Create `src/server/thread-store.ts`:

```ts
import type { CaseMessage } from "@prisma/client";
import type { ActorRole } from "../domain/types";
import type { CaseMessageRecord } from "../domain/threads";
import { prisma } from "../lib/db";

export function toCaseMessageRecord(
  row: CaseMessage,
  authorName: string | null,
): CaseMessageRecord {
  return {
    id: row.id,
    caseId: row.caseId,
    authorUserId: row.authorUserId,
    authorRole: row.authorRole as ActorRole,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorName,
  };
}

async function namesFor(userIds: string[]): Promise<Map<string, string | null>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name ?? null]));
}

export async function insertCaseMessage(input: {
  id?: string;
  caseId: string;
  authorUserId: string;
  authorRole: ActorRole;
  body: string;
  createdAt?: Date;
}): Promise<CaseMessageRecord> {
  const row = await prisma.caseMessage.create({
    data: {
      id: input.id,
      caseId: input.caseId,
      authorUserId: input.authorUserId,
      authorRole: input.authorRole,
      body: input.body,
      createdAt: input.createdAt,
    },
  });
  const names = await namesFor([row.authorUserId]);
  return toCaseMessageRecord(row, names.get(row.authorUserId) ?? null);
}

export async function listCaseMessages(caseId: string): Promise<CaseMessageRecord[]> {
  const rows = await prisma.caseMessage.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });
  const names = await namesFor(rows.map((row) => row.authorUserId));
  return rows.map((row) => toCaseMessageRecord(row, names.get(row.authorUserId) ?? null));
}

export async function getCaseMessageById(id: string): Promise<CaseMessageRecord | null> {
  const row = await prisma.caseMessage.findUnique({ where: { id } });
  if (!row) {
    return null;
  }
  const names = await namesFor([row.authorUserId]);
  return toCaseMessageRecord(row, names.get(row.authorUserId) ?? null);
}
```

In `prisma/seed.ts`, add this as the **first** wipe (before `vaultDocument.deleteMany()`):

```ts
  await prisma.caseMessage.deleteMany();
```

Change the Bloggs `createCaseRecord` call to capture the id and insert the welcome post immediately after:

```ts
  const bloggs = await createCaseRecord({
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

  await prisma.caseMessage.create({
    data: {
      caseId: bloggs.id,
      authorUserId: advisor.id,
      authorRole: "ADVISOR",
      body: "Welcome to the Bloggs case thread. I will stay in this conversation with every partner we introduce.",
    },
  });
```

Leave Smith, Chen, and the other seed cases without messages.

Then push the schema so the store tests can run:

```bash
npx prisma generate
npx prisma db push
```

Expected: Prisma client includes `caseMessage`; SQLite accepts the new table.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/thread-schema.test.ts tests/server/thread-store.test.ts`

Expected: PASS. Two messages list oldest-first with names. `assertAppendOnly` still throws on a loaded row. The store source has no `update` / `delete`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts src/server/thread-store.ts tests/server/thread-schema.test.ts tests/server/thread-store.test.ts
git commit -m "feat: persist append-only CaseMessage rows"
```

---

### Task 4: Server policy — flag gate, ACL, perform post

**Files:**
- Create: `src/server/threads.ts`
- Create: `tests/server/thread-policy.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/server/threads.ts"` and `"src/server/thread-store.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `isModuleEnabled` from `src/domain/market-packs/types.ts`; `casePack` from `src/lib/case-pack.ts`; `CaseState` from `src/domain/stage-engine.ts`; `assertCanPostThread`, `assertValidThreadBody`, `canPostThread`, `canReadThread`, `visibleCaseMessages`, `ThreadError`, `ThreadActor`, `ThreadViewer`, `CaseMessageRecord` from `src/domain/threads.ts`; `insertCaseMessage`, `listCaseMessages` from `src/server/thread-store.ts`; `activeReferralForRole` from `src/server/referrals.ts`; `isPartnerActorRole` from `src/domain/types.ts`.
- Produces: `canUseThreads`, `assertThreadsEnabled`, `threadViewerFor`, `partnerThreadFlags`, `listVisibleCaseMessages`, `loadVisibleCaseMessages`, `performPostMessage`.

- [ ] **Step 1: Write the failing policy tests**

Create `tests/server/thread-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ThreadError } from "../../src/domain/threads";
import {
  assertThreadsEnabled,
  canUseThreads,
  listVisibleCaseMessages,
  performPostMessage,
  threadViewerFor,
} from "../../src/server/threads";
import type { CaseMessageRecord } from "../../src/domain/threads";

function paid(id = "tp1") {
  return createCase({ id, entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

const sample: CaseMessageRecord = {
  id: "msg_1",
  caseId: "tp1",
  authorUserId: "user_advisor",
  authorRole: "ADVISOR",
  body: "Welcome.",
  createdAt: "2026-09-04T10:00:00.000Z",
  authorName: "Demo Advisor",
};

describe("case_threads module gate", () => {
  it("is open for paid England & Wales and closed otherwise", () => {
    expect(canUseThreads(paid())).toBe(true);
    expect(canUseThreads({ ...paid(), marketPackId: "au_uk" })).toBe(false);
    expect(canUseThreads({ ...paid("tp2"), tier: "FREE_DIY" })).toBe(false);
    expect(() => assertThreadsEnabled(paid())).not.toThrow();
    expect(() => assertThreadsEnabled({ ...paid(), marketPackId: "au_uk" })).toThrow(ThreadError);
    expect(() => assertThreadsEnabled({ ...paid("tp3"), tier: "FREE_DIY" })).toThrow(ThreadError);
  });
});

describe("visibility filter", () => {
  it("shows the whole thread to paid parties and nothing to free DIY", () => {
    const caseState = paid();
    const advisor = threadViewerFor(caseState, { role: "ADVISOR", userId: "adv" }, {
      assigned: true,
      hasActiveReferral: false,
    });
    const free = threadViewerFor(
      { ...caseState, tier: "FREE_DIY" },
      { role: "CLIENT", userId: "user_client" },
      { assigned: true, hasActiveReferral: false },
    );
    expect(listVisibleCaseMessages([sample], advisor).map((row) => row.id)).toEqual(["msg_1"]);
    expect(listVisibleCaseMessages([sample], free)).toEqual([]);
  });
});

describe("performPostMessage refuses before the store", () => {
  it("throws THREAD_DISABLED on a corridor pack without inserting", async () => {
    await expect(
      performPostMessage({
        caseState: { ...paid(), marketPackId: "au_uk" },
        actor: { role: "ADVISOR", userId: "adv" },
        body: "Should not persist.",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "THREAD_DISABLED" });
  });

  it("throws FREE_TIER for a DIY case", async () => {
    await expect(
      performPostMessage({
        caseState: { ...paid("tp4"), tier: "FREE_DIY" },
        actor: { role: "CLIENT", userId: "user_client" },
        body: "Should not persist.",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "FREE_TIER" });
  });

  it("throws FORBIDDEN for an unassigned partner", async () => {
    await expect(
      performPostMessage({
        caseState: paid("tp5"),
        actor: { role: "MORTGAGE_PARTNER", userId: "user_mortgage" },
        body: "Should not persist.",
        assigned: false,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws INVALID_BODY for whitespace", async () => {
    await expect(
      performPostMessage({
        caseState: paid("tp6"),
        actor: { role: "ADVISOR", userId: "adv" },
        body: "   ",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "INVALID_BODY" });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/thread-policy.test.ts`

Expected: FAIL — `Cannot find module '../../src/server/threads'`.

- [ ] **Step 3: Write the policy module**

Create `src/server/threads.ts`:

```ts
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { isPartnerActorRole, type ActorRole } from "../domain/types";
import {
  assertCanPostThread,
  assertValidThreadBody,
  ThreadError,
  threadPermission,
  visibleCaseMessages,
  type CaseMessageRecord,
  type ThreadActor,
  type ThreadViewer,
} from "../domain/threads";
import { casePack } from "../lib/case-pack";
import { activeReferralForRole } from "./referrals";
import { insertCaseMessage, listCaseMessages } from "./thread-store";

export function canUseThreads(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "case_threads");
  } catch {
    return false;
  }
}

export function assertThreadsEnabled(caseState: CaseState): void {
  if (!canUseThreads(caseState)) {
    throw new ThreadError(
      "THREAD_DISABLED",
      `Case thread is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export function threadViewerFor(
  caseState: CaseState,
  actor: ThreadActor,
  flags: { assigned: boolean; hasActiveReferral: boolean },
): ThreadViewer {
  return {
    role: actor.role,
    userId: actor.userId,
    tier: caseState.tier,
    assigned: flags.assigned,
    hasActiveReferral: flags.hasActiveReferral,
  };
}

export async function partnerThreadFlags(
  caseId: string,
  role: ActorRole,
): Promise<{ assigned: boolean; hasActiveReferral: boolean }> {
  return {
    assigned: true,
    hasActiveReferral: isPartnerActorRole(role)
      ? (await activeReferralForRole(caseId, role)) !== null
      : false,
  };
}

export function listVisibleCaseMessages(
  messages: readonly CaseMessageRecord[],
  viewer: ThreadViewer,
): CaseMessageRecord[] {
  return visibleCaseMessages(messages, viewer);
}

export async function loadVisibleCaseMessages(
  caseState: CaseState,
  viewer: ThreadViewer,
): Promise<CaseMessageRecord[]> {
  if (!canUseThreads(caseState) || threadPermission(viewer) === "NONE") {
    return [];
  }
  return listVisibleCaseMessages(await listCaseMessages(caseState.id), viewer);
}

export async function performPostMessage(input: {
  caseState: CaseState;
  actor: ThreadActor;
  body: string;
  assigned: boolean;
  hasActiveReferral: boolean;
  now?: Date;
}): Promise<CaseMessageRecord> {
  assertThreadsEnabled(input.caseState);
  const viewer = threadViewerFor(input.caseState, input.actor, {
    assigned: input.assigned,
    hasActiveReferral: input.hasActiveReferral,
  });
  assertCanPostThread(viewer);
  const body = assertValidThreadBody(input.body);
  return insertCaseMessage({
    caseId: input.caseState.id,
    authorUserId: input.actor.userId,
    authorRole: input.actor.role,
    body,
    createdAt: input.now,
  });
}
```

Add `"src/server/threads.ts"` and `"src/server/thread-store.ts"` to `ENGINE_GLOBAL_FILES` in `tests/domain/engine-country-agnostic.test.ts`, after the vault server files.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/thread-policy.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS. Corridor / free / unassigned / empty-body paths throw before insert. Country-agnostic scan still green.

- [ ] **Step 5: Commit**

```bash
git add src/server/threads.ts tests/server/thread-policy.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: gate case threads behind paid England and Wales"
```

---

### Task 5: `postCaseMessageAction`

**Files:**
- Create: `src/app/actions/threads.ts`
- Create: `tests/server/thread-actions.test.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`; `loadCaseForUser`, `CaseAccessError` from `src/server/cases.ts`; `performPostMessage`, `partnerThreadFlags` from `src/server/threads.ts`; `ThreadError` from `src/domain/threads.ts`; `ActorRole` from `src/domain/types.ts`; `revalidatePath` from `next/cache`.
- Produces: `ThreadActionResult`, `postCaseMessageAction(caseId: string, body: string): Promise<ThreadActionResult>`.

- [ ] **Step 1: Write the failing action tests**

Create `tests/server/thread-actions.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ThreadError } from "../../src/domain/threads";
import { canUseThreads } from "../../src/server/threads";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("thread actions honour the ew flag", () => {
  it("enables post policy on paid ew and keeps free DIY silent", () => {
    const paidCase = createCase({
      id: "ta1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    const free = createCase({
      id: "ta2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "FREE_DIY",
    });
    expect(canUseThreads(paidCase)).toBe(true);
    expect(canUseThreads(free)).toBe(false);
  });
});

describe("action module", () => {
  it("exports a single post entry point that revalidates all three surfaces", async () => {
    const actions = await import("@/app/actions/threads");
    expect(typeof actions.postCaseMessageAction).toBe("function");
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/actions/threads.ts"),
      "utf8",
    );
    expect(source).toContain("revalidatePath(`/portal/cases/${caseId}`)");
    expect(source).toContain("revalidatePath(`/cockpit/cases/${caseId}`)");
    expect(source).toContain("revalidatePath(`/partner/cases/${caseId}`)");
    expect(source).not.toMatch(/WebSocket|socket\.io|EventSource|Pusher|Ably/i);
    expect(source).toContain("performPostMessage");
    expect(source).not.toContain("prisma.caseMessage");
  });

  it("surfaces ThreadError messages, not a generic failure", () => {
    const err = new ThreadError("FORBIDDEN", "Not allowed to post on this case thread");
    expect(err.message).toMatch(/Not allowed/);
    expect(err).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/thread-actions.test.ts`

Expected: FAIL — `src/app/actions/threads.ts` is missing.

- [ ] **Step 3: Write the action**

Create `src/app/actions/threads.ts`:

```ts
"use server";

import { ThreadError } from "@/domain/threads";
import type { ActorRole } from "@/domain/types";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import { partnerThreadFlags, performPostMessage } from "@/server/threads";
import { revalidatePath } from "next/cache";

export type ThreadActionResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (err instanceof ThreadError || err instanceof CaseAccessError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Thread action failed";
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/portal/cases/${caseId}`);
  revalidatePath("/portal");
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath("/cockpit/cases");
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
}

export async function postCaseMessageAction(
  caseId: string,
  body: string,
): Promise<ThreadActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Forbidden" };
  }
  const role = session.user.role as ActorRole;
  try {
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    const flags = await partnerThreadFlags(caseId, role);
    const posted = await performPostMessage({
      caseState,
      actor: { role, userId: session.user.id },
      body,
      assigned: flags.assigned,
      hasActiveReferral: flags.hasActiveReferral,
    });
    revalidateCasePaths(caseId);
    return { ok: true, messageId: posted.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/thread-actions.test.ts tests/server/thread-policy.test.ts`

Expected: PASS. The action source revalidates portal, cockpit, and partner, calls `performPostMessage`, and mentions no websocket library.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/threads.ts tests/server/thread-actions.test.ts
git commit -m "feat: add postCaseMessageAction for the case thread"
```

---

### Task 6: `ThreadPanel` and the client portal surface

**Files:**
- Create: `src/components/ThreadPanel.tsx`
- Modify: `src/app/portal/cases/[caseId]/page.tsx`
- Create: `tests/server/thread-ui.test.ts` (portal assertions in this task; cockpit/partner assertions land in Task 7 in the same file)

**Interfaces:**
- Consumes: `postCaseMessageAction` from `src/app/actions/threads.ts`; `CaseMessageRecord`, `canPostThread` from `src/domain/threads.ts`; `canUseThreads`, `loadVisibleCaseMessages`, `threadViewerFor` from `src/server/threads.ts`.
- Produces: `ThreadPanel` props `{ caseId: string; messages: CaseMessageRecord[]; canPost: boolean }`. Portal mounts it only when `canUseThreads` is true.

- [ ] **Step 1: Write the failing portal UI tests**

Create `tests/server/thread-ui.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("thread surfaces", () => {
  it("mounts ThreadPanel on the paid portal path and keeps it off the free attestation form", () => {
    const portal = read("src/app/portal/cases/[caseId]/page.tsx");
    const panel = read("src/components/ThreadPanel.tsx");

    expect(portal).toContain("canUseThreads");
    expect(portal).toContain("ThreadPanel");
    expect(portal).toContain("loadVisibleCaseMessages");
    expect(portal).toContain("UpgradeCallout");
    expect(panel).toContain("Case thread");
    expect(panel).toContain("postCaseMessageAction");
    expect(panel).toContain("whitespace-pre-wrap");
    expect(panel).not.toContain("dangerouslySetInnerHTML");
    expect(panel).not.toMatch(/WebSocket|socket\.io|EventSource|Pusher|Ably/i);
    expect(panel).toMatch(/Refresh to see new posts|not a live chat/i);
    expect(panel).toContain('name="body"');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/thread-ui.test.ts`

Expected: FAIL — `ThreadPanel.tsx` is missing and the portal page does not contain `canUseThreads`.

- [ ] **Step 3: Build the panel and mount it on the portal**

Create `src/components/ThreadPanel.tsx`:

```tsx
import { postCaseMessageAction } from "@/app/actions/threads";
import type { CaseMessageRecord } from "@/domain/threads";

export function ThreadPanel({
  caseId,
  messages,
  canPost,
}: {
  caseId: string;
  messages: CaseMessageRecord[];
  canPost: boolean;
}) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Case thread</h2>
      <p className="mt-1 text-sm text-slate-600">
        Append-only audit trail for everyone on this case. Refresh to see new
        posts. This is not a live chat.
      </p>
      {messages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No messages yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {messages.map((row) => (
            <li
              key={row.id}
              className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <p className="text-xs text-slate-500">
                {(row.authorName ?? row.authorRole.replace(/_/g, " ")) +
                  " · " +
                  row.authorRole.replace(/_/g, " ") +
                  " · " +
                  new Date(row.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canPost && (
        <form
          action={async (formData) => {
            const body = String(formData.get("body") ?? "");
            await postCaseMessageAction(caseId, body);
          }}
          className="mt-4 flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-800" htmlFor={`thread-body-${caseId}`}>
            Post a message
          </label>
          <textarea
            id={`thread-body-${caseId}`}
            name="body"
            required
            minLength={1}
            maxLength={4000}
            rows={3}
            placeholder="Write to everyone on this case"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800 hover:bg-slate-100"
          >
            Post
          </button>
        </form>
      )}
    </div>
  );
}
```

In `src/app/portal/cases/[caseId]/page.tsx`, add these imports next to the vault imports:

```ts
import { ThreadPanel } from "@/components/ThreadPanel";
import { canPostThread } from "@/domain/threads";
import {
  canUseThreads,
  loadVisibleCaseMessages,
  threadViewerFor,
} from "@/server/threads";
```

After the `vaultOn` / `vaultDocuments` block (just before `activeByKind`), add:

```ts
  const threadsOn = canUseThreads(caseState);
  const threadViewer = threadViewerFor(
    caseState,
    { role: "CLIENT", userId: session.user.id },
    { assigned: true, hasActiveReferral: false },
  );
  const threadMessages = threadsOn
    ? await loadVisibleCaseMessages(caseState, threadViewer)
    : [];
  const threadCanPost = threadsOn && canPostThread(threadViewer);
```

After `{vaultOn && <VaultPanel ... />}` and before `<ReferralDisclosure ... />`, add:

```tsx
      {threadsOn && (
        <ThreadPanel
          caseId={caseId}
          messages={threadMessages}
          canPost={threadCanPost}
        />
      )}
```

Do not mount `ThreadPanel` when `threadsOn` is false. Smith DIY therefore stays threadless.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/thread-ui.test.ts tests/server/client-sla-portal.test.ts tests/server/vault-ui.test.ts`

Expected: PASS. Existing portal vault / SLA source scans still find their strings. Thread panel has no websocket API and no HTML injection.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreadPanel.tsx src/app/portal/cases/[caseId]/page.tsx tests/server/thread-ui.test.ts
git commit -m "feat: show the paid case thread on the client portal"
```

---

### Task 7: Cockpit and partner thread surfaces

**Files:**
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx`
- Modify: `src/app/partner/cases/[caseId]/page.tsx`
- Modify: `tests/server/thread-ui.test.ts` — add cockpit + partner assertions

**Interfaces:**
- Consumes: the same `ThreadPanel`, `canUseThreads`, `loadVisibleCaseMessages`, `threadViewerFor`, `partnerThreadFlags`, `canPostThread` produced in Tasks 4–6.
- Produces: advisor and assigned-partner views of the same chronological thread. Partner “No assigned stage” early return still renders the panel.

- [ ] **Step 1: Extend the failing UI tests**

Append to `tests/server/thread-ui.test.ts`:

```ts
  it("mounts the same panel on cockpit and on both partner branches", () => {
    const cockpit = read("src/app/cockpit/cases/[caseId]/page.tsx");
    const partner = read("src/app/partner/cases/[caseId]/page.tsx");

    expect(cockpit).toContain("canUseThreads");
    expect(cockpit).toContain("ThreadPanel");
    expect(cockpit).toContain("loadVisibleCaseMessages");
    expect(cockpit).toContain("VaultPanel");
    expect(cockpit).not.toContain("WebSocket");

    expect(partner).toContain("canUseThreads");
    expect(partner).toContain("ThreadPanel");
    expect(partner).toContain("No assigned stage");
    expect(partner).toContain("partnerThreadFlags");
    const earlyReturnIndex = partner.indexOf("No assigned stage");
    const lastPanelIndex = partner.lastIndexOf("ThreadPanel");
    expect(earlyReturnIndex).toBeGreaterThan(-1);
    expect(lastPanelIndex).toBeGreaterThan(earlyReturnIndex);
  });
```

The last assertion requires `ThreadPanel` to appear **after** the “No assigned stage” heading (the early-return branch) **and** a later mount on the main branch is also fine — `lastIndexOf` must sit after that heading so the empty-state branch is not threadless.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/thread-ui.test.ts`

Expected: FAIL — cockpit / partner pages do not contain `ThreadPanel`.

- [ ] **Step 3: Mount the panel on cockpit and partner**

In `src/app/cockpit/cases/[caseId]/page.tsx`, add imports:

```ts
import { ThreadPanel } from "@/components/ThreadPanel";
import { canPostThread } from "@/domain/threads";
import {
  canUseThreads,
  loadVisibleCaseMessages,
  threadViewerFor,
} from "@/server/threads";
```

After the `vaultOn` / `vaultDocuments` block, add:

```ts
  const threadsOn = canUseThreads(caseState);
  const threadViewer = threadViewerFor(
    caseState,
    { role: "ADVISOR", userId: session.user.id },
    { assigned: true, hasActiveReferral: false },
  );
  const threadMessages = threadsOn
    ? await loadVisibleCaseMessages(caseState, threadViewer)
    : [];
  const threadCanPost = threadsOn && canPostThread(threadViewer);
```

Immediately after `{vaultOn && <VaultPanel caseId={caseId} documents={vaultDocuments} canReset />}` add:

```tsx
      {threadsOn && (
        <ThreadPanel
          caseId={caseId}
          messages={threadMessages}
          canPost={threadCanPost}
        />
      )}
```

In `src/app/partner/cases/[caseId]/page.tsx`, add imports:

```ts
import { ThreadPanel } from "@/components/ThreadPanel";
import { canPostThread } from "@/domain/threads";
import {
  canUseThreads,
  loadVisibleCaseMessages,
  partnerThreadFlags,
  threadViewerFor,
} from "@/server/threads";
```

**Hoist** thread loading above the `if (!focus || focus.ownerRole !== role)` early return. Insert this block immediately after the successful `loadCaseForUser` (after the `now` / `views` / `focus` lines, before the early return):

```ts
  const threadsOn = canUseThreads(caseState);
  const threadFlags = await partnerThreadFlags(caseId, role);
  const threadViewer = threadViewerFor(
    caseState,
    { role, userId: session.user.id },
    threadFlags,
  );
  const threadMessages = threadsOn
    ? await loadVisibleCaseMessages(caseState, threadViewer)
    : [];
  const threadCanPost = threadsOn && canPostThread(threadViewer);
```

Change the early-return JSX to include the panel:

```tsx
  if (!focus || focus.ownerRole !== role) {
    return (
      <section>
        <Link
          href="/partner"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Assigned stages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          No assigned stage
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This case is not currently waiting on your role ({role.replace(/_/g, " ")}
          ).
        </p>
        {threadsOn && (
          <ThreadPanel
            caseId={caseId}
            messages={threadMessages}
            canPost={threadCanPost}
          />
        )}
      </section>
    );
  }
```

On the main partner branch, mount the same panel after the vault panel:

```tsx
      {threadsOn && (
        <ThreadPanel
          caseId={caseId}
          messages={threadMessages}
          canPost={threadCanPost}
        />
      )}
```

Keep the later `activeReferralForRole` call that vault already uses; do not delete it. `partnerThreadFlags` may call it again — that is acceptable (YAGNI: no request cache required).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/thread-ui.test.ts tests/server/vault-ui.test.ts`

Expected: PASS. Vault UI scans still find `VaultPanel` on cockpit/partner. Thread panel appears on both partner branches.

- [ ] **Step 5: Commit**

```bash
git add src/app/cockpit/cases/[caseId]/page.tsx src/app/partner/cases/[caseId]/page.tsx tests/server/thread-ui.test.ts
git commit -m "feat: mount the case thread on cockpit and partner pages"
```

---

### Task 8: Marketing hook and freemium copy

**Files:**
- Modify: `src/content/marketing.ts` — `CASE_THREAD_HOOK`, free limit, `marketingClaimStrings`, `PAID_ONLY_CAPABILITY_PATTERNS`
- Modify: `src/app/(marketing)/page.tsx` — render the hook after `CLIENT_SLA_HOOK`
- Modify: `tests/content/marketing-copy.test.ts`

**Interfaces:**
- Consumes: existing `CLIENT_SLA_HOOK`, `FORBIDDEN_CLAIM_PATTERNS`, `FORBIDDEN_INVENTORY_PATTERNS`, `PAID_ONLY_CAPABILITY_PATTERNS`.
- Produces: `CASE_THREAD_HOOK` `{ eyebrow, headline, body }` included in `marketingClaimStrings()`.

- [ ] **Step 1: Write the failing copy tests**

Append to `tests/content/marketing-copy.test.ts`:

```ts
describe("case thread hook is an audit trail, not live chat", () => {
  it("names the append-only thread and forbids realtime or guarantee language", () => {
    const blob = `${CASE_THREAD_HOOK.eyebrow} ${CASE_THREAD_HOOK.headline} ${CASE_THREAD_HOOK.body}`;
    expect(blob).toMatch(/thread/i);
    expect(blob).toMatch(/append-only/i);
    expect(blob).toMatch(/refresh/i);
    expect(blob).not.toMatch(/live chat/i);
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
```

Add `CASE_THREAD_HOOK` to the existing import list from `../../src/content/marketing`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: FAIL — `CASE_THREAD_HOOK` is not exported.

- [ ] **Step 3: Add the hook, the free limit, and the homepage section**

In `src/content/marketing.ts`, add to `PAID_ONLY_CAPABILITY_PATTERNS` (after `/day counter/i`):

```ts
  /case thread/i,
```

Add to `FREE_PLAN.limits`:

```ts
    "No case thread — conversations with partners stay in your own inbox",
```

Add the hook after `CLIENT_SLA_HOOK`:

```ts
export const CASE_THREAD_HOOK = {
  eyebrow: "One thread, not six inboxes",
  headline: "The case thread is the audit trail.",
  body: "On Done-With-You your advisor stays in one append-only thread with you and the partners on the case. Every post is dated and attributed. Refresh the portal to see new messages — this is not a live chat.",
};
```

Add these three strings to `marketingClaimStrings()`, after the `CLIENT_SLA_HOOK` entries:

```ts
    CASE_THREAD_HOOK.eyebrow,
    CASE_THREAD_HOOK.headline,
    CASE_THREAD_HOOK.body,
```

In `src/app/(marketing)/page.tsx`, import `CASE_THREAD_HOOK` alongside `CLIENT_SLA_HOOK`, and add this section immediately after the client-SLA `<section>`:

```tsx
      <section className="mt-16 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {CASE_THREAD_HOOK.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {CASE_THREAD_HOOK.headline}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{CASE_THREAD_HOOK.body}</p>
      </section>
```

Do not edit `CLIENT_SLA_HOOK`, `FORBIDDEN_CLAIM_PATTERNS`, or any guarantee sentence.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: PASS. Free features still fail `PAID_ONLY_CAPABILITY_PATTERNS` (including `/case thread/i`). The new hook is in `marketingClaimStrings()` so the forbidden-claim loop covers it. SLA / chain-free hook tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/content/marketing.ts src/app/(marketing)/page.tsx tests/content/marketing-copy.test.ts
git commit -m "feat: market the case thread as an append-only audit trail"
```

---

### Task 9: Demo script, README, and prior-script flag lists

**Files:**
- Create: `docs/superpowers/plans/demo-script-case-threads.md`
- Modify: `README.md` — module list + new section; remove “threads” from the SLA non-goal sentence
- Modify: `docs/superpowers/plans/demo-script-document-vault.md` — flag list + Absent row
- Modify: `docs/superpowers/plans/demo-script-client-sla.md` — flag list + Absent row
- Modify: `docs/superpowers/plans/demo-script-core-portal.md` — one line that the paid Bloggs page now has a Case thread under the vault
- Modify: `docs/superpowers/plans/demo-script-market-packs.md` — `case_threads` on for `ew` in any module table / inspector step that lists current flags
- Modify: `docs/superpowers/plans/demo-script-corridor-packs.md` — `case_threads` stays off on corridor packs
- Modify: `docs/superpowers/plans/demo-script-speed-rails.md` — inspector step lists `case_threads` on for `ew` if that script lists sibling flags

**Interfaces:**
- Consumes: the shipped behaviour from Tasks 1–8.
- Produces: a founder click-script and README section that state what is real (`CaseMessage`, role ACL, ew-only flag, refresh-not-realtime) and what is absent (websockets, corridor threads, message edit/delete, seller views, marketplace, guarantee-copy changes).

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-case-threads.md`:

```md
# Case thread demo script

Founder validation script for spec §8: a case-scoped, append-only human thread with role ACL. Messages live in Prisma (`CaseMessage`). There is no websocket. The module is on for paid England & Wales only.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The flag is ew-only, and free stays threadless

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla`, `case_threads` **on**. `corridor_inbound`, `corridor_outbound` **off**.
3. Select **`au_uk`**. `case_threads` is **off**. Repeat for `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub.
4. Open **Smith DIY journey** in the cockpit. There is no **Case thread** panel.
5. Sign out. Sign in as **`client@example.com`** → Smith. No **Case thread** panel. Free attestation is unchanged.

## 2. Paid client reads the welcome post and can reply

1. Still as the client, open **Bloggs return (paid)** (`ew`, `PAID_DWY`).
2. Below the document vault, **Case thread** lists the seeded advisor welcome: *Welcome to the Bloggs case thread...*
3. Copy under the heading says the thread is append-only, that you refresh to see new posts, and that this is not a live chat.
4. Type `Here is the household contact window.` → **Post**. The message appears with role `CLIENT` after the page revalidates.
5. There is no edit control and no delete control.

## 3. Advisor stays in the same thread

1. Sign in as **`advisor@example.com`** → Bloggs case.
2. **Case thread** shows both posts, oldest first, including the client's reply.
3. Post `I will introduce Priya and stay in this thread.`
4. Confirm the portal still shows all three messages after a refresh. The stage ledger is unchanged — no new evidence row, no new stage event from the post.

## 4. Assigned partner can post; the empty-stage view still has the thread

1. Advance Bloggs to `mortgage_path` (accept money-readiness evidence, including `fx_plan` on this overseas case, then advance twice) and warm-intro Priya if needed.
2. Sign in as **`mortgage@example.com`**. Open the Bloggs case.
3. If focus is `mortgage_path`, the thread sits under the vault. Post `DIP pack requested; I will update here.`
4. As advisor, accept `dip_aip` and **Advance stage** so focus leaves the mortgage partner.
5. Sign back in as **`mortgage@example.com`**. The page says **No assigned stage**. The **Case thread** is still there with every previous post. Post `Still watching the file from here.`
6. An unassigned partner account that is not a participant cannot open the case (`notFound` via `loadCaseForUser`).

## 5. Corridor cases stay threadless

1. Advisor opens **Chen AU→UK return (paid)** (`au_uk`).
2. There is no **Case thread** panel. Client and partner views of Chen are also threadless.
3. That is fail-closed: corridor packs have not proved the thread.

## 6. Marketing names the audit trail, not a live chat

1. Sign out → `/`.
2. The homepage has a short **One thread, not six inboxes** section. It names the append-only thread and a refresh, and it does not say live chat, websocket, or guarantee.
3. `/pricing` still withholds the case thread on the free card.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `CaseMessage` rows; append-only insert + list; role ACL; `case_threads: true` on `ew`; ThreadPanel on portal / cockpit / partner (including partner empty-stage); server-action post + `revalidatePath` |
| **Stubbed** | Nothing new. Partner adapters stay Plan 5 stubs. |
| **Absent** | WebSockets / SSE / push, message edit or delete, corridor threads, @mentions, in-thread attachments, seller views, open marketplace, hard-guarantee copy changes |

## Automated verification

```bash
npm test -- tests/domain/threads.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/server/thread-schema.test.ts tests/server/thread-store.test.ts tests/server/thread-policy.test.ts tests/server/thread-actions.test.ts tests/server/thread-ui.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
```

- [ ] **Step 2: Patch README and the older demo scripts**

In `README.md`, update the module-toggle paragraph so `ew` also runs `case_threads`, and the ew-only sentence lists it with the other ew-only modules:

```
`isModuleEnabled`. The `ew` pack runs `fx_deposit`, `partner_speed_rails`,
`chain_free_inventory`, `document_vault`, `hard_client_sla` and `case_threads`. The four corridor packs
(`au_uk`, `uk_au`, `us_uk`, `uk_us`) run `fx_deposit`, `corridor_inbound` and
`corridor_outbound`. `chain_free_inventory`, `partner_speed_rails`, `document_vault`,
`hard_client_sla` and `case_threads` stay **ew-only**. Enforced by
`tests/domain/market-pack-flags.test.ts`.
```

Insert a new section **after** the Client SLA overlay section and **before** `## Advisor operating IP`:

```md
## Case thread (paid E&W, append-only)

Spec §8. Paid England & Wales cases share one human thread:

- Rows in Prisma (`CaseMessage`: `caseId`, `authorUserId`, `authorRole`, `body`, `createdAt`).
- Append-only. No edit, no delete, no websocket. Post is a server action; refresh to see new messages.
- Role ACL: advisor and the paid client read and post the whole thread; a partner reads and posts only when they are on the case (participant or active referral). `FREE_DIY` sees no panel.
- Same `ThreadPanel` on `/portal`, `/cockpit`, and `/partner` (including the partner empty-stage view).

Corridor packs stay threadless until the conversation is proved on `ew`.
The stage ledger is unchanged — posts are not `StageEvent`s.

Walkthrough: [`docs/superpowers/plans/demo-script-case-threads.md`](docs/superpowers/plans/demo-script-case-threads.md).
```

In the Client SLA “Not in this overlay” sentence, remove `threads` so it no longer claims threads are unbuilt:

```
**Not in this overlay:** a promised or guaranteed completion date, a Prisma SLA
column, a new stage, seller views, an open marketplace, corridor SLA,
S3, or FCA Appointed Representative status.
```

In `docs/superpowers/plans/demo-script-document-vault.md` section 1 step 2, list `case_threads` as **on** for `ew`. Change the Absent row from `corridor vault, threads, seller views` to `corridor vault, seller views, websocket chat`.

In `docs/superpowers/plans/demo-script-client-sla.md` section 1 step 2, list `case_threads` as **on** for `ew`. In the Absent row, delete `threads,` and keep `seller views, marketplace, corridor SLA, S3, FCA AR, enabling the au stub`.

In `docs/superpowers/plans/demo-script-core-portal.md` section 1 step 4, add a bullet:

```
   - **Case thread** lists the seeded advisor welcome and a compose box. Smith DIY has no thread.
```

In `docs/superpowers/plans/demo-script-market-packs.md` step 4 (the inspector module list), add `case_threads` to the **on** list for `ew` and add `; \`case_threads\` is the paid E&W multi-party case thread` after the SLA clause.

In `docs/superpowers/plans/demo-script-corridor-packs.md`:
- `ew` inspector step: add `case_threads` to the **on** list.
- corridor inspector step: add `case_threads` to the **off** list next to `document_vault`.

In `docs/superpowers/plans/demo-script-speed-rails.md` section 1 step 2, add `document_vault` and `case_threads` to the **on** list for `ew` so the inspector walkthrough matches the current flag matrix. Step 3: add `case_threads` to the **off** list for `au`.

- [ ] **Step 3: Confirm the docs match the flag matrix**

Open each patched demo script and check the `ew` on-list includes `case_threads` and every corridor / `au` off-list includes `case_threads`. The new demo script Absent row must contain `WebSockets` and must not list threads as unbuilt.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
npm test
npm run build
```

Expected: all existing tests green; new thread tests green; `next build` succeeds. If `npm test` reports a count, it is the previous suite plus the files this plan added — do not drop any Plan 1–9 test.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/demo-script-case-threads.md docs/superpowers/plans/demo-script-document-vault.md docs/superpowers/plans/demo-script-client-sla.md docs/superpowers/plans/demo-script-core-portal.md docs/superpowers/plans/demo-script-market-packs.md docs/superpowers/plans/demo-script-corridor-packs.md docs/superpowers/plans/demo-script-speed-rails.md README.md
git commit -m "docs: add case-thread demo script and flag lists"
```

---

## Self-review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| §8 Case-scoped thread with audit trail | Tasks 1, 3 — `CaseMessage` is the audit row |
| §6 Client portal includes thread | Task 6 |
| §6 Advisor cockpit notes / stays in the thread | Task 7 |
| §6 Partner mini-view | Task 7 (including empty-stage) |
| §5 Warm-intro threads behind paid | Tasks 1, 4, 6, 8 — `FREE_DIY` is `NONE` |
| §8 Stage engine remains source of truth | Locked: no `StageEvent` per post |
| §8 Country-agnostic engine | Tasks 1, 4 — `ENGINE_GLOBAL_FILES` |
| §8 Feature-flag future modules | Task 2 — `case_threads` ew-only |
| No websockets in v1 | Tasks 5–8 source scans + demo Absent row |
| Advisor / paid client / assigned partners can post | Tasks 1, 4, 5 |
| Not marketplace / seller inventory / hard-guarantee changes | Tasks 8–9 leave SLA copy and inventory patterns untouched |

**2. Placeholder scan**

No TBD / TODO / “implement later” / “similar to Task N” / “add validation” leftovers. Every code step has the full file or the exact insertion.

**3. Type consistency**

| Name | Defined | Used later |
|---|---|---|
| `CaseMessageRecord` | Task 1 | Tasks 3–7 |
| `ThreadActor` / `ThreadViewer` | Task 1 | Tasks 4–7 |
| `ThreadError` / `ThreadErrorCode` | Task 1 | Tasks 4–5 |
| `threadPermission` / `canReadThread` / `canPostThread` / `assertCanPostThread` | Task 1 | Tasks 4, 6, 7 |
| `visibleCaseMessages` | Task 1 | Task 4 as `listVisibleCaseMessages` |
| `assertValidThreadBody` / `normalizeThreadBody` | Task 1 | Task 4 |
| `assertAppendOnly` / `assertMessageImmutable` | Task 1 | Tasks 3–4 |
| `MIN_THREAD_BODY_LENGTH` / `MAX_THREAD_BODY_LENGTH` | Task 1 (`1` / `4000`) | Task 6 textarea |
| `canUseThreads` / `assertThreadsEnabled` | Task 4 | Tasks 5–7 |
| `threadViewerFor` / `partnerThreadFlags` | Task 4 | Tasks 5–7 |
| `loadVisibleCaseMessages` / `performPostMessage` | Task 4 | Tasks 5–7 |
| `insertCaseMessage` / `listCaseMessages` / `getCaseMessageById` | Task 3 | Task 4 |
| `postCaseMessageAction` / `ThreadActionResult` | Task 5 | Task 6 |
| `ThreadPanel` | Task 6 | Tasks 6–7 |
| `CASE_THREAD_HOOK` | Task 8 | Task 8 homepage + tests |
| `case_threads` | Task 2 | Tasks 4, 8, 9 |

No `clearLayers` / `clearFullLayers` style drift. Policy re-exports visibility as `listVisibleCaseMessages` so actions and pages never import the domain filter under a second name when they already have the server helper; domain tests still call `visibleCaseMessages` directly.

**4. YAGNI held**

No StageEvent per post, no User FK, no `updatedAt`, no websocket, no corridor enablement, no message attachments, no edit/delete, no guarantee-copy edits, no adapter changes.