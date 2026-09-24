# Corridor Document Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `document_vault` on for the four live corridor packs (`au_uk`, `us_uk`, `uk_au`, `uk_us`) so paid corridor cases reuse the existing vault stack (ACL, one-time upload, local filesystem, vault-required submit). The disabled `au` stub stays off. Do not rebuild the vault.

**Architecture:** Flag flip + test/docs updates. The vault already fail-closes on `isModuleEnabled(casePack(caseState).flags, "document_vault")` and already ignores jurisdiction. Corridor packs already resolve through `casePack`. Enabling the flag is the product change; everything else is proving reuse.

**The invariant that makes this reuse and not a second vault:** do not add `CorridorVault`, a second Prisma model, or corridor-specific ACL. `src/domain/vault.ts`, `src/server/vault.ts`, `src/server/vault-store.ts`, `VaultUploadForm`, `VaultPanel`, and `GET /api/vault/[documentId]` stay the implementation.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§8 document vault; §10 corridors reuse the engine; what travels is the portal pressure model).

**Builds on (already shipped, do not rebuild):**
- Plan 7 — four corridor packs; `document_vault` currently off on each.
- Plan 8 — vault stack on for `ew`. `canUseVault` already reads the pack flag.
- Plans 9–12 — SLA, threads, seller views, open-marketplace stub. Leave those flags untouched. Do not enable vault on `au`.

**Follow-on plans (not this plan):** S3 / `VaultStorageBackend` (Plan 14), corridor threads, corridor seller views, enabling the `au` stub.

**Current main:** `c2437b7` was Plan 9. This plan assumes Plans 10–12 are also merged (`case_threads` and `seller_milestone_views` ew-only; `open_marketplace` off everywhere).

## Global Constraints

Copied from the spec and the Plan 13 brief. Every task’s requirements implicitly include this section.

- **Reuse the vault stack.** Do not fork `vault.ts`, `vault-store.ts`, upload forms, or the download route.
- **Four corridor packs only:** `au_uk`, `us_uk`, `uk_au`, `uk_us`. The `au` stub stays `flags: {}` / vault off.
- **`ew` stays on.** Do not turn `document_vault` off on England & Wales.
- **Paid only.** `canUseVault` already requires `PAID_DWY`. Free corridor cases stay note-only.
- **Leave other flags alone.** Do not enable `chain_free_inventory`, `partner_speed_rails`, `hard_client_sla`, `case_threads`, or `seller_milestone_views` on corridor packs. Do not enable `open_marketplace` anywhere.
- **Country-agnostic vault stays country-agnostic.** No jurisdiction literals in vault modules. Corridor titles already live on the packs.
- **No Prisma schema change.** `VaultDocument` is already case-scoped.
- **Engineering:** TDD per task; `npm test` stays green after each task’s own files; `npm test` + `npm run build` pass at the end; DRY, YAGNI.

## Locked design decisions

**Flag matrix (final, after Task 2):**

| Pack | enabled | fx_deposit | corridor_inbound | corridor_outbound | partner_speed_rails | chain_free_inventory | hard_client_sla | document_vault | case_threads | seller_milestone_views | open_marketplace |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `au` | false | off | off | off | off | off | off | **off** | off | off | off |
| `ew` | true | on | off | off | on | on | on | on | on | on | off |
| `au_uk` | true | on | on | on | off | off | off | **on** | off | off | off |
| `uk_au` | true | on | on | on | off | off | off | **on** | off | off | off |
| `us_uk` | true | on | on | on | off | off | off | **on** | off | off | off |
| `uk_us` | true | on | on | on | off | off | off | **on** | off | off | off |

**Policy after the flip (already implemented, must keep working):**
- `canUseVault` is true for `PAID_DWY` + those five packs (`ew` + four corridors).
- `canUseVault` is false for `FREE_DIY`, for `au`, and for an unknown pack id (caught → false).
- `assertVaultSubmitAllowed` still requires an `ACTIVE` document when the flag is on.

**Corridor flag objects stay explicit.** Add `document_vault: true` next to the existing corridor flags. Do not copy `EW_FLAGS`.

## File structure (locked)

```
src/domain/market-packs/
  au-uk-config.ts                              # MODIFY (Task 2)
  us-uk-config.ts                              # MODIFY (Task 2)
  uk-au-config.ts                              # MODIFY (Task 2)
  uk-us-config.ts                              # MODIFY (Task 2)
  au-stub.ts                                   # UNCHANGED (vault stays off)
tests/domain/
  market-pack-flags.test.ts                    # MODIFY (Task 1)
  market-pack-inspector.test.ts                # MODIFY (Task 3)
  au-uk-pack.test.ts                           # MODIFY (Task 3)
  us-uk-pack.test.ts                           # MODIFY (Task 3)
  uk-au-pack.test.ts                           # MODIFY (Task 3)
  uk-us-pack.test.ts                           # MODIFY (Task 3)
tests/server/
  vault-policy.test.ts                         # MODIFY (Task 4)
  vault-corridor.test.ts                       # NEW (Task 5)
docs/superpowers/plans/
  demo-script-document-vault.md                # MODIFY (Task 6)
  demo-script-corridor-packs.md                # MODIFY (Task 6)
  demo-script-market-packs.md                  # MODIFY (Task 6)
README.md                                      # MODIFY (Task 7)
```

**Layering rule:** no new vault module. Config files remain the only corridor code you edit besides tests and docs.

---

### Task 1: Rewrite the flag tests so corridor vault is required

**Files:**
- Modify: `tests/domain/market-pack-flags.test.ts`

**Interfaces:**
- Consumes: `listMarketPacks`, `isModuleEnabled`, `CORRIDOR_PACK_IDS`.
- Produces: the document-vault example expects `["au_uk", "ew", "uk_au", "uk_us", "us_uk"]` (sorted pack ids) and still asserts `au` is off.

- [ ] **Step 1: Write the failing test change**

Replace the existing `runs the document vault in England & Wales only` example in `tests/domain/market-pack-flags.test.ts` with:

```ts
  it("runs the document vault on England & Wales and every live corridor pack", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "document_vault"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["au_uk", "ew", "uk_au", "uk_us", "us_uk"]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "document_vault")).toBe(
      false,
    );
    expect(isModuleEnabled(EW_FLAGS, "document_vault")).toBe(true);
    for (const id of CORRIDOR_PACK_IDS) {
      expect(isModuleEnabled(listMarketPacks().find((p) => p.id === id)!.flags, "document_vault")).toBe(
        true,
      );
    }
  });
```

Keep the `au` stub assertion. Do not change the chain-free / speed-rails / SLA / threads / seller-views / open-marketplace examples.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts`

Expected: FAIL — enabled vault packs are still `["ew"]`.

- [ ] **Step 3: Do not flip flags in this task**

Leave the failure in place. Task 2 is the implementation.

- [ ] **Step 4: Confirm the failure is the assertion, not a compile error**

Expected output includes `expected [ 'ew' ] to deeply equal [ 'au_uk', 'ew', 'uk_au', 'uk_us', 'us_uk' ]` (or the current `["ew"]` vs the new list).

- [ ] **Step 5: Commit the failing test**

TDD allows committing the red test with the implementation in the next task. Skip a red-only commit if the repo convention is green-only; in that case keep the test edit uncommitted until Task 2. Preferred here: keep it uncommitted and land it with Task 2.

---

### Task 2: Turn `document_vault` on for the four corridor packs

**Files:**
- Modify: `src/domain/market-packs/au-uk-config.ts`
- Modify: `src/domain/market-packs/us-uk-config.ts`
- Modify: `src/domain/market-packs/uk-au-config.ts`
- Modify: `src/domain/market-packs/uk-us-config.ts`

**Interfaces:**
- Consumes: existing `AU_UK_FLAGS` / `US_UK_FLAGS` / `UK_AU_FLAGS` / `UK_US_FLAGS`.
- Produces: each object includes `document_vault: true` alongside `fx_deposit`, `corridor_inbound`, and `corridor_outbound`.

- [ ] **Step 1: Confirm Task 1 is still red**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts`

Expected: FAIL on the vault pack list.

- [ ] **Step 2: Flip the four flag objects**

`src/domain/market-packs/au-uk-config.ts`:

```ts
export const AU_UK_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
  document_vault: true,
};
```

`src/domain/market-packs/us-uk-config.ts`:

```ts
export const US_UK_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
  document_vault: true,
};
```

`src/domain/market-packs/uk-au-config.ts`:

```ts
export const UK_AU_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
  document_vault: true,
};
```

`src/domain/market-packs/uk-us-config.ts`:

```ts
export const UK_US_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
  document_vault: true,
};
```

Do not add comments that copy E&W SLA / threads / chain-free language onto corridors. Optional one-liner on each file is allowed:

```ts
/** Plan 13: reuse the paid document vault. Not a domestic AU/US product. */
```

Do **not** edit `au-stub.ts`. `flags: {}` stays.

- [ ] **Step 3: Run the flag tests**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts`

Expected: FAIL on corridor pack snapshots / inspector / vault-policy (those still expect vault off) **or** PASS if you have not updated those files yet and they do not snapshot the full flags object.

`au-uk-pack.test.ts`, `us-uk-pack.test.ts`, `uk-au-pack.test.ts`, and `uk-us-pack.test.ts` snapshot `flags` with three keys — those will FAIL. That is Task 3. The flags test from Task 1 should now PASS.

- [ ] **Step 4: Re-run the flags file alone and confirm it passes**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit flags + the Task 1 test together**

```bash
git add src/domain/market-packs/au-uk-config.ts src/domain/market-packs/us-uk-config.ts src/domain/market-packs/uk-au-config.ts src/domain/market-packs/uk-us-config.ts tests/domain/market-pack-flags.test.ts
git commit -m "feat: enable document_vault on the four live corridor packs"
```

---

### Task 3: Update corridor pack snapshots and the inspector

**Files:**
- Modify: `tests/domain/au-uk-pack.test.ts`
- Modify: `tests/domain/us-uk-pack.test.ts`
- Modify: `tests/domain/uk-au-pack.test.ts`
- Modify: `tests/domain/uk-us-pack.test.ts`
- Modify: `tests/domain/market-pack-inspector.test.ts`

**Interfaces:**
- Consumes: the four flag objects from Task 2.
- Produces: snapshots include `document_vault: true`; inspector corridor summary expects vault **on**; `au` stub and ew-only modules stay off.

- [ ] **Step 1: Write the failing (or currently failing) snapshot updates**

In `tests/domain/au-uk-pack.test.ts`, change the flags snapshot to:

```ts
    expect(auUkMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
      document_vault: true,
    });
```

Keep `chain_free_inventory`, `partner_speed_rails`, and `hard_client_sla` assertions as `false`.

In `tests/domain/us-uk-pack.test.ts`, same four-key snapshot on `usUkMarketPack.flags`.

In `tests/domain/uk-au-pack.test.ts`, change the flags snapshot to the same four keys and **change** the existing:

```ts
    expect(isModuleEnabled(ukAuMarketPack.flags, "document_vault")).toBe(false);
```

to:

```ts
    expect(isModuleEnabled(ukAuMarketPack.flags, "document_vault")).toBe(true);
```

Keep `case_threads` and `seller_milestone_views` (if present) as `false`. Keep `auStubPack.enabled === false`.

In `tests/domain/uk-us-pack.test.ts`, same four-key snapshot.

In `tests/domain/market-pack-inspector.test.ts`, change the corridor example:

```ts
    expect(inbound.modules.find((m) => m.key === "document_vault")?.enabled).toBe(true);
```

Keep `chain_free_inventory`, `case_threads`, `hard_client_sla`, and `seller_milestone_views` (if asserted) **false** on the inbound corridor summary.

- [ ] **Step 2: Run the pack tests**

Run: `npx vitest run tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/uk-us-pack.test.ts tests/domain/market-pack-inspector.test.ts`

Expected: PASS after the snapshot edits (flags already flipped in Task 2). If you run this step before Task 2, they FAIL — do Task 2 first.

- [ ] **Step 3: No production edits in this task unless a snapshot was missed**

If `tests/domain/ew-pack.test.ts` fails, you accidentally changed `EW_FLAGS`. Revert that. `ew` already has `document_vault: true`.

- [ ] **Step 4: Re-run**

Run: `npx vitest run tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/uk-us-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/market-pack-registry.test.ts`

Expected: PASS. Registry tests must still show `au` disabled and corridor ids unchanged.

- [ ] **Step 5: Commit**

```bash
git add tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/uk-us-pack.test.ts tests/domain/market-pack-inspector.test.ts
git commit -m "test: expect document_vault on live corridor packs, not the au stub"
```

---

### Task 4: Vault policy treats paid corridor cases as vault-on

**Files:**
- Modify: `tests/server/vault-policy.test.ts`

**Interfaces:**
- Consumes: `canUseVault`, `assertVaultEnabled`, `assertVaultSubmitAllowed`, `emptyVaultLookup`.
- Produces: paid `au_uk` / `uk_au` / `us_uk` / `uk_us` are open; free corridor and `au` stay closed.

- [ ] **Step 1: Rewrite the module-gate example**

Replace `is open for paid England & Wales and closed otherwise` in `tests/server/vault-policy.test.ts` with:

```ts
  it("is open for paid England & Wales and paid corridor packs, and closed otherwise", async () => {
    expect(canUseVault(paid())).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "au_uk" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "uk_au" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "us_uk" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "uk_us" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "au" })).toBe(false);
    expect(canUseVault({ ...paid("vp2"), tier: "FREE_DIY" })).toBe(false);
    expect(canUseVault({ ...paid("vp3"), tier: "FREE_DIY", marketPackId: "au_uk" })).toBe(false);
    expect(() => assertVaultEnabled(paid())).not.toThrow();
    expect(() => assertVaultEnabled({ ...paid(), marketPackId: "au_uk" })).not.toThrow();
    expect(() => assertVaultEnabled({ ...paid(), marketPackId: "au" })).toThrow(VaultError);

    await expect(
      assertVaultSubmitAllowed(
        { ...paid(), marketPackId: "au_uk" },
        "purchase_profile",
        "profile_complete",
        emptyVaultLookup,
      ),
    ).rejects.toMatchObject({ code: "VAULT_REQUIRED" });
  });
```

`createCase({ marketPackId: "au" })` throws `MarketPackError` because `au` is disabled. The test above spreads `paid()` and overwrites `marketPackId` without going back through `createCase`, which is the same pattern the current file uses for `au_uk`. Keep that pattern so `casePack` hits `resolveMarketPack("au")` and throws; `canUseVault` catches and returns `false`.

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/server/vault-policy.test.ts`

Expected: PASS after Task 2. If Task 2 is missing, `au_uk` is still false and this FAIL.

- [ ] **Step 3: Do not change `src/server/vault.ts`**

If you need to edit `canUseVault` to special-case corridors, you have forked the stack — revert and rely on the flag.

- [ ] **Step 4: Re-run vault policy + flags**

Run: `npx vitest run tests/server/vault-policy.test.ts tests/domain/market-pack-flags.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/server/vault-policy.test.ts
git commit -m "test: require vault presence on paid corridor cases"
```

---

### Task 5: Prove submit + UI reuse the same stack on a corridor case

**Files:**
- Create: `tests/server/vault-corridor.test.ts`

**Interfaces:**
- Consumes: `createCase({ marketPackId: "au_uk" })`, `canUseVault`, `assertVaultSubmitAllowed`, and the portal/partner page sources.
- Produces: a lock that corridor paid cases are vault-on and the existing pages still gate on `canUseVault` (not `marketPackId === "ew"`).

- [ ] **Step 1: Write the tests**

Create `tests/server/vault-corridor.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import {
  assertVaultSubmitAllowed,
  canUseVault,
  emptyVaultLookup,
} from "../../src/server/vault";

function paidCorridor(id: string, marketPackId: "au_uk" | "uk_au" | "us_uk" | "uk_us") {
  return createCase({
    id,
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    marketPackId,
  });
}

describe("corridor cases reuse the document vault", () => {
  it("opens the same gate on each live corridor pack", async () => {
    for (const id of ["au_uk", "uk_au", "us_uk", "uk_us"] as const) {
      const caseState = paidCorridor(`vc_${id}`, id);
      expect(caseState.marketPackId).toBe(id);
      expect(canUseVault(caseState)).toBe(true);
      await expect(
        assertVaultSubmitAllowed(caseState, "purchase_profile", "profile_complete", emptyVaultLookup),
      ).rejects.toBeInstanceOf(VaultError);
    }
  });

  it("does not hard-code England & Wales in the vault surfaces", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const partner = readFileSync(
      path.resolve(process.cwd(), "src/app/partner/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const cockpit = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
      "utf8",
    );
    for (const source of [portal, partner, cockpit]) {
      expect(source).toMatch(/canUseVault/);
      expect(source).not.toMatch(/marketPackId === ["']ew["']/);
      expect(source).not.toMatch(/document_vault.*ew only/i);
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run tests/server/vault-corridor.test.ts tests/server/vault-ui.test.ts`

Expected: PASS. If a page hard-codes `ew`, FAIL — remove that hard-code and gate only on `canUseVault`. That is the only production edit allowed in this task.

- [ ] **Step 3: Fix any `ew`-only UI hard-code**

Search `src/app/portal/cases/[caseId]/page.tsx`, `src/app/partner/cases/[caseId]/page.tsx`, and `src/app/cockpit/cases/[caseId]/page.tsx` for `marketPackId === "ew"` next to vault UI. Replace with `canUseVault(caseState)` if found. Do not add corridor-specific vault components.

- [ ] **Step 4: Re-run**

Run: `npx vitest run tests/server/vault-corridor.test.ts tests/server/vault-ui.test.ts tests/server/vault-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/server/vault-corridor.test.ts src/app/portal/cases/[caseId]/page.tsx src/app/partner/cases/[caseId]/page.tsx src/app/cockpit/cases/[caseId]/page.tsx
git commit -m "test: reuse the document vault stack on corridor cases"
```

If the three page files are unchanged, omit them from `git add`.

---

### Task 6: Demo scripts

**Files:**
- Modify: `docs/superpowers/plans/demo-script-document-vault.md`
- Modify: `docs/superpowers/plans/demo-script-corridor-packs.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md`

**Interfaces:**
- Produces: founder steps that exercise Chen AU→UK (or the seeded corridor paid case) through upload + submit, and that keep `au` off.

- [ ] **Step 1: Update the vault demo script**

In `docs/superpowers/plans/demo-script-document-vault.md`:

1. Change the title sentence from “England & Wales only” to “England & Wales and the four live corridor packs”.
2. Section 1 step 3: select `au_uk` and confirm `document_vault` is **on**. Repeat for `uk_au`, `us_uk`, `uk_us`. The disabled `au` stub stays **off**.
3. Replace section 5 (“Corridor cases stay on the old submit-without-file path”) with:

```md
## 5. Corridor paid cases use the same vault

1. Advisor opens **Chen AU→UK return (paid)** (`au_uk`).
2. **Document vault** is present. Client submit on that case is **Upload and submit**, not metadata-only.
3. Attach a PDF for `profile_complete` and submit. Download works for the client who uploaded it.
4. The disabled `au` stub still cannot back a case, so it never receives a vault.
```

4. Absent row: remove `corridor vault`. Keep `S3 / cloud storage`, `seller login`, `open marketplace browse`, `enabling the au stub`.

If the seeded case name differs, use the paid `au_uk` case from `prisma/seed.ts` (search for `au_uk`). Do not invent a new seed in this task unless no paid corridor case exists — if none exists, add one titled `Chen AU→UK return (paid)` with `marketPackId: "au_uk"`, `tier: "PAID_DWY"`, same password users as Bloggs. That seed edit belongs in this task only when the current seed has no paid corridor case.

- [ ] **Step 2: Update corridor and market-pack scripts**

In `docs/superpowers/plans/demo-script-corridor-packs.md` Absent row, delete `document vault` if listed as absent. Add: `document_vault` is **on** for the four live corridors; the `au` stub stays off.

In `docs/superpowers/plans/demo-script-market-packs.md` section 1 step 4, change `document_vault` from “paid E&W file store” to “paid file store on `ew` and the four live corridor packs”.

- [ ] **Step 3: Do not add a second vault demo**

One script. Corridor is a new section, not a new product.

- [ ] **Step 4: Skim for leftover “corridor vault stays off” sentences**

Search `docs/superpowers/plans` for `corridor vault` and `document_vault` `off` on `au_uk`. Update those sentences so they match the new matrix. Do not rewrite Plan 8’s historical plan file (`2026-09-04-document-vault.md`) — that document describes what Plan 8 shipped.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/demo-script-document-vault.md docs/superpowers/plans/demo-script-corridor-packs.md docs/superpowers/plans/demo-script-market-packs.md prisma/seed.ts
git commit -m "docs: show the document vault on live corridor packs"
```

Omit `prisma/seed.ts` if you did not touch it.

---

### Task 7: README flag matrix

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: README module-toggle paragraph and Document vault section match the Task 2 matrix.

- [ ] **Step 1: Update the market-pack paragraph**

Replace the sentences that say `document_vault` stays **ew-only** with:

```md
`document_vault` is on for `ew` and the four live corridor packs (`au_uk`,
`uk_au`, `us_uk`, `uk_us`). It stays **off** on the disabled `au` stub.
`chain_free_inventory`, `partner_speed_rails`, `hard_client_sla`,
`case_threads` and `seller_milestone_views` stay **ew-only**.
`open_marketplace` stays off everywhere.
```

- [ ] **Step 2: Update the Document vault section**

Change “Paid England & Wales cases” to “Paid England & Wales and live corridor cases”.

Replace “Corridor packs keep the metadata-only submit path until the vault is proved on `ew`.” with:

```md
Live corridor packs reuse the same vault stack. The disabled `au` stub does not.
No S3 in this release — bytes still live under `var/vault/`.
```

- [ ] **Step 3: Full verification**

Run: `npm test` then `npm run build`

Expected: PASS.

- [ ] **Step 4: Confirm `au` is still disabled**

Run: `npx vitest run tests/domain/market-pack-registry.test.ts`

Expected: PASS — `resolveMarketPack("au")` still throws.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: record corridor document vault in the README flag matrix"
```

---

## Self-review

**Spec coverage:**
- §8 document vault → reused, not rewritten (Tasks 4–5).
- §10 corridors reuse the engine → flag on live corridors only (Tasks 1–2).
- `au` stub remains architecture-ready only → never enabled (Tasks 2, 4, 7).

**Placeholder scan:** no “add validation” or “similar to ew” steps; corridor flag objects are written out four times.

**Type consistency:** pack ids stay `au_uk` / `uk_au` / `us_uk` / `uk_us`. `document_vault` remains the same `MarketModuleKey`.

**Non-goals honoured:** no second vault, no `au` product, no corridor chain-free / SLA / threads / seller views, no S3 (Plan 14), no open marketplace browse.
