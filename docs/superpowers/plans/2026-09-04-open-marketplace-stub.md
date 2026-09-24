# Open Marketplace Stub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the architecture can name an open partner marketplace without shipping one: add `open_marketplace` as a market-module flag, keep it **disabled on every registered pack**, and surface a curated-vs-open policy row on the pack inspector. Do **not** add a third-party browse UI.

**Architecture:** Flag + inspector policy only. Same “architecture ready only” shape as the disabled `au` stub.

1. **Key** — `open_marketplace` joins `MarketModuleKey` / `MARKET_MODULE_KEYS`. Omitted flags stay off (`isModuleEnabled` requires `=== true`).
2. **Policy** — `marketplacePolicy(flags)` returns `"curated_panel"` unless the flag is on, then `"open_marketplace"`. The inspector summary carries that field.
3. **Surfaces** — cockpit `/cockpit/market-packs` shows the policy. No `/marketplace` route, no partner self-signup, no third-party browse grid.

**The invariant that makes this a stub and not a marketplace:** every live pack stays `curated_panel`. Turning the flag on later is a product decision; this plan only proves the registry can say “open” without building browse.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§2 “Open partner marketplace” is a v1 non-goal; §7 “Small curated panel, not an open marketplace”).

**Builds on (already shipped, do not rebuild):**
- Plan 4 — `MarketModuleKey`, `packModules`, inspector.
- Plans 5–10 — speed rails, chain-free, corridors, vault, SLA, threads. Leave those flags untouched.
- Plan 11 — `seller_milestone_views` on for `ew` only. Leave that flag untouched.

**Follow-on plans (not this plan):** actually enabling `open_marketplace` on a pack, partner self-signup, third-party browse, corridor vault (Plan 13), S3 vault backend (Plan 14).

**Current main:** `c2437b7` was Plan 9. This plan assumes Plans 10–11 (`case_threads`, `seller_milestone_views`) are also on `ew`.

## Global Constraints

Copied from the spec and the Plan 12 brief. Every task’s requirements implicitly include this section.

- **Curated panel remains the product:** §7. Do not enable `open_marketplace` on `ew`, the four corridor packs, or the `au` stub.
- **No browse UI:** do not create `src/app/marketplace`, `src/app/(marketing)/marketplace`, a partner directory “browse all vendors” page, or a third-party stock grid. The inspector naming the policy is the only new surface.
- **No partner self-signup.** Panel membership stays advisor-managed.
- **Leave shipped flags alone:** `seller_milestone_views`, `case_threads`, `document_vault`, `hard_client_sla`, `partner_speed_rails`, and `chain_free_inventory` stay on for `ew` and off everywhere else. Corridor inbound/outbound stay corridor-only.
- **Country-agnostic helpers:** `marketplacePolicy` lives next to `isModuleEnabled` in `types.ts`. No jurisdiction literals.
- **Engineering:** TDD per task; `npm test` stays green after each task’s own files; `npm test` + `npm run build` pass at the end; DRY, YAGNI.

## Locked design decisions

**Flag matrix (final, after Task 1 — `open_marketplace` is off on every row):**

| Pack | enabled | …shipped ew-only modules… | open_marketplace |
|---|---|---|---|
| `au` | false | all off | **off** |
| `ew` | true | on as already shipped | **off** |
| `au_uk` / `uk_au` / `us_uk` / `uk_us` | true | those ew-only modules off | **off** |

**Policy helper (locked):**

```ts
export type MarketplacePolicy = "curated_panel" | "open_marketplace";

export function marketplacePolicy(flags: MarketFlags): MarketplacePolicy {
  return isModuleEnabled(flags, "open_marketplace") ? "open_marketplace" : "curated_panel";
}
```

**Inspector:** `MarketPackSummary.marketplacePolicy: MarketplacePolicy`. Derived from flags; never stored on Prisma.

**Copy on the inspector card (locked):**
- When curated: label `Partner policy`, value `curated panel`, note `open marketplace off — architecture stub only`
- When open (unreachable on shipped packs): value `open marketplace`, note `third-party browse is still not shipped`

**Forbidden sales claims (locked, added to marketing):**

```ts
export const FORBIDDEN_MARKETPLACE_PATTERNS: RegExp[] = [
  /open marketplace/i,
  /browse (all )?partners/i,
  /partner self-?signup/i,
  /third[- ]party (stock|browse)/i,
];
```

Disclosures and the inspector may name “open marketplace” as something we do **not** run. `marketingClaimStrings()` still must not match those patterns.

## File structure (locked)

```
src/domain/market-packs/
  types.ts                                     # MODIFY (Task 1): key; (Task 2): policy helper
  inspector.ts                                 # MODIFY (Task 2): marketplacePolicy on summary
src/app/cockpit/market-packs/page.tsx          # MODIFY (Task 4): policy card
src/content/marketing.ts                       # MODIFY (Task 5): forbidden browse patterns
tests/domain/
  market-pack-flags.test.ts                    # MODIFY (Task 1)
  market-pack-types.test.ts                    # MODIFY (Task 1)
  market-pack-inspector.test.ts                # MODIFY (Task 2)
  open-marketplace-stub.test.ts                # NEW (Task 3 + 5)
  market-pack-registry.test.ts                 # MODIFY (Task 3) if needed for au stub comment only
tests/content/marketing-copy.test.ts           # MODIFY (Task 5)
docs/superpowers/plans/
  demo-script-open-marketplace.md              # NEW (Task 6)
  demo-script-market-packs.md                  # MODIFY (Task 6)
  demo-script-partner-network.md               # MODIFY (Task 6)
README.md                                      # MODIFY (Task 6)
```

**Layering rule:** `marketplacePolicy` does not import packs, Prisma, or Next. The inspector remains pack-generic. No new app route under `marketplace`.

---

### Task 1: Add `open_marketplace` to `MarketModuleKey` and keep it off everywhere

**Files:**
- Modify: `src/domain/market-packs/types.ts`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-types.test.ts`

**Interfaces:**
- Consumes: existing `MarketModuleKey` / `MARKET_MODULE_KEYS` / `isModuleEnabled`.
- Produces: `"open_marketplace"` is a valid key; `isModuleEnabled(pack.flags, "open_marketplace")` is `false` for every pack returned by `listMarketPacks()`.

- [ ] **Step 1: Write the failing tests**

In `tests/domain/market-pack-types.test.ts`, inside `keeps the module and copy key sets closed`, add:

```ts
    expect(MARKET_MODULE_KEYS).toContain("open_marketplace");
```

In `tests/domain/market-pack-flags.test.ts`, add this block after the seller-milestone example (or after the last module-flag example if Plan 11 is not yet on disk when you start — append after `case_threads` in that case, then keep the seller-milestone test if it exists):

```ts
  it("keeps the open marketplace off in every registered pack", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "open_marketplace"))
      .map((pack) => pack.id);
    expect(enabled).toEqual([]);
    expect(MARKET_MODULE_KEYS).toContain("open_marketplace");
    for (const pack of listMarketPacks()) {
      expect(isModuleEnabled(pack.flags, "open_marketplace")).toBe(false);
    }
  });
```

Add `MARKET_MODULE_KEYS` to the existing import from `types` in `market-pack-flags.test.ts` if it is not already imported.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/domain/market-pack-types.test.ts tests/domain/market-pack-flags.test.ts`

Expected: FAIL — `"open_marketplace"` is not in `MARKET_MODULE_KEYS` and is not assignable to `MarketModuleKey`.

- [ ] **Step 3: Append the key**

In `src/domain/market-packs/types.ts`, append only. Do not reorder existing keys and do **not** set the flag on any pack file:

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
  | "seller_milestone_views"
  | "open_marketplace";

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
  "open_marketplace",
];
```

If Plan 11 has not been merged when you execute this task, append `open_marketplace` after whatever the last shipped key is (`seller_milestone_views` or `case_threads`). Do not invent a second ordering.

Do not edit `ew-config.ts`, corridor configs, or `au-stub.ts`. Omitted is off.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/domain/market-pack-types.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/ew-pack.test.ts`

Expected: PASS. Inspector length assertions use `MARKET_MODULE_KEYS.length`, so they grow by one and every new row is `enabled: false`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/types.ts tests/domain/market-pack-types.test.ts tests/domain/market-pack-flags.test.ts
git commit -m "feat: register open_marketplace as a globally disabled module flag"
```

---

### Task 2: Curated-vs-open policy on the inspector summary

**Files:**
- Modify: `src/domain/market-packs/types.ts` — add `MarketplacePolicy` and `marketplacePolicy`
- Modify: `src/domain/market-packs/inspector.ts` — put `marketplacePolicy` on `MarketPackSummary`
- Modify: `tests/domain/market-pack-inspector.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` only if you add a new file (you should not)

**Interfaces:**
- Consumes: `MarketFlags`, `isModuleEnabled`.
- Produces: `marketplacePolicy(flags: MarketFlags): MarketplacePolicy`; `MarketPackSummary.marketplacePolicy`.

- [ ] **Step 1: Write the failing tests**

In `tests/domain/market-pack-inspector.test.ts`, add assertions to the first `ew` summary example:

```ts
    expect(summary.marketplacePolicy).toBe("curated_panel");
```

and to the corridor example:

```ts
    expect(inbound.marketplacePolicy).toBe("curated_panel");
```

and to the `au` stub example:

```ts
    expect(stub.marketplacePolicy).toBe("curated_panel");
```

In `tests/domain/market-pack-types.test.ts`, add:

```ts
  it("treats an omitted open_marketplace flag as a curated panel", () => {
    expect(marketplacePolicy({})).toBe("curated_panel");
    expect(marketplacePolicy({ open_marketplace: false })).toBe("curated_panel");
    expect(marketplacePolicy({ open_marketplace: true })).toBe("open_marketplace");
  });
```

Import `marketplacePolicy` from `types`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/domain/market-pack-inspector.test.ts tests/domain/market-pack-types.test.ts`

Expected: FAIL — `marketplacePolicy` is not exported and `summary.marketplacePolicy` is undefined.

- [ ] **Step 3: Add the helper and the summary field**

In `src/domain/market-packs/types.ts`, immediately after `isModuleEnabled`:

```ts
export type MarketplacePolicy = "curated_panel" | "open_marketplace";

export function marketplacePolicy(flags: MarketFlags): MarketplacePolicy {
  return isModuleEnabled(flags, "open_marketplace") ? "open_marketplace" : "curated_panel";
}
```

In `src/domain/market-packs/inspector.ts`:

1. Import `marketplacePolicy` and `MarketplacePolicy` from `./types`.
2. Add `marketplacePolicy: MarketplacePolicy` to `MarketPackSummary`.
3. In `marketPackSummary`, set `marketplacePolicy: marketplacePolicy(pack.flags)`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/domain/market-pack-inspector.test.ts tests/domain/market-pack-types.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/types.ts src/domain/market-packs/inspector.ts tests/domain/market-pack-inspector.test.ts tests/domain/market-pack-types.test.ts
git commit -m "feat: expose curated-vs-open marketplace policy on pack inspector"
```

---

### Task 3: Registry proof — every pack reports curated, none report open

**Files:**
- Create: `tests/domain/open-marketplace-stub.test.ts`

**Interfaces:**
- Consumes: `listMarketPacks`, `marketplacePolicy`, `isModuleEnabled`, `marketPackSummary`.
- Produces: a single test file that locks “architecture proof, not a product”.

- [ ] **Step 1: Write the failing/locking tests**

Create `tests/domain/open-marketplace-stub.test.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listMarketPacks } from "../../src/domain/market-packs/registry";
import { marketPackSummary } from "../../src/domain/market-packs/inspector";
import { isModuleEnabled, marketplacePolicy } from "../../src/domain/market-packs/types";

describe("open marketplace is an architecture stub", () => {
  it("lists curated_panel for every registered pack, including the au stub", () => {
    const packs = listMarketPacks();
    expect(packs.map((pack) => pack.id).sort()).toEqual([
      "au",
      "au_uk",
      "ew",
      "uk_au",
      "uk_us",
      "us_uk",
    ]);
    for (const pack of packs) {
      expect(isModuleEnabled(pack.flags, "open_marketplace")).toBe(false);
      expect(marketplacePolicy(pack.flags)).toBe("curated_panel");
      expect(marketPackSummary(pack, "UK_RESIDENT_SPEED").marketplacePolicy).toBe("curated_panel");
    }
  });

  it("does not ship a third-party browse route", () => {
    const root = process.cwd();
    expect(existsSync(path.join(root, "src/app/marketplace"))).toBe(false);
    expect(existsSync(path.join(root, "src/app/(marketing)/marketplace"))).toBe(false);
    expect(existsSync(path.join(root, "src/app/(marketing)/partners/browse"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/domain/open-marketplace-stub.test.ts`

Expected: PASS after Task 2 (the helper exists). If you run this file before Task 2, it FAILs on `marketplacePolicy` — that is the TDD order: Task 2 first, then this file as the registry lock. If you create this file in this task after Task 2, Step 2 should PASS on the first run; that is acceptable because Task 1–2 already proved the flag. The browse-route assertions are the new lock.

If `marketplacePolicy` is missing when you start this task, implement Task 2 first. Do not skip it.

- [ ] **Step 3: No production code unless a route already exists**

If any of the three paths in the test exist, delete that browse UI. Do not replace it with a stub page. The inspector is the surface.

- [ ] **Step 4: Re-run**

Run: `npx vitest run tests/domain/open-marketplace-stub.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/domain/open-marketplace-stub.test.ts
git commit -m "test: lock open marketplace as a curated-panel architecture stub"
```

---

### Task 4: Inspector page shows the policy

**Files:**
- Modify: `src/app/cockpit/market-packs/page.tsx`
- Create: `tests/server/marketplace-policy-ui.test.ts`

**Interfaces:**
- Consumes: `summary.marketplacePolicy`.
- Produces: a fourth summary card (or a row under Modules) that prints the locked copy from Locked design decisions.

- [ ] **Step 1: Write the failing UI-shape test**

Create `tests/server/marketplace-policy-ui.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  path.resolve(process.cwd(), "src/app/cockpit/market-packs/page.tsx"),
  "utf8",
);

describe("market pack inspector partner policy", () => {
  it("renders curated-vs-open policy from the summary", () => {
    expect(page).toMatch(/marketplacePolicy/);
    expect(page).toMatch(/curated panel/);
    expect(page).toMatch(/open marketplace off/);
    expect(page).not.toMatch(/href=["']\/marketplace/);
    expect(page).not.toMatch(/Browse partners/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/server/marketplace-policy-ui.test.ts`

Expected: FAIL — the page does not mention `marketplacePolicy`.

- [ ] **Step 3: Add the policy card**

In `src/app/cockpit/market-packs/page.tsx`, change the summary-card grid from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4` and append a fourth card to the array:

```ts
          {
            label: "Partner policy",
            value:
              summary.marketplacePolicy === "open_marketplace"
                ? "open marketplace"
                : "curated panel",
            note:
              summary.marketplacePolicy === "open_marketplace"
                ? "third-party browse is still not shipped"
                : "open marketplace off — architecture stub only",
          },
```

Do not add a link to `/marketplace`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/server/marketplace-policy-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/cockpit/market-packs/page.tsx tests/server/marketplace-policy-ui.test.ts
git commit -m "feat: show curated-vs-open policy on the market pack inspector"
```

---

### Task 5: Marketing must not sell an open marketplace

**Files:**
- Modify: `src/content/marketing.ts`
- Modify: `tests/content/marketing-copy.test.ts`

**Interfaces:**
- Consumes: `marketingClaimStrings`.
- Produces: `FORBIDDEN_MARKETPLACE_PATTERNS` applied to every sales string.

- [ ] **Step 1: Write the failing tests**

In `tests/content/marketing-copy.test.ts`, import `FORBIDDEN_MARKETPLACE_PATTERNS` and add:

```ts
describe("open marketplace stays a non-goal in sales copy", () => {
  it("never advertises browse, self-signup, or an open marketplace", () => {
    for (const text of marketingClaimStrings()) {
      for (const pattern of FORBIDDEN_MARKETPLACE_PATTERNS) {
        expect(pattern.test(text), `"${text}" matches ${pattern}`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/content/marketing-copy.test.ts`

Expected: FAIL — `FORBIDDEN_MARKETPLACE_PATTERNS` is not exported.

- [ ] **Step 3: Add the patterns**

In `src/content/marketing.ts`, immediately after `FORBIDDEN_INVENTORY_PATTERNS`:

```ts
export const FORBIDDEN_MARKETPLACE_PATTERNS: RegExp[] = [
  /open marketplace/i,
  /browse (all )?partners/i,
  /partner self-?signup/i,
  /third[- ]party (stock|browse)/i,
];
```

Do not put those phrases into `HERO`, plan features, hooks, or stories. Inspector copy is not part of `marketingClaimStrings()`.

If an existing hook now fails (it should not), rewrite that hook without selling a marketplace. Do not weaken the regex.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/content/marketing-copy.test.ts tests/domain/open-marketplace-stub.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/marketing.ts tests/content/marketing-copy.test.ts
git commit -m "test: forbid open-marketplace claims in sales copy"
```

---

### Task 6: Demo script and README

**Files:**
- Create: `docs/superpowers/plans/demo-script-open-marketplace.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md` — mention the Partner policy card and that `open_marketplace` is **off** everywhere
- Modify: `docs/superpowers/plans/demo-script-partner-network.md` — keep “curated, not a marketplace”; add that the flag now exists and stays off
- Modify: `README.md`

**Interfaces:**
- Produces: a founder click-script that states what is real (flag key, inspector policy, curated panel) and what is absent (browse UI, self-signup, any pack with the flag on).

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-open-marketplace.md`:

```md
# Open marketplace stub demo script

Founder validation script for spec §2 / §7: the platform can *name* an open partner marketplace as a future module without shipping one. Every pack stays a curated panel. There is no third-party browse UI.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The flag exists and is off

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Under **Modules**, `open_marketplace` is **off**. Shipped ew-only modules stay **on**.
3. The **Partner policy** card reads **curated panel** with note **open marketplace off — architecture stub only**.
4. Repeat for `au_uk`, `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub. Policy is curated on every pack.

## 2. There is nothing to browse

1. Visit `/marketplace` — 404.
2. Visit `/partners/browse` if you try it — 404.
3. `/cockpit/panel` is still the advisor-managed curated panel. There is no partner self-signup.

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `open_marketplace` on `MarketModuleKey`; `marketplacePolicy()`; inspector card |
| **Stubbed** | The open state of the helper (`flags.open_marketplace === true`) is tested with a fixture only |
| **Absent** | Browse UI, self-signup, enabling the flag on any pack, third-party stock |

## Automated verification

```bash
npm test -- tests/domain/open-marketplace-stub.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/server/marketplace-policy-ui.test.ts tests/content/marketing-copy.test.ts
```
```

In `README.md`, after the market-pack / partner-network paragraphs, add:

```md
## Open marketplace (architecture stub)

Spec §2 / §7. `open_marketplace` is a registered module key and stays **off** on
every pack. The pack inspector reports `marketplacePolicy: curated_panel`.
There is no browse UI and no partner self-signup.

Walkthrough: [`docs/superpowers/plans/demo-script-open-marketplace.md`](docs/superpowers/plans/demo-script-open-marketplace.md).
```

In `docs/superpowers/plans/demo-script-market-packs.md` section 1, add: Modules include `open_marketplace` **off** on every pack; the Partner policy card says curated panel.

- [ ] **Step 2: Full verification**

Run: `npm test` then `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/demo-script-open-marketplace.md docs/superpowers/plans/demo-script-market-packs.md docs/superpowers/plans/demo-script-partner-network.md README.md
git commit -m "docs: add open marketplace architecture-stub demo script"
```

---

## Self-review

**Spec coverage:**
- §2 open marketplace is a v1 non-goal → Tasks 1, 3, 5 keep the flag off and forbid sales claims.
- §7 curated panel → Task 2–4 always report `curated_panel` for shipped packs.

**Placeholder scan:** no TBD / browse-UI-later instructions that ship a page.

**Type consistency:** `MarketplacePolicy` and `marketplacePolicy()` names match from Task 2 through Task 4.

**Non-goals honoured:** no `/marketplace` route, no self-signup, no pack enablement, no seller inventory, no vault/SLA/thread flag edits.
