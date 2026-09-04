# Market-Pack Configuration Layer (E&W First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `marketPackId` from a string that is always `"ew"` into a real configuration layer — a formal `MarketPack` interface (locale, currency, module flags, jurisdiction copy, partner-role labels, stage templates, entry-context playbooks, disclosure copy), a fail-closed registry that resolves a pack from `case.marketPackId`, every remaining England & Wales literal moved out of the engine-global domain into the `ew` pack, a disabled `au` stub that proves the registry, and an advisor-only read-only pack inspector.

**Architecture:** `src/domain/market-packs/` becomes a layered folder with no cycles: `types.ts` (interfaces + pack-parametric pure helpers + `MarketPackError`) ← `locale.ts`, `ew-config.ts`, `ew-stages.ts`, `ew-playbook.ts`, `ew-disclosure.ts` ← `ew.ts` / `au-stub.ts` (assembly only) ← `registry.ts` (fail-closed `resolveMarketPack`). Everything engine-global (`stage-engine.ts`, `case-admin.ts`, `freemium.ts`, `escalation.ts`, `scorecard.ts`, `panel.ts`, `referral.ts`, `server/mappers.ts`) stops importing `market-packs/ew` and resolves the pack from `caseState.marketPackId` instead. Module toggles are `MarketFlags` data on the pack read through one helper (`isModuleEnabled`), never scattered `if (marketPackId === ...)` checks. A source-scanning guard test keeps jurisdiction literals and `market-packs/ew` imports out of the engine-global files permanently.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§8 system shape / architecture stance, §9 roadmap + dependency rule, §10 international-ready model, §11 risks, §13 sub-project 4).

**Builds on (already shipped, do not rebuild):**
- `docs/superpowers/plans/2026-09-04-core-stage-portal.md` — stage engine (`src/domain/stage-engine.ts`: `CaseState`, `StageState`, `createCase`, `advanceStage`), `src/domain/market-packs/ew.ts` (nine E&W stage templates), `src/domain/escalation.ts`, `src/domain/freemium.ts`, portal / cockpit / partner surfaces, `src/server/mappers.ts` + `src/server/cases.ts` persistence.
- `docs/superpowers/plans/2026-09-04-acquisition-ops-playbook.md` — intake (`src/domain/intake.ts`), lead attribution, `/start` funnel, `CaseAdminControls`, advisor playbooks (`src/domain/market-packs/ew-playbook.ts`, `src/lib/cockpit-playbook.ts`, `src/components/PlaybookPanel.tsx`), `assertPlaybookVisible`.
- `docs/superpowers/plans/2026-09-04-partner-scorecards-referrals.md` — `PartnerPanel` + `Referral` Prisma models, `src/domain/panel.ts`, `src/domain/referral.ts` (fee status + E&W disclosure copy), `src/domain/scorecard.ts`, `src/domain/partner-ops.ts`, `src/server/panel.ts`, `src/server/referrals.ts`, `src/server/scorecards.ts`, warm intro / nudge / re-route actions, `PartnerDirectory`, `ReferralDisclosure`.

**Follow-on plans (not this plan):** deep partner integrations / speed rails (Plan 5), chain-free certification and matching (Plan 6), additional corridor market packs AU↔UK and US↔UK (Plan 7), document vault, hard client-facing SLAs, FCA Appointed Representative status, open partner marketplace.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include this section.

- **Country-agnostic engine:** "Stage engine | Country-agnostic: profile → money → finance → move → search → offer → diligence → complete → settle". No engine-global module may import `market-packs/ew` or contain a jurisdiction literal after Task 4.
- **Local layer is the pack:** "Market pack | E&W v1 = first pack (partners, regs, checklists, copy). Later AU, then others".
- **International-ready:** "country-agnostic stage engine; local rules/partners/copy live in market packs — do not encode UK-only assumptions into the domain model (currency, address, legal steps as config/data)". Currency, locale, address field order, legal stage steps and jurisdiction copy are pack **data**, never code branches.
- **What travels:** "Portal pressure model, freemium discipline, partner scorecards, advisor cockpit" stay engine-global and are not duplicated per pack.
- **What doesn't travel:** "Mortgage rules, conveyancing, land registries, consumer law, partner panels — always local". Disclosure copy, evidence standards, playbooks and panel membership resolve through the pack.
- **First pack only:** "England & Wales as first **market pack**; feature-flag future segments and modules". "Second-country market packs (architecture ready only)". The `au` pack in this plan is a **disabled stub**: it must not carry AU journeys, AU playbooks, AU partners or AU disclosure copy.
- **Dependency rule:** "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real. Speed credibility is earned in the ledger first." `chain_free_inventory` and `hard_client_sla` module flags must be off in every registered pack, guarded by a test.
- **Fail closed:** an unknown `marketPackId`, or a known-but-disabled one, must throw `MarketPackError` rather than silently defaulting to `ew`.
- **IP behind paid:** "Escalation rules and advisor cockpit behaviours" and "Detailed playbooks and evidence standards" are paid/advisor-only. The pack inspector is advisor-only (`/cockpit`), read-only, and must not render playbook prose (`PlaybookPanel` remains the only playbook surface).
- **Geography v1:** England & Wales only. Every live case keeps `marketPackId = "ew"`; `DEFAULT_MARKET_PACK_ID` is the single source of that default in TypeScript.
- **Accepted, documented exception:** `EntryContext` member names (`RETURNER_IN_UK`, `UK_RESIDENT_SPEED`) are persisted enum values from Plans 1–2 and are **not** renamed by this plan (that would rewrite DB rows, intake, marketing copy and forms for no behavioural gain). Entry context is metadata; packs localise it through `MarketCopy` and `buildPlaybooks(entry)`. Record this limitation in the README in Task 9.
- **Out of scope for pack extraction:** marketing-site copy in `src/content/marketing.ts` is deliberate diaspora-led brand copy owned by Plan 2, not domain configuration. Leave it alone.
- **Explicit non-goals in this plan:** AU/US corridor product journeys, deep partner APIs / speed rails, chain-free certification, hard client SLAs, document vault, FCA AR, open marketplace partners, rewriting Plans 1–3 features beyond what pack extraction requires.
- **Engineering:** TDD per task (failing test → minimal implementation → passing test → commit); pure domain modules import no framework, Next.js or Prisma code; server actions keep the existing `{ ok: true } | { ok: false; error: string }` shape; existing tests must keep passing (`npm test`); `npm run build` must pass at the end; DRY, YAGNI.

## File structure (locked)

```
prisma/
  schema.prisma                          # MODIFY (Task 7): PartnerPanel.marketPackId + index
  seed.ts                                # MODIFY (Task 7): explicit marketPackId on the 5 panel members
src/
  domain/
    types.ts                             # MODIFY (Task 1): export ENTRY_CONTEXTS
    intake.ts                            # MODIFY (Task 1 ENTRY_CONTEXTS, Task 6 region_prompt copy)
    referral.ts                          # MODIFY (Task 6): E&W disclosure copy removed
    case-admin.ts                        # MODIFY (Task 4): resolve pack from case
    stage-engine.ts                      # MODIFY (Task 4): registry resolution, no ew import
    market-packs/
      types.ts                           # MODIFY (Tasks 1,2,5,6): MarketPack interface, flags, copy, helpers, MarketPackError
      locale.ts                          # NEW (Task 1): formatMoney(locale, amount)
      ew-config.ts                       # NEW (Task 1): EW_LOCALE / EW_FLAGS / EW_COPY / EW_PARTNER_ROLE_LABELS
      ew-stages.ts                       # NEW (Task 1): moneyEvidenceKinds / moveEvidenceKinds / ewStageTemplates
      ew-playbook.ts                     # MODIFY (Tasks 1,2): imports from ew-stages/ew-config, currency via locale, types from types.ts
      ew-disclosure.ts                   # NEW (Task 6): ewDisclosureText (moved out of domain/referral.ts)
      ew.ts                              # MODIFY (Tasks 1,2,6): assembly only
      au-stub.ts                         # NEW (Task 3): disabled second pack
      registry.ts                        # NEW (Task 3): DEFAULT_MARKET_PACK_ID, listMarketPacks, findMarketPack, resolveMarketPack
      inspector.ts                       # NEW (Task 8): marketPackSummary (read-only view model)
  lib/
    case-pack.ts                         # NEW (Task 4): casePack(caseState), stageSlaDays(caseState, stageKey)
    cockpit-playbook.ts                  # MODIFY (Task 4): playbook via resolved pack
  server/
    mappers.ts                           # MODIFY (Task 4): templates via registry
    cases.ts                             # MODIFY (Task 4): DEFAULT_MARKET_PACK_ID
    panel.ts                             # MODIFY (Task 7): marketPackId filter + assertPanelMemberInMarket
    referrals.ts                         # MODIFY (Task 6): disclosure from the case's pack
    cockpit-policy.ts                    # MODIFY (Task 8): assertPackInspectorVisible
  app/
    actions/
      case-admin.ts                      # MODIFY (Task 1): shared ENTRY_CONTEXTS
      cockpit.ts                         # MODIFY (Task 7): warm intro checks market
      partner-network.ts                 # MODIFY (Task 7): re-route checks market
    (marketing)/start/page.tsx           # MODIFY (Task 1): shared ENTRY_CONTEXTS
    cockpit/layout.tsx                   # MODIFY (Task 8): "Market packs" nav link
    cockpit/market-packs/page.tsx        # NEW (Task 8): read-only pack inspector
    cockpit/cases/[caseId]/page.tsx      # MODIFY (Task 4 sla helper, Task 7 market-scoped panel)
    portal/cases/[caseId]/page.tsx       # MODIFY (Task 4 sla helper, Task 7 directory copy + labels)
  components/
    PlaybookPanel.tsx                    # MODIFY (Task 2): StagePlaybook type from market-packs/types
    PartnerDirectory.tsx                 # MODIFY (Task 7): intro copy + role labels as props
    marketing/StartForm.tsx              # MODIFY (Task 6): region prompt from pack copy
tests/
  support/fixture-pack.ts                # NEW (Tasks 1,2,6): non-UK fixture pack for helper tests
  domain/market-pack-types.test.ts       # NEW (Task 1)
  domain/market-pack-registry.test.ts    # NEW (Task 3)
  domain/market-pack-flags.test.ts       # NEW (Task 5)
  domain/market-pack-inspector.test.ts   # NEW (Task 8)
  domain/engine-country-agnostic.test.ts # NEW (Task 4), MODIFY (Task 6)
  domain/ew-pack.test.ts                 # MODIFY (Tasks 1,2,5)
  domain/ew-playbook.test.ts             # MODIFY (Task 1)
  domain/ew-disclosure.test.ts           # NEW (Task 6)
  domain/referral.test.ts                # MODIFY (Task 6): disclosure block removed
  lib/case-pack.test.ts                  # NEW (Task 4)
  server/market-pack-resolution.test.ts  # NEW (Task 4)
  server/referrals.test.ts               # MODIFY (Task 6)
  server/panel.test.ts                   # MODIFY (Task 7)
  server/pack-inspector-policy.test.ts   # NEW (Task 8)
docs/
  superpowers/plans/demo-script-market-packs.md   # NEW (Task 9)
README.md                                # MODIFY (Task 9)
```

**Layering rule (read before implementing any task):** inside `src/domain/market-packs/`, imports only ever point *up* this list — `types.ts` → `locale.ts` → `ew-config.ts` / `ew-stages.ts` / `ew-playbook.ts` / `ew-disclosure.ts` → `ew.ts` / `au-stub.ts` → `registry.ts` → `inspector.ts`. `types.ts` imports nothing from this folder. `ew.ts` and `au-stub.ts` are assembly only: no literals other than `id`, `name` and `jurisdiction`. This is why `MarketPackError` lives in `types.ts` and not in `registry.ts` — `au-stub.ts` needs to throw it.

---

### Task 1: MarketPack interface — locale, currency, module flags, jurisdiction copy, role labels

**Files:**
- Modify: `src/domain/market-packs/types.ts` (full rewrite)
- Create: `src/domain/market-packs/locale.ts`
- Create: `src/domain/market-packs/ew-config.ts`
- Create: `src/domain/market-packs/ew-stages.ts`
- Modify: `src/domain/market-packs/ew.ts` (full rewrite — assembly only)
- Modify: `src/domain/market-packs/ew-playbook.ts:1-2` (imports), `:28-40` (currency literal)
- Modify: `src/domain/types.ts` (export `ENTRY_CONTEXTS`)
- Modify: `src/domain/intake.ts:29-33`, `src/app/actions/case-admin.ts:12-16`, `src/app/(marketing)/start/page.tsx:11-15`
- Create: `tests/support/fixture-pack.ts`
- Create: `tests/domain/market-pack-types.test.ts`
- Modify: `tests/domain/ew-pack.test.ts` (add locale/flags/copy/label assertions)

**Interfaces:**
- Consumes: `ActorRole`, `EntryContext` from `src/domain/types.ts`.
- Produces: `MarketPack`, `MarketLocale`, `MarketModuleKey`, `MARKET_MODULE_KEYS`, `MarketFlags`, `MarketCopyKey`, `MARKET_COPY_KEYS`, `MarketCopy`, `PartnerRoleLabels`, `StageTemplate`, `MarketPackError`, `getStageTemplate(pack, entry)`, `stageTemplateFor(pack, entry, stageKey)`, `packEvidenceKinds(pack)`, `isModuleEnabled(flags, key)`, `partnerRoleLabel(pack, role)` from `src/domain/market-packs/types.ts`; `formatMoney(locale, amount)` from `src/domain/market-packs/locale.ts`; `EW_LOCALE`, `EW_FLAGS`, `EW_COPY`, `EW_PARTNER_ROLE_LABELS` from `ew-config.ts`; `moneyEvidenceKinds(entry)`, `moveEvidenceKinds(entry)`, `ewStageTemplates(entry)` from `ew-stages.ts`; `ENTRY_CONTEXTS` from `src/domain/types.ts`; `makeFixturePack(overrides?)` from `tests/support/fixture-pack.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/support/fixture-pack.ts` — a deliberately non-UK pack so every pack-parametric helper is proven without E&W:

```ts
import type { MarketPack, StageTemplate } from "../../src/domain/market-packs/types";
import type { EntryContext } from "../../src/domain/types";

/** A non-UK pack used only by tests: proves the pack-parametric helpers carry no E&W assumption. */
export function makeFixturePack(overrides: Partial<MarketPack> = {}): MarketPack {
  return {
    id: "zz",
    name: "Testland",
    jurisdiction: "testland",
    enabled: true,
    locale: {
      bcp47: "en-AU",
      currencyCode: "AUD",
      addressFieldKeys: ["line1", "suburb", "state", "postcode"],
      regionNoun: "state",
    },
    flags: { corridor_inbound: true },
    copy: {
      jurisdiction_scope: "Testland only.",
      mortgage_posture: "Introducer only in Testland.",
      region_prompt: "Which state are you buying in?",
      directory_intro: "Our Testland panel.",
    },
    partnerRoleLabels: {
      CLIENT: "household",
      ADVISOR: "advisor",
      MORTGAGE_PARTNER: "loan broker",
      CONVEYANCER: "settlement agent",
      MOVE_PARTNER: "removalist",
    },
    buildStages: (entry: EntryContext): StageTemplate[] => [
      {
        key: "local_profile",
        title: "Local profile",
        defaultOwnerRole: "CLIENT",
        slaDays: 2,
        requiredEvidenceKinds: ["profile_complete"],
        freeVisible: true,
        freeCanSelfAdvance: true,
      },
      {
        key: "local_settlement",
        title: "Local settlement",
        defaultOwnerRole: "CONVEYANCER",
        slaDays: 11,
        requiredEvidenceKinds:
          entry === "UK_RESIDENT_SPEED"
            ? ["settlement_booked"]
            : ["settlement_booked", "transfer_plan"],
        freeVisible: false,
        freeCanSelfAdvance: false,
      },
    ],
    ...overrides,
  };
}
```

Create `tests/domain/market-pack-types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatMoney } from "../../src/domain/market-packs/locale";
import {
  getStageTemplate,
  isModuleEnabled,
  MARKET_COPY_KEYS,
  MARKET_MODULE_KEYS,
  packEvidenceKinds,
  partnerRoleLabel,
  stageTemplateFor,
} from "../../src/domain/market-packs/types";
import { EW_LOCALE } from "../../src/domain/market-packs/ew-config";
import { makeFixturePack } from "../support/fixture-pack";

describe("pack-parametric helpers", () => {
  const pack = makeFixturePack();

  it("reads stage templates through the pack, whatever the stage keys are", () => {
    expect(getStageTemplate(pack, "RETURNER_OVERSEAS").map((s) => s.key)).toEqual([
      "local_profile",
      "local_settlement",
    ]);
    expect(stageTemplateFor(pack, "RETURNER_OVERSEAS", "local_settlement")?.slaDays).toBe(11);
    expect(stageTemplateFor(pack, "RETURNER_OVERSEAS", "mortgage_path")).toBeNull();
  });

  it("unions evidence kinds across every entry context, sorted and deduped", () => {
    expect(packEvidenceKinds(pack)).toEqual([
      "profile_complete",
      "settlement_booked",
      "transfer_plan",
    ]);
  });

  it("treats an omitted module flag as off", () => {
    expect(isModuleEnabled(pack.flags, "corridor_inbound")).toBe(true);
    expect(isModuleEnabled(pack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled({}, "fx_deposit")).toBe(false);
  });

  it("labels partner roles from the pack, not from a hardcoded map", () => {
    expect(partnerRoleLabel(pack, "CONVEYANCER")).toBe("settlement agent");
    expect(partnerRoleLabel(pack, "MOVE_PARTNER")).toBe("removalist");
  });

  it("keeps the module and copy key sets closed", () => {
    expect(MARKET_MODULE_KEYS).toContain("chain_free_inventory");
    expect(MARKET_MODULE_KEYS).toContain("hard_client_sla");
    expect(MARKET_COPY_KEYS).toEqual([
      "jurisdiction_scope",
      "mortgage_posture",
      "region_prompt",
      "directory_intro",
    ]);
  });
});

describe("locale money formatting", () => {
  it("formats whole units in the pack's own currency", () => {
    expect(formatMoney(EW_LOCALE, 1000)).toBe("£1,000");
    expect(formatMoney(makeFixturePack().locale, 1000)).toBe("$1,000");
  });
});
```

Add to `tests/domain/ew-pack.test.ts` (inside the existing `describe("ew market pack", ...)`), and change its import line 2 to `import { ewMarketPack } from "../../src/domain/market-packs/ew";` plus `import { getStageTemplate } from "../../src/domain/market-packs/types";`:

```ts
  it("declares its locale, currency and address shape as data", () => {
    expect(ewMarketPack.locale).toEqual({
      bcp47: "en-GB",
      currencyCode: "GBP",
      addressFieldKeys: ["line1", "line2", "town", "county", "postcode"],
      regionNoun: "region",
    });
    expect(ewMarketPack.jurisdiction).toBe("england_wales");
    expect(ewMarketPack.enabled).toBe(true);
  });

  it("carries jurisdiction copy and partner-role labels on the pack", () => {
    expect(ewMarketPack.copy.region_prompt).toMatch(/England & Wales/);
    expect(ewMarketPack.copy.directory_intro).toMatch(/England & Wales/);
    expect(ewMarketPack.copy.mortgage_posture).toMatch(/introducer only/i);
    expect(ewMarketPack.partnerRoleLabels.CONVEYANCER).toBe("conveyancer");
    expect(ewMarketPack.partnerRoleLabels.MORTGAGE_PARTNER).toBe("mortgage adviser");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/market-pack-types.test.ts`
Expected: FAIL — `Failed to load .../market-packs/locale` / `"MARKET_MODULE_KEYS" is not exported`.

- [ ] **Step 3: Rewrite `src/domain/market-packs/types.ts`**

```ts
import { ENTRY_CONTEXTS, type ActorRole, type EntryContext } from "../types";

export type StageTemplate = {
  key: string;
  title: string;
  defaultOwnerRole: ActorRole;
  slaDays: number;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
};

/** Thrown for any unresolvable or not-yet-enabled market pack. Lives here so packs can throw it. */
export class MarketPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketPackError";
  }
}

/** Money, dates and geography naming. Spec §8: "currency, address, legal steps as config/data". */
export type MarketLocale = {
  /** BCP-47 tag; every date and number rendered for this market uses it. */
  bcp47: string;
  /** ISO 4217 code, e.g. "GBP". */
  currencyCode: string;
  /** Ordered address input keys this market expects. */
  addressFieldKeys: string[];
  /** What this market calls the geography a buyer picks, e.g. "region", "state". */
  regionNoun: string;
};

/** Modules a pack may switch on. Spec §8: "feature-flag future segments and modules". */
export type MarketModuleKey =
  | "fx_deposit"
  | "corridor_inbound"
  | "corridor_outbound"
  | "chain_free_inventory"
  | "hard_client_sla"
  | "document_vault"
  | "partner_speed_rails";

export const MARKET_MODULE_KEYS: readonly MarketModuleKey[] = [
  "fx_deposit",
  "corridor_inbound",
  "corridor_outbound",
  "chain_free_inventory",
  "hard_client_sla",
  "document_vault",
  "partner_speed_rails",
];

/** Partial on purpose: a module is off unless a pack explicitly turns it on. */
export type MarketFlags = Partial<Record<MarketModuleKey, boolean>>;

export type MarketCopyKey =
  | "jurisdiction_scope"
  | "mortgage_posture"
  | "region_prompt"
  | "directory_intro";

export const MARKET_COPY_KEYS: readonly MarketCopyKey[] = [
  "jurisdiction_scope",
  "mortgage_posture",
  "region_prompt",
  "directory_intro",
];

export type MarketCopy = Record<MarketCopyKey, string>;

export type PartnerRoleLabels = Record<ActorRole, string>;

export type MarketPack = {
  id: string;
  name: string;
  /** Free-form legal jurisdiction slug. Never narrowed to one country. */
  jurisdiction: string;
  /** Only an enabled pack may back a live case. */
  enabled: boolean;
  locale: MarketLocale;
  flags: MarketFlags;
  copy: MarketCopy;
  partnerRoleLabels: PartnerRoleLabels;
  buildStages: (entry: EntryContext) => StageTemplate[];
};

export function getStageTemplate(
  pack: MarketPack,
  entry: EntryContext,
): StageTemplate[] {
  return pack.buildStages(entry);
}

export function stageTemplateFor(
  pack: MarketPack,
  entry: EntryContext,
  stageKey: string,
): StageTemplate | null {
  return getStageTemplate(pack, entry).find((t) => t.key === stageKey) ?? null;
}

/** Every evidence kind the pack can require, across all entry contexts. */
export function packEvidenceKinds(pack: MarketPack): string[] {
  const kinds = new Set<string>();
  for (const entry of ENTRY_CONTEXTS) {
    for (const template of getStageTemplate(pack, entry)) {
      for (const kind of template.requiredEvidenceKinds) {
        kinds.add(kind);
      }
    }
  }
  return [...kinds].sort();
}

export function isModuleEnabled(flags: MarketFlags, key: MarketModuleKey): boolean {
  return flags[key] === true;
}

export function partnerRoleLabel(pack: MarketPack, role: ActorRole): string {
  return pack.partnerRoleLabels[role];
}
```

- [ ] **Step 4: Export the shared entry-context list**

In `src/domain/types.ts`, add after the `EntryContext` type:

```ts
export const ENTRY_CONTEXTS: readonly EntryContext[] = [
  "RETURNER_OVERSEAS",
  "RETURNER_IN_UK",
  "UK_RESIDENT_SPEED",
];
```

Then delete the duplicated local arrays and import the shared one:
- `src/domain/intake.ts`: delete the `const ENTRY_CONTEXTS: EntryContext[] = [...]` block (lines 29-33) and change line 1 to `import { ENTRY_CONTEXTS, type EntryContext, type Tier } from "./types";`.
- `src/app/actions/case-admin.ts`: delete the `const ENTRY_CONTEXTS` block (lines 12-16) and change line 5 to `import { ENTRY_CONTEXTS, type EntryContext } from "@/domain/types";`.
- `src/app/(marketing)/start/page.tsx`: delete the `const ENTRY_VALUES` block (lines 11-15), change line 4 to `import { ENTRY_CONTEXTS, type EntryContext } from "@/domain/types";`, and replace `ENTRY_VALUES.includes(` with `ENTRY_CONTEXTS.includes(`.

- [ ] **Step 5: Create `src/domain/market-packs/locale.ts`**

```ts
import type { MarketLocale } from "./types";

/** Whole-unit currency formatting for pack copy: 1000 → "£1,000" under EW_LOCALE. */
export function formatMoney(locale: MarketLocale, amount: number): string {
  return new Intl.NumberFormat(locale.bcp47, {
    style: "currency",
    currency: locale.currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}
```

- [ ] **Step 6: Create `src/domain/market-packs/ew-config.ts`**

```ts
import type {
  MarketCopy,
  MarketFlags,
  MarketLocale,
  PartnerRoleLabels,
} from "./types";

export const EW_LOCALE: MarketLocale = {
  bcp47: "en-GB",
  currencyCode: "GBP",
  addressFieldKeys: ["line1", "line2", "town", "county", "postcode"],
  regionNoun: "region",
};

/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 dependency rule: chain-free
 * inventory and hard SLAs stay off until the ledger proves speed. Corridors are Plan 7.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
};

export const EW_COPY: MarketCopy = {
  jurisdiction_scope:
    "We orchestrate purchases in England & Wales. Scotland and Northern Ireland are not covered in v1.",
  mortgage_posture:
    "We introduce you to a mortgage adviser. We are an introducer only and do not give mortgage advice.",
  region_prompt: "Where in England & Wales are you buying?",
  directory_intro:
    "Our curated England & Wales panel. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const EW_PARTNER_ROLE_LABELS: PartnerRoleLabels = {
  CLIENT: "household",
  ADVISOR: "advisor",
  MORTGAGE_PARTNER: "mortgage adviser",
  CONVEYANCER: "conveyancer",
  MOVE_PARTNER: "removals partner",
};
```

- [ ] **Step 7: Create `src/domain/market-packs/ew-stages.ts`**

This is a **verbatim move**, not a rewrite — do not retype the stage data. Cut `moneyEvidenceKinds`, `moveEvidenceKinds` and the body of `buildStages` out of the current `src/domain/market-packs/ew.ts` (lines 6-111: nine templates, keys `purchase_profile` → `settle_light`, SLA days 3/7/14/10/7/5/21/14/14) and paste them into the new file under this shape. Every key, title, owner role, SLA day, evidence kind and free flag must be byte-identical to what `ew.ts` has today; `tests/domain/ew-pack.test.ts` and `tests/server/cases.roundtrip.test.ts` will catch any drift.

```ts
import type { EntryContext } from "../types";
import type { StageTemplate } from "./types";

export function moneyEvidenceKinds(entry: EntryContext): string[] {
  // moved verbatim from ew.ts:6-11
}

export function moveEvidenceKinds(entry: EntryContext): string[] {
  // moved verbatim from ew.ts:13-19
}

/** England & Wales legal spine. Spec §4 canonical stage groups. */
export function ewStageTemplates(entry: EntryContext): StageTemplate[] {
  return [
    // the nine template objects moved verbatim from ew.ts:27-109
  ];
}
```

- [ ] **Step 8: Rewrite `src/domain/market-packs/ew.ts` as assembly only**

```ts
import {
  EW_COPY,
  EW_FLAGS,
  EW_LOCALE,
  EW_PARTNER_ROLE_LABELS,
} from "./ew-config";
import { ewStageTemplates } from "./ew-stages";
import type { MarketPack } from "./types";

/** Kept for callers that still import the helper from here; removed in Task 4. */
export { getStageTemplate } from "./types";

export const ewMarketPack: MarketPack = {
  id: "ew",
  name: "England & Wales",
  jurisdiction: "england_wales",
  enabled: true,
  locale: EW_LOCALE,
  flags: EW_FLAGS,
  copy: EW_COPY,
  partnerRoleLabels: EW_PARTNER_ROLE_LABELS,
  buildStages: ewStageTemplates,
};
```

- [ ] **Step 9: Rewire `ew-playbook.ts` imports and remove the hardcoded currency**

Replace lines 1-2 of `src/domain/market-packs/ew-playbook.ts` with:

```ts
import type { ActorRole, EntryContext } from "../types";
import { EW_LOCALE } from "./ew-config";
import { moneyEvidenceKinds, moveEvidenceKinds } from "./ew-stages";
import { formatMoney } from "./locale";
```

Replace the `MONEY_EVIDENCE` const (lines 28-33) with a locale-formatted version — the only behaviour change is that `£1,000` now comes from `EW_LOCALE`:

```ts
const MONEY_EVIDENCE: Record<string, string> = {
  source_of_funds: `source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every deposit over ${formatMoney(EW_LOCALE, 1000)} explained.`,
  fx_plan:
    "fx_plan: transfer route named, target settlement date set, and the client understands the rate is not fixed by us.",
};
```

- [ ] **Step 10: Run the whole suite**

Run: `npm test`
Expected: PASS — all files, including `tests/domain/market-pack-types.test.ts`, `tests/domain/ew-pack.test.ts`, `tests/domain/ew-playbook.test.ts`, `tests/server/cockpit-playbook-policy.test.ts`.

If `tests/domain/ew-playbook.test.ts` fails on the import of `getStageTemplate` from `../../src/domain/market-packs/ew`, leave it importing from there — the re-export in Step 8 keeps it valid.

- [ ] **Step 11: Commit**

```bash
git add src/domain/market-packs src/domain/types.ts src/domain/intake.ts src/app/actions/case-admin.ts "src/app/(marketing)/start/page.tsx" tests/support tests/domain/market-pack-types.test.ts tests/domain/ew-pack.test.ts
git commit -m "feat: formal MarketPack interface with locale, module flags and jurisdiction copy"
```

---

### Task 2: Entry-context playbooks become a pack capability

**Files:**
- Modify: `src/domain/market-packs/types.ts` (add `PlaybookAction`, `StagePlaybook`, `buildPlaybooks`, `stagePlaybook`)
- Modify: `src/domain/market-packs/ew-playbook.ts` (types imported, local type declarations removed)
- Modify: `src/domain/market-packs/ew.ts` (wire `buildPlaybooks`)
- Modify: `src/lib/cockpit-playbook.ts:1-4,18` and `src/components/PlaybookPanel.tsx:1`
- Modify: `tests/support/fixture-pack.ts` (add `buildPlaybooks`)
- Modify: `tests/domain/ew-pack.test.ts` (playbook coverage through the pack)

**Interfaces:**
- Consumes: `MarketPack`, `getStageTemplate` (Task 1); `ewPlaybooks(entry)`, `ewStagePlaybook(stageKey, entry)` (existing, unchanged signatures).
- Produces: `PlaybookAction`, `StagePlaybook`, `stagePlaybook(pack, stageKey, entry): StagePlaybook | null` and `MarketPack.buildPlaybooks(entry): StagePlaybook[]` from `src/domain/market-packs/types.ts`.

- [ ] **Step 1: Write the failing test**

Add to `tests/domain/ew-pack.test.ts` (import `stagePlaybook` from `../../src/domain/market-packs/types`):

```ts
  it("exposes an entry-context playbook for every stage through the pack", () => {
    for (const entry of ["RETURNER_OVERSEAS", "RETURNER_IN_UK", "UK_RESIDENT_SPEED"] as const) {
      const stageKeys = getStageTemplate(ewMarketPack, entry).map((s) => s.key);
      expect(ewMarketPack.buildPlaybooks(entry).map((p) => p.stageKey)).toEqual(stageKeys);
      for (const key of stageKeys) {
        expect(stagePlaybook(ewMarketPack, key, entry)?.stageKey).toBe(key);
      }
    }
    expect(stagePlaybook(ewMarketPack, "chain_free_matching", "RETURNER_IN_UK")).toBeNull();
  });
```

Add to `tests/domain/market-pack-types.test.ts` (inside `describe("pack-parametric helpers", ...)`):

```ts
  it("resolves playbooks through whichever pack it is given", () => {
    expect(stagePlaybook(pack, "local_profile", "RETURNER_OVERSEAS")?.objective).toBe(
      "Fixture objective for local_profile.",
    );
    expect(stagePlaybook(pack, "money_readiness", "RETURNER_OVERSEAS")).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/ew-pack.test.ts tests/domain/market-pack-types.test.ts`
Expected: FAIL — `"stagePlaybook" is not exported` / `ewMarketPack.buildPlaybooks is not a function`.

- [ ] **Step 3: Move the playbook types into `types.ts` and add the capability**

In `src/domain/market-packs/types.ts`, add above `MarketPack`:

```ts
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
```

Add to the `MarketPack` type, after `buildStages`:

```ts
  buildPlaybooks: (entry: EntryContext) => StagePlaybook[];
```

Add at the end of the file:

```ts
export function stagePlaybook(
  pack: MarketPack,
  stageKey: string,
  entry: EntryContext,
): StagePlaybook | null {
  return pack.buildPlaybooks(entry).find((p) => p.stageKey === stageKey) ?? null;
}
```

- [ ] **Step 4: Point `ew-playbook.ts` at the shared types**

In `src/domain/market-packs/ew-playbook.ts`, delete the local `PlaybookAction` and `StagePlaybook` type declarations (lines 4-18 of the current file) and extend the type import added in Task 1:

```ts
import type { PlaybookAction, StagePlaybook } from "./types";
```

`ewPlaybooks` and `ewStagePlaybook` keep their existing bodies and signatures. `PlaybookAction` is still referenced by the `owner: "ADVISOR" as ActorRole` spread arrays, so keep the import even though it is only used as a type there.

In `src/domain/market-packs/ew.ts`, add `import { ewPlaybooks } from "./ew-playbook";` and the field:

```ts
  buildPlaybooks: ewPlaybooks,
```

- [ ] **Step 5: Move the two `StagePlaybook` consumers off the E&W module**

`src/components/PlaybookPanel.tsx` line 1 becomes:

```ts
import type { StagePlaybook } from "@/domain/market-packs/types";
```

`src/lib/cockpit-playbook.ts` becomes (behaviour unchanged in this task — pack resolution lands in Task 4):

```ts
import { ewStagePlaybook } from "@/domain/market-packs/ew-playbook";
import type { StagePlaybook } from "@/domain/market-packs/types";
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

- [ ] **Step 6: Add `buildPlaybooks` to the test fixture**

In `tests/support/fixture-pack.ts`, add after `buildStages`:

```ts
    buildPlaybooks: (entry: EntryContext) => [
      {
        stageKey: "local_profile",
        objective: "Fixture objective for local_profile.",
        actions: [{ day: 0, owner: "ADVISOR" as const, action: "Fixture action." }],
        evidenceStandard: ["profile_complete: fixture standard."],
        escalation: [`Day 2: fixture escalation (${entry}).`],
        partnerScript: null,
      },
    ],
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 8: Commit**

```bash
git add src/domain/market-packs src/lib/cockpit-playbook.ts src/components/PlaybookPanel.tsx tests
git commit -m "feat: entry-context playbooks resolve through the market pack"
```

---

### Task 3: Market pack registry with fail-closed resolution and a disabled `au` stub

**Files:**
- Create: `src/domain/market-packs/registry.ts`
- Create: `src/domain/market-packs/au-stub.ts`
- Create: `tests/domain/market-pack-registry.test.ts`

**Interfaces:**
- Consumes: `MarketPack`, `MarketPackError`, `getStageTemplate`, `packEvidenceKinds` (Tasks 1-2); `ewMarketPack`.
- Produces: `DEFAULT_MARKET_PACK_ID`, `listMarketPacks()`, `findMarketPack(id)`, `resolveMarketPack(id)` from `src/domain/market-packs/registry.ts`; `auStubPack` from `src/domain/market-packs/au-stub.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/market-pack-registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import {
  DEFAULT_MARKET_PACK_ID,
  findMarketPack,
  listMarketPacks,
  resolveMarketPack,
} from "../../src/domain/market-packs/registry";
import {
  getStageTemplate,
  isModuleEnabled,
  MarketPackError,
  packEvidenceKinds,
} from "../../src/domain/market-packs/types";

describe("market pack registry", () => {
  it("defaults to the England & Wales pack", () => {
    expect(DEFAULT_MARKET_PACK_ID).toBe("ew");
    expect(resolveMarketPack(DEFAULT_MARKET_PACK_ID).id).toBe("ew");
  });

  it("lists every registered pack, enabled or not, sorted by id", () => {
    expect(listMarketPacks().map((p) => [p.id, p.enabled])).toEqual([
      ["au", false],
      ["ew", true],
    ]);
  });

  it("fails closed on an unknown pack id", () => {
    expect(() => resolveMarketPack("zz")).toThrow(MarketPackError);
    expect(() => resolveMarketPack("zz")).toThrow(/Unknown market pack: zz/);
    expect(findMarketPack("zz")).toBeNull();
  });

  it("fails closed on a registered but disabled pack", () => {
    expect(findMarketPack("au")?.id).toBe("au");
    expect(() => resolveMarketPack("au")).toThrow(MarketPackError);
    expect(() => resolveMarketPack("au")).toThrow(/not enabled/i);
  });
});

describe("au stub pack", () => {
  it("is a configuration stub, not an AU product", () => {
    expect(auStubPack.enabled).toBe(false);
    expect(auStubPack.jurisdiction).toBe("australia");
    expect(auStubPack.locale.currencyCode).toBe("AUD");
    expect(auStubPack.locale.regionNoun).toBe("state");
    expect(auStubPack.buildPlaybooks("RETURNER_OVERSEAS")).toEqual([]);
    expect(packEvidenceKinds(auStubPack)).toEqual([]);
    for (const key of ["fx_deposit", "corridor_inbound", "chain_free_inventory"] as const) {
      expect(isModuleEnabled(auStubPack.flags, key)).toBe(false);
    }
  });

  it("proves stage keys are pack data, not engine constants", () => {
    const keys = getStageTemplate(auStubPack, "RETURNER_OVERSEAS").map((s) => s.key);
    expect(keys).toContain("finance_path");
    expect(keys).not.toContain("mortgage_path");
    expect(keys).toHaveLength(9);
  });

  it("gives free users nothing until the pack has local content", () => {
    for (const template of getStageTemplate(auStubPack, "UK_RESIDENT_SPEED")) {
      expect(template.freeVisible).toBe(false);
      expect(template.freeCanSelfAdvance).toBe(false);
      expect(template.requiredEvidenceKinds).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/market-pack-registry.test.ts`
Expected: FAIL — `Failed to load .../market-packs/au-stub`.

- [ ] **Step 3: Create `src/domain/market-packs/au-stub.ts`**

```ts
import type { EntryContext } from "../types";
import type { MarketPack, StageTemplate } from "./types";

/**
 * Spec §3: "Second-country market packs (architecture ready only)". This pack exists
 * to prove the registry resolves more than one pack — it deliberately ships no AU
 * journeys, playbooks, evidence standards, partners or disclosure copy. It stays
 * `enabled: false`, so `resolveMarketPack("au")` refuses to back a case.
 * Corridor product work is Plan 7.
 */
function auStageTemplates(_entry: EntryContext): StageTemplate[] {
  /** Spec §10 country-agnostic spine. SLA cadence is a placeholder; the pack cannot run. */
  const spine: Array<[string, string, StageTemplate["defaultOwnerRole"]]> = [
    ["purchase_profile", "Purchase profile", "CLIENT"],
    ["money_readiness", "Money readiness", "CLIENT"],
    ["finance_path", "Finance path", "MORTGAGE_PARTNER"],
    ["move_logistics", "Move logistics", "MOVE_PARTNER"],
    ["search_readiness", "Search readiness", "CLIENT"],
    ["offer_instruct", "Offer → instruct", "CONVEYANCER"],
    ["diligence", "Diligence", "CONVEYANCER"],
    ["settlement_complete", "Settlement → complete", "CONVEYANCER"],
    ["settle_light", "Settle (light)", "CLIENT"],
  ];

  return spine.map(([key, title, defaultOwnerRole]) => ({
    key,
    title,
    defaultOwnerRole,
    slaDays: 7,
    requiredEvidenceKinds: [],
    freeVisible: false,
    freeCanSelfAdvance: false,
  }));
}

export const auStubPack: MarketPack = {
  id: "au",
  name: "Australia (configuration stub — not enabled)",
  jurisdiction: "australia",
  enabled: false,
  locale: {
    bcp47: "en-AU",
    currencyCode: "AUD",
    addressFieldKeys: ["line1", "line2", "suburb", "state", "postcode"],
    regionNoun: "state",
  },
  flags: {},
  copy: {
    jurisdiction_scope:
      "The Australia pack is a configuration stub. No cases run on it yet.",
    mortgage_posture:
      "Local finance rules are not written for this pack. Nothing here is advice.",
    region_prompt: "Which state are you buying in?",
    directory_intro: "There is no Australia partner panel yet.",
  },
  partnerRoleLabels: {
    CLIENT: "household",
    ADVISOR: "advisor",
    MORTGAGE_PARTNER: "mortgage broker",
    CONVEYANCER: "conveyancer",
    MOVE_PARTNER: "removalist",
  },
  buildStages: auStageTemplates,
  buildPlaybooks: () => [],
};
```

- [ ] **Step 4: Create `src/domain/market-packs/registry.ts`**

```ts
import { auStubPack } from "./au-stub";
import { ewMarketPack } from "./ew";
import { MarketPackError, type MarketPack } from "./types";

/** The only place in TypeScript that names the v1 market. */
export const DEFAULT_MARKET_PACK_ID = "ew";

const PACKS: readonly MarketPack[] = [ewMarketPack, auStubPack];

export function listMarketPacks(): MarketPack[] {
  return [...PACKS].sort((left, right) => left.id.localeCompare(right.id));
}

export function findMarketPack(id: string): MarketPack | null {
  return PACKS.find((pack) => pack.id === id) ?? null;
}

/** Fail closed: unknown ids and disabled packs both refuse to back a case. */
export function resolveMarketPack(id: string): MarketPack {
  const pack = findMarketPack(id);
  if (!pack) {
    throw new MarketPackError(`Unknown market pack: ${id}`);
  }
  if (!pack.enabled) {
    throw new MarketPackError(`Market pack is not enabled: ${id}`);
  }
  return pack;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/domain/market-pack-registry.test.ts`
Expected: PASS (7 tests).

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add src/domain/market-packs/registry.ts src/domain/market-packs/au-stub.ts tests/domain/market-pack-registry.test.ts
git commit -m "feat: fail-closed market pack registry with disabled au stub"
```

---

### Task 4: Engine-global modules resolve the pack from `case.marketPackId`

**Files:**
- Modify: `src/domain/stage-engine.ts:1-4,45-50,60,146-152`
- Modify: `src/domain/case-admin.ts:1,67`
- Modify: `src/server/mappers.ts:1-17`
- Modify: `src/server/cases.ts:60,77` (default pack id)
- Modify: `src/lib/cockpit-playbook.ts`
- Create: `src/lib/case-pack.ts`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx:13,27-30,117`
- Modify: `src/app/portal/cases/[caseId]/page.tsx:13,27-30,123`
- Modify: `src/domain/market-packs/ew.ts` (drop the `getStageTemplate` re-export)
- Modify: `tests/domain/ew-pack.test.ts:2`, `tests/domain/ew-playbook.test.ts:2` (import the helper from `types`)
- Create: `tests/lib/case-pack.test.ts`
- Create: `tests/domain/engine-country-agnostic.test.ts`
- Create: `tests/server/market-pack-resolution.test.ts`

**Interfaces:**
- Consumes: `resolveMarketPack`, `DEFAULT_MARKET_PACK_ID` (Task 3); `getStageTemplate`, `stageTemplateFor`, `stagePlaybook`, `MarketPackError` (Tasks 1-2).
- Produces: `casePack(caseState): MarketPack` and `stageSlaDays(caseState, stageKey): number` from `src/lib/case-pack.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/case-pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { casePack, stageSlaDays } from "../../src/lib/case-pack";
import { createCase } from "../../src/domain/stage-engine";
import { MarketPackError } from "../../src/domain/market-packs/types";

const base = { id: "cp_1", entryContext: "RETURNER_OVERSEAS", tier: "PAID_DWY" } as const;

describe("case pack resolution", () => {
  it("resolves the pack and per-stage SLA from the case, not from a constant", () => {
    const caseState = createCase({ ...base });
    expect(casePack(caseState).id).toBe("ew");
    expect(stageSlaDays(caseState, "diligence")).toBe(21);
    expect(stageSlaDays(caseState, "offer_instruct")).toBe(5);
  });

  it("falls back to a one-week cadence for a stage key the pack does not define", () => {
    const caseState = createCase({ ...base });
    expect(stageSlaDays(caseState, "chain_free_matching")).toBe(7);
  });

  it("fails closed when the stored pack id is not resolvable", () => {
    const caseState = { ...createCase({ ...base }), marketPackId: "zz" };
    expect(() => casePack(caseState)).toThrow(MarketPackError);
  });
});
```

Create `tests/domain/engine-country-agnostic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Spec §10: the stage engine is country-agnostic; local rules, copy and currency
 * live in market packs. These files are engine-global, so they may resolve a pack
 * through the registry but must never import the England & Wales pack directly and
 * must never contain a jurisdiction literal.
 */
const ENGINE_GLOBAL_FILES = [
  "src/domain/stage-engine.ts",
  "src/domain/case-admin.ts",
  "src/domain/escalation.ts",
  "src/domain/freemium.ts",
  "src/domain/panel.ts",
  "src/domain/scorecard.ts",
  "src/domain/partner-ops.ts",
  "src/server/mappers.ts",
  "src/lib/case-pack.ts",
];

const JURISDICTION_LITERAL = /£|\bGBP\b|en-GB|england|wales/i;
const EW_PACK_IMPORT = /from\s+["'][^"']*market-packs\/(ew|ew-config|ew-stages|ew-playbook|ew-disclosure)["']/;

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("engine-global modules stay country-agnostic", () => {
  it("contains no jurisdiction literal", () => {
    for (const file of ENGINE_GLOBAL_FILES) {
      expect(JURISDICTION_LITERAL.test(read(file)), `${file} has a jurisdiction literal`).toBe(
        false,
      );
    }
  });

  it("never imports the England & Wales pack directly", () => {
    for (const file of ENGINE_GLOBAL_FILES) {
      expect(EW_PACK_IMPORT.test(read(file)), `${file} imports the ew pack`).toBe(false);
    }
  });
});
```

Create `tests/server/market-pack-resolution.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { MarketPackError } from "../../src/domain/market-packs/types";
import { createCaseRecord, loadCase } from "../../src/server/cases";

describe("market pack resolution on persisted cases", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
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
        { id: "mp_client", email: "mp-client@example.com", role: "CLIENT", passwordHash },
        { id: "mp_advisor", email: "mp-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function newCase() {
    return createCaseRecord({
      title: "Pack resolution case",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "mp_client",
      advisorUserId: "mp_advisor",
    });
  }

  it("stores the default pack id when the caller does not name one", async () => {
    const created = await newCase();
    expect(created.marketPackId).toBe("ew");
  });

  it("refuses to create a case on a disabled pack", async () => {
    await expect(
      createCaseRecord({
        title: "AU case",
        entryContext: "RETURNER_OVERSEAS",
        tier: "PAID_DWY",
        clientUserId: "mp_client",
        advisorUserId: "mp_advisor",
        marketPackId: "au",
      }),
    ).rejects.toThrow(/not enabled/i);
  });

  it("fails closed when a stored pack id is unknown or disabled", async () => {
    const created = await newCase();

    await prisma.case.update({ where: { id: created.id }, data: { marketPackId: "zz" } });
    await expect(loadCase(created.id)).rejects.toThrow(MarketPackError);
    await expect(loadCase(created.id)).rejects.toThrow(/Unknown market pack: zz/);

    await prisma.case.update({ where: { id: created.id }, data: { marketPackId: "au" } });
    await expect(loadCase(created.id)).rejects.toThrow(/not enabled/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/case-pack.test.ts tests/domain/engine-country-agnostic.test.ts tests/server/market-pack-resolution.test.ts`
Expected: FAIL — `Failed to load .../lib/case-pack`; the guard test fails on `src/domain/case-admin.ts imports the ew pack`.

- [ ] **Step 3: Rewire the stage engine**

In `src/domain/stage-engine.ts`, replace lines 3-4 with:

```ts
import { DEFAULT_MARKET_PACK_ID, resolveMarketPack } from "./market-packs/registry";
import { getStageTemplate, type StageTemplate } from "./market-packs/types";
```

Delete the local `resolveMarketPack` function (lines 45-50). Change line 60 to:

```ts
  const marketPackId = input.marketPackId ?? DEFAULT_MARKET_PACK_ID;
```

`getStageTemplateForCase` keeps its body — it already calls `resolveMarketPack(caseState.marketPackId)`, which now comes from the registry.

- [ ] **Step 4: Rewire `case-admin.ts`, `mappers.ts` and `cases.ts`**

`src/domain/case-admin.ts` line 1 becomes:

```ts
import { resolveMarketPack } from "./market-packs/registry";
import { getStageTemplate } from "./market-packs/types";
```

and line 67 becomes:

```ts
  const pack = resolveMarketPack(caseState.marketPackId);
  const templates = getStageTemplate(pack, input.entryContext);
```

`src/server/mappers.ts` — replace line 4 and the `resolveTemplates` helper (lines 12-17) with:

```ts
import { resolveMarketPack } from "../domain/market-packs/registry";
import { getStageTemplate } from "../domain/market-packs/types";
```

```ts
function resolveTemplates(marketPackId: string, entryContext: EntryContext) {
  return getStageTemplate(resolveMarketPack(marketPackId), entryContext);
}
```

`src/server/cases.ts` — add `import { DEFAULT_MARKET_PACK_ID } from "../domain/market-packs/registry";` and replace both `?? "ew"` occurrences (lines 60 and 77 region) with `?? DEFAULT_MARKET_PACK_ID`.

- [ ] **Step 5: Create `src/lib/case-pack.ts` and use it in both case pages**

```ts
import { resolveMarketPack } from "@/domain/market-packs/registry";
import { stageTemplateFor, type MarketPack } from "@/domain/market-packs/types";
import type { CaseState } from "@/domain/stage-engine";

/** The one place a surface turns a case into its market pack. Throws MarketPackError. */
export function casePack(caseState: CaseState): MarketPack {
  return resolveMarketPack(caseState.marketPackId);
}

/** Falls back to a one-week cadence only for stage keys the pack does not define. */
export function stageSlaDays(caseState: CaseState, stageKey: string): number {
  return (
    stageTemplateFor(casePack(caseState), caseState.entryContext, stageKey)?.slaDays ?? 7
  );
}
```

In both `src/app/cockpit/cases/[caseId]/page.tsx` and `src/app/portal/cases/[caseId]/page.tsx`:
1. Delete the `import { ewMarketPack, getStageTemplate } from "@/domain/market-packs/ew";` line.
2. Delete the local `function stageSlaDays(entryContext, stageKey)` helper.
3. Add `import { stageSlaDays } from "@/lib/case-pack";`.
4. Change the single call site from `stageSlaDays(caseState.entryContext, focus.key)` to `stageSlaDays(caseState, focus.key)`.
5. Remove the now-unused `EntryContext` type import if nothing else in the file uses it (the cockpit page still uses `isPartnerActorRole`; keep that import and drop only `type EntryContext`).

- [ ] **Step 6: Resolve advisor playbooks through the case's pack**

`src/lib/cockpit-playbook.ts` becomes:

```ts
import { stagePlaybook, type StagePlaybook } from "@/domain/market-packs/types";
import { casePack } from "@/lib/case-pack";
import type { CaseState } from "@/domain/stage-engine";

/**
 * Advisor operating IP. Callers must be inside an advisor-gated surface —
 * guard with assertPlaybookVisible before rendering.
 */
export function advisorPlaybook(
  caseState: CaseState,
  stageKey: string,
): StagePlaybook | null {
  return stagePlaybook(casePack(caseState), stageKey, caseState.entryContext);
}

export type { StagePlaybook };
```

- [ ] **Step 7: Drop the transitional re-export**

In `src/domain/market-packs/ew.ts`, delete the line `export { getStageTemplate } from "./types";` and its comment. Then update the two test imports:
- `tests/domain/ew-pack.test.ts` line 2 → `import { ewMarketPack } from "../../src/domain/market-packs/ew";` (the `getStageTemplate` / `stagePlaybook` import from `../../src/domain/market-packs/types` was added in Tasks 1-2).
- `tests/domain/ew-playbook.test.ts` line 2 → split into:

```ts
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import { getStageTemplate } from "../../src/domain/market-packs/types";
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including the three new files. If `tests/domain/engine-country-agnostic.test.ts` still reports a file, fix that file rather than the regex; the only permitted pack import in an engine-global module is `market-packs/registry` or `market-packs/types`.

- [ ] **Step 9: Commit**

```bash
git add src/domain/stage-engine.ts src/domain/case-admin.ts src/domain/market-packs/ew.ts src/server/mappers.ts src/server/cases.ts src/lib/case-pack.ts src/lib/cockpit-playbook.ts "src/app/cockpit/cases/[caseId]/page.tsx" "src/app/portal/cases/[caseId]/page.tsx" tests
git commit -m "feat: resolve the market pack from case.marketPackId across the engine"
```

---

### Task 5: Module flags drive behaviour as data, not scattered ifs

**Files:**
- Modify: `src/domain/market-packs/types.ts` (add `packModules`)
- Modify: `src/domain/market-packs/ew-stages.ts` (`moneyEvidenceKinds` reads the flags)
- Modify: `src/domain/market-packs/ew-playbook.ts:52` region (pass `EW_FLAGS`)
- Create: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/ew-pack.test.ts` (flags assertion)

**Interfaces:**
- Consumes: `MarketFlags`, `isModuleEnabled`, `MARKET_MODULE_KEYS` (Task 1); `listMarketPacks` (Task 3); `EW_FLAGS` (Task 1).
- Produces: `packModules(pack): Array<{ key: MarketModuleKey; enabled: boolean }>` from `types.ts`; `moneyEvidenceKinds(entry: EntryContext, flags: MarketFlags): string[]` from `ew-stages.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/market-pack-flags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { listMarketPacks } from "../../src/domain/market-packs/registry";
import { moneyEvidenceKinds } from "../../src/domain/market-packs/ew-stages";
import { EW_FLAGS } from "../../src/domain/market-packs/ew-config";
import {
  isModuleEnabled,
  MARKET_MODULE_KEYS,
  packModules,
} from "../../src/domain/market-packs/types";

/** Spec §9: "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real." */
const GATED_MODULES = [
  "chain_free_inventory",
  "hard_client_sla",
  "corridor_inbound",
  "corridor_outbound",
  "document_vault",
  "partner_speed_rails",
] as const;

describe("module flags are pack data", () => {
  it("keeps every gated module off in every registered pack", () => {
    for (const pack of listMarketPacks()) {
      for (const key of GATED_MODULES) {
        expect(isModuleEnabled(pack.flags, key), `${pack.id}.${key}`).toBe(false);
      }
    }
  });

  it("enables FX for the deposit in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "fx_deposit"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
  });

  it("lists every module key with its resolved state for a pack", () => {
    const rows = packModules(listMarketPacks().find((p) => p.id === "ew")!);
    expect(rows).toHaveLength(MARKET_MODULE_KEYS.length);
    expect(rows.find((r) => r.key === "fx_deposit")?.enabled).toBe(true);
    expect(rows.find((r) => r.key === "hard_client_sla")?.enabled).toBe(false);
  });
});

describe("the fx_deposit module drives required evidence", () => {
  it("requires an FX plan only when the module is on and the entry needs currency work", () => {
    expect(moneyEvidenceKinds("RETURNER_OVERSEAS", EW_FLAGS)).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(moneyEvidenceKinds("UK_RESIDENT_SPEED", EW_FLAGS)).toEqual(["source_of_funds"]);
  });

  it("drops the FX plan entirely for a pack with the module off", () => {
    expect(moneyEvidenceKinds("RETURNER_OVERSEAS", {})).toEqual(["source_of_funds"]);
    expect(moneyEvidenceKinds("RETURNER_IN_UK", { fx_deposit: false })).toEqual([
      "source_of_funds",
    ]);
  });
});
```

Add to `tests/domain/ew-pack.test.ts`:

```ts
  it("switches only the FX module on", () => {
    expect(ewMarketPack.flags).toEqual({ fx_deposit: true });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/market-pack-flags.test.ts`
Expected: FAIL — `"packModules" is not exported` and `moneyEvidenceKinds` called with 2 arguments.

- [ ] **Step 3: Add `packModules` to `types.ts`**

```ts
export type MarketModuleRow = { key: MarketModuleKey; enabled: boolean };

/** Every module key with its resolved state — for the advisor pack inspector. */
export function packModules(pack: MarketPack): MarketModuleRow[] {
  return MARKET_MODULE_KEYS.map((key) => ({
    key,
    enabled: isModuleEnabled(pack.flags, key),
  }));
}
```

- [ ] **Step 4: Make the FX module drive the money evidence kinds**

In `src/domain/market-packs/ew-stages.ts`:

```ts
import type { EntryContext } from "../types";
import { EW_FLAGS } from "./ew-config";
import { isModuleEnabled, type MarketFlags, type StageTemplate } from "./types";

/** FX evidence exists only where the pack runs the fx_deposit module and the household holds foreign currency. */
export function moneyEvidenceKinds(
  entry: EntryContext,
  flags: MarketFlags,
): string[] {
  const kinds = ["source_of_funds"];
  if (isModuleEnabled(flags, "fx_deposit") && entry !== "UK_RESIDENT_SPEED") {
    kinds.push("fx_plan");
  }
  return kinds;
}
```

and inside `ewStageTemplates`, change the `money_readiness` template to:

```ts
      requiredEvidenceKinds: moneyEvidenceKinds(entry, EW_FLAGS),
```

In `src/domain/market-packs/ew-playbook.ts`, the `money_readiness` playbook already calls `linesFor(moneyEvidenceKinds(entry), MONEY_EVIDENCE)`; change it to `linesFor(moneyEvidenceKinds(entry, EW_FLAGS), MONEY_EVIDENCE)` and replace the local `needsCurrencyWork` helper with the same rule so the copy and the evidence never drift:

```ts
function needsCurrencyWork(entry: EntryContext): boolean {
  return moneyEvidenceKinds(entry, EW_FLAGS).includes("fx_plan");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including `tests/domain/ew-playbook.test.ts` (its FX-copy assertions still hold because `EW_FLAGS.fx_deposit` is `true`) and `tests/server/cases.roundtrip.test.ts` (money evidence for `UK_RESIDENT_SPEED` is still `["source_of_funds"]`).

- [ ] **Step 6: Commit**

```bash
git add src/domain/market-packs tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts
git commit -m "feat: market pack module flags drive required evidence and gate future modules"
```

---

### Task 6: Jurisdiction copy lives in the pack — disclosure text and region prompt

**Files:**
- Modify: `src/domain/market-packs/types.ts` (add `DisclosureInput` and `MarketPack.disclosureText`)
- Create: `src/domain/market-packs/ew-disclosure.ts`
- Modify: `src/domain/market-packs/ew.ts` (wire `disclosureText`)
- Modify: `src/domain/referral.ts` (remove the E&W copy)
- Modify: `src/server/referrals.ts:1-13,49-66`
- Modify: `src/domain/intake.ts:74` region prompt
- Modify: `src/components/marketing/StartForm.tsx:120`
- Modify: `tests/support/fixture-pack.ts` (add `disclosureText`)
- Create: `tests/domain/ew-disclosure.test.ts`
- Modify: `tests/domain/referral.test.ts` (remove the disclosure describe block)
- Modify: `tests/server/referrals.test.ts` (pack-resolved disclosure + fail-closed)
- Modify: `tests/domain/engine-country-agnostic.test.ts` (add the two newly-clean files)

**Interfaces:**
- Consumes: `MarketPack`, `MarketPackError` (Task 1); `resolveMarketPack`, `DEFAULT_MARKET_PACK_ID` (Task 3); `PartnerNetworkError`, `getPanelMember` (existing).
- Produces: `DisclosureInput` and `MarketPack.disclosureText(input): string` from `types.ts`; `ewDisclosureText(input)` from `ew-disclosure.ts`. `src/domain/referral.ts` keeps `FEE_STATUSES`, `FeeStatus`, `REFERRAL_SOURCES`, `ReferralSource`, `ReferralRecord`, `isFeeStatus`, `isReferralSource`, `defaultFeeStatus`, `canTransitionFee` and no longer exports `disclosureTextFor`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/ew-disclosure.test.ts` by **moving** the existing disclosure suite: cut the whole `describe("disclosureTextFor (England & Wales)", ...)` block from `tests/domain/referral.test.ts:47-91` into the new file, rename the describe to `"England & Wales disclosure copy"`, replace every `disclosureTextFor(` call with `disclose(`, and use this header and extra test:

```ts
import { describe, it, expect } from "vitest";
import { ewMarketPack } from "../../src/domain/market-packs/ew";

const disclose = ewMarketPack.disclosureText;

// ... the four moved `it(...)` cases: introducer-only mortgage wording, conveyancer
// referral fee, move-partner commission, and "never promises outcomes / rejects
// non-partner roles" (which must still expect a throw matching /partner roles/i).

describe("the region prompt is pack copy", () => {
  it("names England & Wales in the ew pack only", () => {
    expect(ewMarketPack.copy.region_prompt).toBe("Where in England & Wales are you buying?");
  });
});
```

In `tests/domain/referral.test.ts`: delete that describe block and remove `disclosureTextFor,` from the import list. The file keeps its `describe("partner roles", ...)` and `describe("fee status", ...)` suites.

Add to `tests/server/referrals.test.ts`, inside the existing `describe("referrals persistence", ...)`:

```ts
  it("takes the disclosure wording from the case's own market pack", async () => {
    const referral = await createReferral({
      caseId,
      partnerId: "ref_conv_b",
      source: "ADVISOR_MARK",
    });
    expect(referral.disclosureText).toBe(
      ewMarketPack.disclosureText({
        role: "CONVEYANCER",
        partnerName: "Lena Okoro",
        partnerFirm: null,
      }),
    );
    await supersedeActiveReferrals(caseId, "CONVEYANCER");
  });

  it("fails closed when the case points at a pack that cannot be resolved", async () => {
    await prisma.case.update({ where: { id: caseId }, data: { marketPackId: "au" } });
    await expect(
      createReferral({ caseId, partnerId: "ref_conv_a", source: "ADVISOR_MARK" }),
    ).rejects.toThrow(/not enabled/i);
    await prisma.case.update({ where: { id: caseId }, data: { marketPackId: "ew" } });
  });
```

Add `import { ewMarketPack } from "../../src/domain/market-packs/ew";` to that file's imports. Place both new tests **last** in the describe block so they do not disturb the existing referral-ordering assertions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/ew-disclosure.test.ts`
Expected: FAIL — `ewMarketPack.disclosureText is not a function`.

- [ ] **Step 3: Add the disclosure capability to `types.ts`**

```ts
export type DisclosureInput = {
  role: ActorRole;
  partnerName: string;
  partnerFirm: string | null;
};
```

and to `MarketPack`, after `buildPlaybooks`:

```ts
  /** Spec §10: consumer law and referral disclosure are always local. */
  disclosureText: (input: DisclosureInput) => string;
```

- [ ] **Step 4: Create `src/domain/market-packs/ew-disclosure.ts`**

This is a **verbatim move**, not a rewrite. Cut `displayName` and the body of `disclosureTextFor` out of `src/domain/referral.ts:48-71` — the three role strings are regulated copy and must not be reworded. Only the function name, the parameter type and the removal of the inline parameter shape change:

```ts
import type { DisclosureInput } from "./types";

function displayName(partnerName: string, partnerFirm: string | null): string {
  // moved verbatim from referral.ts:48-50
}

/**
 * England & Wales disclosure wording. Spec §7: mortgage = introducer only, no advice;
 * conveyancing referrals lawful if disclosed.
 */
export function ewDisclosureText(input: DisclosureInput): string {
  const who = displayName(input.partnerName, input.partnerFirm);
  switch (input.role) {
    // the MORTGAGE_PARTNER / CONVEYANCER / MOVE_PARTNER cases and the
    // default throw, moved verbatim from referral.ts:62-71
  }
}
```

`tests/domain/ew-disclosure.test.ts` from Step 1 is the moved copy's regression net: it asserts "introducer only", "do not give mortgage advice", "referral fee", "commission", the `Name (Firm)` formatting and the non-partner-role throw.

In `src/domain/market-packs/ew.ts`, add `import { ewDisclosureText } from "./ew-disclosure";` and the field `disclosureText: ewDisclosureText,`.

In `src/domain/referral.ts`, delete `displayName` and `disclosureTextFor` (lines 48-71) and their doc comment. The file now has no jurisdiction copy; keep the rest untouched.

- [ ] **Step 5: Resolve the disclosure from the case's pack in `server/referrals.ts`**

Replace the `disclosureTextFor` import with:

```ts
import { resolveMarketPack } from "../domain/market-packs/registry";
```

and rewrite the head of `createReferral` so the disclosure comes from the case's own pack:

```ts
export async function createReferral(input: {
  caseId: string;
  partnerId: string;
  source: ReferralSource;
  feeStatus?: FeeStatus;
  now?: Date;
}): Promise<ReferralRecord> {
  const caseRow = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: { marketPackId: true },
  });
  if (!caseRow) {
    throw new PartnerNetworkError("Unknown case");
  }
  const pack = resolveMarketPack(caseRow.marketPackId);

  const member = await getPanelMember(input.partnerId);
  if (!member) {
    throw new PartnerNetworkError("Unknown panel member");
  }
  if (!member.active) {
    throw new PartnerNetworkError("Panel member is not active");
  }
```

and inside the `prisma.referral.create` data, replace the `disclosureText` value with:

```ts
      disclosureText: pack.disclosureText({
        role: member.roleType,
        partnerName: member.name,
        partnerFirm: member.firm,
      }),
```

- [ ] **Step 6: Take the region prompt from pack copy**

In `src/domain/intake.ts`, add at the top:

```ts
import { DEFAULT_MARKET_PACK_ID, resolveMarketPack } from "./market-packs/registry";
```

and just below the existing consts:

```ts
/** Intake happens before a case exists, so it uses the default market's copy. */
const DEFAULT_PACK = resolveMarketPack(DEFAULT_MARKET_PACK_ID);
```

then change line 74 to:

```ts
    errors.targetRegion = DEFAULT_PACK.copy.region_prompt;
```

In `src/components/marketing/StartForm.tsx`, add the same two imports and module const, then replace the hardcoded label at line 120 with `{REGION_PROMPT}` where:

```ts
const REGION_PROMPT = resolveMarketPack(DEFAULT_MARKET_PACK_ID).copy.region_prompt;
```

- [ ] **Step 7: Add the two newly-clean files to the guard test**

In `tests/domain/engine-country-agnostic.test.ts`, add to `ENGINE_GLOBAL_FILES`:

```ts
  "src/domain/referral.ts",
  "src/domain/intake.ts",
  "src/server/referrals.ts",
```

- [ ] **Step 8: Add `disclosureText` to the test fixture**

In `tests/support/fixture-pack.ts`, add after `buildPlaybooks`:

```ts
    disclosureText: ({ partnerName }) => `Testland disclosure for ${partnerName}.`,
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including `tests/domain/ew-disclosure.test.ts`, `tests/server/referrals.test.ts`, `tests/domain/intake.test.ts` (it asserts the error key, not the wording), `tests/server/warm-intro.test.ts` and `tests/server/partner-network-reroute.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add src/domain/market-packs src/domain/referral.ts src/domain/intake.ts src/server/referrals.ts src/components/marketing/StartForm.tsx tests
git commit -m "feat: disclosure and region copy resolve from the case's market pack"
```

---

### Task 7: Partner panel and directory are market-local

**Files:**
- Modify: `prisma/schema.prisma` (`PartnerPanel.marketPackId` + index)
- Modify: `prisma/seed.ts` (explicit `marketPackId` on the five members)
- Modify: `src/domain/panel.ts` (`PanelMember.marketPackId`)
- Modify: `src/server/panel.ts` (mapper, filter, `assertPanelMemberInMarket`)
- Modify: `src/app/actions/cockpit.ts` (warm intro), `src/app/actions/partner-network.ts` (re-route)
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx` (market-scoped panel)
- Modify: `src/app/portal/cases/[caseId]/page.tsx` (directory intro + role labels)
- Modify: `src/components/PartnerDirectory.tsx` (copy and labels as props)
- Modify: `tests/server/panel.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_MARKET_PACK_ID` (Task 3); `casePack` (Task 4); `partnerRoleLabel`, `PartnerRoleLabels` (Task 1).
- Produces: `PanelMember.marketPackId: string`; `listPanel(options?: { activeOnly?: boolean; marketPackId?: string })`; `findActivePanelMemberForRole(role: ActorRole, marketPackId?: string)`; `assertPanelMemberInMarket(member: PanelMember, marketPackId: string): void` from `src/server/panel.ts`; `PartnerDirectory` props `{ entries, intro, roleLabels }`.

- [ ] **Step 1: Write the failing test**

In `tests/server/panel.test.ts`:
1. Add `marketPackId: "au"` to a new fourth seeded member and `marketPackId: "ew"` to the three existing ones:

```ts
        {
          id: "panel_mort_other_market",
          roleType: "MORTGAGE_PARTNER",
          name: "Ada Ng",
          firm: "Southern Cross Broking",
          slaDays: 3,
          marketPackId: "au",
        },
```

2. Update the exact-object assertion in `it("maps rows to PanelMember with a typed role and nullable link")` to include `marketPackId: "ew",`.
3. Update the two ordering assertions to account for the new row: `listPanel()` returns `["panel_conv_inactive", "panel_mort_other_market", "panel_mort_linked", "panel_mort_unlinked"]` if ordering by role then name puts "Ada Ng" first among mortgage members — run the test and use the real order it reports rather than guessing; the point of the assertion is stability, not a specific order.
4. Add these tests:

```ts
  it("scopes the panel to one market", async () => {
    const ew = await listPanel({ marketPackId: "ew" });
    expect(ew.map((m) => m.id)).not.toContain("panel_mort_other_market");
    const au = await listPanel({ marketPackId: "au" });
    expect(au.map((m) => m.id)).toEqual(["panel_mort_other_market"]);
  });

  it("never picks a member from another market for a role", async () => {
    expect((await findActivePanelMemberForRole("MORTGAGE_PARTNER", "ew"))?.id).toBe(
      "panel_mort_linked",
    );
    expect((await findActivePanelMemberForRole("MORTGAGE_PARTNER", "au"))?.id).toBe(
      "panel_mort_other_market",
    );
  });

  it("rejects a panel member that is not on the case's market panel", async () => {
    const member = await getPanelMember("panel_mort_other_market");
    expect(() => assertPanelMemberInMarket(member!, "ew")).toThrow(PartnerNetworkError);
    expect(() => assertPanelMemberInMarket(member!, "ew")).toThrow(/ew panel/);
    expect(() => assertPanelMemberInMarket(member!, "au")).not.toThrow();
  });
```

Extend the file's import to `import { assertPanelMemberInMarket, findActivePanelMemberForRole, getPanelMember, listPanel, PartnerNetworkError, setPanelMemberActive } from "../../src/server/panel";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/panel.test.ts`
Expected: FAIL — `Unknown arg 'marketPackId' in data.marketPackId for type PartnerPanelCreateManyInput`.

- [ ] **Step 3: Add the column and push it**

In `prisma/schema.prisma`, add to `model PartnerPanel` after `slaDays`:

```prisma
  marketPackId String  @default("ew")
```

and after the `referrals` relation line:

```prisma
  @@index([marketPackId, roleType])
```

The `"ew"` default here duplicates `DEFAULT_MARKET_PACK_ID` because Prisma schema cannot import TypeScript; keep the two in step.

Run: `npm run db:push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Carry the market through the panel modules**

`src/domain/panel.ts` — add to `PanelMember`:

```ts
  /** Spec §10: "partner panels — always local". */
  marketPackId: string;
```

`src/server/panel.ts` — add `marketPackId: row.marketPackId,` to `toPanelMember`, and:

```ts
export async function listPanel(
  options: { activeOnly?: boolean; marketPackId?: string } = {},
): Promise<PanelMember[]> {
  const rows = await prisma.partnerPanel.findMany({
    where: {
      ...(options.activeOnly ? { active: true } : {}),
      ...(options.marketPackId ? { marketPackId: options.marketPackId } : {}),
    },
    orderBy: [{ roleType: "asc" }, { name: "asc" }],
  });
  return rows.map(toPanelMember);
}
```

```ts
/** Active member for a role in one market; members with a portal login come first. */
export async function findActivePanelMemberForRole(
  role: ActorRole,
  marketPackId: string = DEFAULT_MARKET_PACK_ID,
): Promise<PanelMember | null> {
  const rows = await prisma.partnerPanel.findMany({
    where: { roleType: role, active: true, marketPackId },
    orderBy: { name: "asc" },
  });
  const members = rows.map(toPanelMember);
  return members.find((m) => m.userId !== null) ?? members[0] ?? null;
}

/** Spec §10: panels are local. A case may only be introduced to its own market's panel. */
export function assertPanelMemberInMarket(
  member: PanelMember,
  marketPackId: string,
): void {
  if (member.marketPackId !== marketPackId) {
    throw new PartnerNetworkError(
      `${member.name} is not on the ${marketPackId} panel`,
    );
  }
}
```

Add `import { DEFAULT_MARKET_PACK_ID } from "../domain/market-packs/registry";` to that file.

`prisma/seed.ts` — add `marketPackId: "ew",` to each of the five `prisma.partnerPanel.createMany` entries.

- [ ] **Step 5: Enforce the market in the two partner actions**

In `src/app/actions/cockpit.ts` → `warmIntroAction`, after `assertWarmIntro(caseState);`:

```ts
    const member = await getPanelMember(panelMemberId);
    if (!member || !member.active) {
      return { ok: false, error: "Panel member is not available for warm intros" };
    }
    assertPanelMemberInMarket(member, caseState.marketPackId);
```

and extend the import to `import { assertPanelMemberInMarket, getPanelMember, PartnerNetworkError } from "@/server/panel";`.

In `src/app/actions/partner-network.ts` → `reroutePartnerAction`, add the same `assertPanelMemberInMarket(member, caseState.marketPackId);` line immediately after the existing member lookup/active check, and add `assertPanelMemberInMarket` to its `@/server/panel` import.

- [ ] **Step 6: Scope both case surfaces to the case's market**

`src/app/cockpit/cases/[caseId]/page.tsx` — change the panel load to:

```ts
  const panel = await listPanel({
    activeOnly: true,
    marketPackId: caseState.marketPackId,
  });
```

`src/app/portal/cases/[caseId]/page.tsx` — change the directory load and pass pack copy to the component:

```ts
  const pack = casePack(caseState);
  const directory = canViewDirectory(caseState)
    ? directoryEntries(
        await listPanel({ activeOnly: true, marketPackId: caseState.marketPackId }),
      )
    : null;
```

```tsx
      {directory && (
        <PartnerDirectory
          entries={directory}
          intro={pack.copy.directory_intro}
          roleLabels={pack.partnerRoleLabels}
        />
      )}
```

Add `import { casePack } from "@/lib/case-pack";` to the portal page.

- [ ] **Step 7: Make `PartnerDirectory` copy pack-driven**

Follow the component's existing markup and Tailwind classes; only the props, the intro paragraph and the role label change:

```tsx
import Link from "next/link";
import type { PartnerRoleLabels } from "@/domain/market-packs/types";
import type { DirectoryEntry } from "@/domain/panel";
import type { ActorRole } from "@/domain/types";

type Props = {
  entries: DirectoryEntry[];
  intro: string;
  roleLabels: PartnerRoleLabels;
};

/** Spec §5: Free DIY gets a "Partner directory (not warm intro)". Names and categories only. */
export function PartnerDirectory({ entries, intro, roleLabels }: Props) {
```

- Replace the hardcoded `<p>` text with `{intro}`.
- Replace `{label(roleType)}` with `{roleLabels[roleType as ActorRole]}` and delete the local `label` helper.
- Leave the grouping logic, empty state and the `/pricing` upgrade CTA exactly as they are.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including `tests/server/panel.test.ts`, `tests/server/scorecards.test.ts`, `tests/server/warm-intro.test.ts`, `tests/server/warm-intro-action.test.ts` and `tests/server/partner-network-reroute.test.ts`.

Run: `npm run db:seed`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add prisma src/domain/panel.ts src/server/panel.ts src/app/actions/cockpit.ts src/app/actions/partner-network.ts "src/app/cockpit/cases/[caseId]/page.tsx" "src/app/portal/cases/[caseId]/page.tsx" src/components/PartnerDirectory.tsx tests/server/panel.test.ts
git commit -m "feat: partner panel membership and directory copy are market-local"
```

---

### Task 8: Advisor cockpit market pack inspector (read-only)

**Files:**
- Create: `src/domain/market-packs/inspector.ts`
- Modify: `src/server/cockpit-policy.ts` (add `assertPackInspectorVisible`)
- Create: `src/app/cockpit/market-packs/page.tsx`
- Modify: `src/app/cockpit/layout.tsx:40-50` (nav link)
- Create: `tests/domain/market-pack-inspector.test.ts`
- Create: `tests/server/pack-inspector-policy.test.ts`

**Interfaces:**
- Consumes: `MarketPack`, `MarketCopyKey`, `MARKET_COPY_KEYS`, `packModules`, `packEvidenceKinds`, `getStageTemplate` (Tasks 1-5); `listMarketPacks`, `DEFAULT_MARKET_PACK_ID` (Task 3); `ENTRY_CONTEXTS` (Task 1); `CockpitPolicyError` (existing).
- Produces: `MarketPackStageRow`, `MarketPackSummary`, `marketPackSummary(pack, entry)` from `src/domain/market-packs/inspector.ts`; `assertPackInspectorVisible(viewerRole)` from `src/server/cockpit-policy.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/market-pack-inspector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import { marketPackSummary } from "../../src/domain/market-packs/inspector";
import { MARKET_MODULE_KEYS } from "../../src/domain/market-packs/types";

describe("market pack summary", () => {
  const summary = marketPackSummary(ewMarketPack, "RETURNER_OVERSEAS");

  it("describes the active pack as configuration", () => {
    expect(summary.id).toBe("ew");
    expect(summary.name).toBe("England & Wales");
    expect(summary.jurisdiction).toBe("england_wales");
    expect(summary.enabled).toBe(true);
    expect(summary.entryContext).toBe("RETURNER_OVERSEAS");
    expect(summary.locale.currencyCode).toBe("GBP");
  });

  it("lists every module with its state and every stage in order", () => {
    expect(summary.modules).toHaveLength(MARKET_MODULE_KEYS.length);
    expect(summary.modules.find((m) => m.key === "fx_deposit")?.enabled).toBe(true);
    expect(summary.modules.find((m) => m.key === "chain_free_inventory")?.enabled).toBe(false);
    expect(summary.stages.map((s) => s.key)).toEqual(
      ewMarketPack.buildStages("RETURNER_OVERSEAS").map((s) => s.key),
    );
    expect(summary.stages[1]).toMatchObject({
      key: "money_readiness",
      ownerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["source_of_funds", "fx_plan"],
    });
  });

  it("lists copy keys, role labels, evidence kinds and playbook coverage", () => {
    expect(summary.copy.map((row) => row.key)).toContain("region_prompt");
    expect(summary.partnerRoleLabels).toContainEqual({
      role: "CONVEYANCER",
      label: "conveyancer",
    });
    expect(summary.evidenceKinds).toContain("completion_confirmed");
    expect(summary.playbookStageKeys).toEqual(summary.stages.map((s) => s.key));
  });

  it("never carries playbook prose — PlaybookPanel stays the only playbook surface", () => {
    const serialised = JSON.stringify(summary);
    for (const playbook of ewMarketPack.buildPlaybooks("RETURNER_OVERSEAS")) {
      expect(serialised).not.toContain(playbook.objective);
      for (const step of playbook.actions) {
        expect(serialised).not.toContain(step.action);
      }
      for (const line of playbook.evidenceStandard) {
        expect(serialised).not.toContain(line);
      }
      for (const line of playbook.escalation) {
        expect(serialised).not.toContain(line);
      }
    }
  });

  it("summarises a disabled pack without enabling it", () => {
    const stub = marketPackSummary(auStubPack, "UK_RESIDENT_SPEED");
    expect(stub.enabled).toBe(false);
    expect(stub.locale.currencyCode).toBe("AUD");
    expect(stub.stages.map((s) => s.key)).toContain("finance_path");
    expect(stub.playbookStageKeys).toEqual([]);
    expect(stub.evidenceKinds).toEqual([]);
  });
});
```

Create `tests/server/pack-inspector-policy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  assertPackInspectorVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";

describe("pack inspector visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertPackInspectorVisible("ADVISOR")).not.toThrow();
    for (const role of ["CLIENT", "MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"] as const) {
      expect(() => assertPackInspectorVisible(role)).toThrow(CockpitPolicyError);
    }
    expect(() => assertPackInspectorVisible("CLIENT")).toThrow(/advisor-only/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/market-pack-inspector.test.ts tests/server/pack-inspector-policy.test.ts`
Expected: FAIL — `Failed to load .../market-packs/inspector`; `"assertPackInspectorVisible" is not exported`.

- [ ] **Step 3: Create `src/domain/market-packs/inspector.ts`**

```ts
import type { ActorRole, EntryContext } from "../types";
import {
  getStageTemplate,
  MARKET_COPY_KEYS,
  packEvidenceKinds,
  packModules,
  type MarketCopyKey,
  type MarketLocale,
  type MarketModuleRow,
  type MarketPack,
} from "./types";

export type MarketPackStageRow = {
  key: string;
  title: string;
  ownerRole: ActorRole;
  slaDays: number;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
};

/**
 * Read-only configuration view for the advisor cockpit. Deliberately carries no
 * playbook prose: playbook IP renders only through PlaybookPanel.
 */
export type MarketPackSummary = {
  id: string;
  name: string;
  jurisdiction: string;
  enabled: boolean;
  locale: MarketLocale;
  modules: MarketModuleRow[];
  copy: Array<{ key: MarketCopyKey; text: string }>;
  partnerRoleLabels: Array<{ role: ActorRole; label: string }>;
  entryContext: EntryContext;
  stages: MarketPackStageRow[];
  evidenceKinds: string[];
  playbookStageKeys: string[];
};

export function marketPackSummary(
  pack: MarketPack,
  entry: EntryContext,
): MarketPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    jurisdiction: pack.jurisdiction,
    enabled: pack.enabled,
    locale: pack.locale,
    modules: packModules(pack),
    copy: MARKET_COPY_KEYS.map((key) => ({ key, text: pack.copy[key] })),
    partnerRoleLabels: Object.entries(pack.partnerRoleLabels).map(([role, label]) => ({
      role: role as ActorRole,
      label,
    })),
    entryContext: entry,
    stages: getStageTemplate(pack, entry).map((template) => ({
      key: template.key,
      title: template.title,
      ownerRole: template.defaultOwnerRole,
      slaDays: template.slaDays,
      requiredEvidenceKinds: [...template.requiredEvidenceKinds],
      freeVisible: template.freeVisible,
      freeCanSelfAdvance: template.freeCanSelfAdvance,
    })),
    evidenceKinds: packEvidenceKinds(pack),
    playbookStageKeys: pack.buildPlaybooks(entry).map((p) => p.stageKey),
  };
}
```

- [ ] **Step 4: Add the cockpit policy guard**

Append to `src/server/cockpit-policy.ts`:

```ts
export function assertPackInspectorVisible(viewerRole: ActorRole): void {
  if (viewerRole !== "ADVISOR") {
    throw new CockpitPolicyError(
      "The market pack inspector is advisor-only operating IP",
    );
  }
}
```

- [ ] **Step 5: Create the inspector page**

Create `src/app/cockpit/market-packs/page.tsx` — a server component following the layout and Tailwind conventions already used by `src/app/cockpit/panel/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { marketPackSummary } from "@/domain/market-packs/inspector";
import {
  DEFAULT_MARKET_PACK_ID,
  findMarketPack,
  listMarketPacks,
} from "@/domain/market-packs/registry";
import { ENTRY_CONTEXTS, type EntryContext } from "@/domain/types";
import { auth } from "@/lib/auth";
import { assertPackInspectorVisible } from "@/server/cockpit-policy";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MarketPacksPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    notFound();
  }
  assertPackInspectorVisible("ADVISOR");

  const resolved = await searchParams;
  const packId = single(resolved.pack) ?? DEFAULT_MARKET_PACK_ID;
  const entryParam = single(resolved.entry) as EntryContext | undefined;
  const entry: EntryContext =
    entryParam && ENTRY_CONTEXTS.includes(entryParam) ? entryParam : "RETURNER_OVERSEAS";

  const packs = listMarketPacks();
  const selected = findMarketPack(packId) ?? findMarketPack(DEFAULT_MARKET_PACK_ID)!;
  const summary = marketPackSummary(selected, entry);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Market packs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Read-only configuration. The stage engine is country-agnostic; everything on
        this page is pack data resolved from <code>case.marketPackId</code>.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {packs.map((pack) => (
          <a
            key={pack.id}
            href={`/cockpit/market-packs?pack=${pack.id}&entry=${entry}`}
            className={`rounded border px-3 py-1 text-sm ${
              pack.id === summary.id
                ? "border-slate-900 bg-slate-900 text-slate-50"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {pack.id} · {pack.name}
            <span className="ml-2 text-xs">{pack.enabled ? "active" : "disabled"}</span>
          </a>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ENTRY_CONTEXTS.map((value) => (
          <a
            key={value}
            href={`/cockpit/market-packs?pack=${summary.id}&entry=${value}`}
            className={`rounded border px-3 py-1 text-xs ${
              value === summary.entryContext
                ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {value.replace(/_/g, " ").toLowerCase()}
          </a>
        ))}
      </div>

      {/* Three summary cards, same markup as the stat cards in /cockpit/panel/page.tsx */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Jurisdiction",
            value: summary.jurisdiction,
            note: summary.enabled
              ? "Enabled — may back live cases"
              : "Disabled — fails closed",
          },
          {
            label: "Locale",
            value: `${summary.locale.bcp47} · ${summary.locale.currencyCode}`,
            note: `address: ${summary.locale.addressFieldKeys.join(", ")}`,
          },
          {
            label: "Evidence kinds",
            value: String(summary.evidenceKinds.length),
            note: summary.evidenceKinds.join(", ") || "none yet",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <p className="text-xs uppercase text-slate-500">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.note}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-medium text-slate-900">Modules</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {summary.modules.map((module) => (
          <li
            key={module.key}
            className={`rounded px-2 py-1 text-xs ${
              module.enabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {module.key} · {module.enabled ? "on" : "off"}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-medium text-slate-900">
        Stage template ({summary.stages.length})
      </h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Required evidence</th>
              <th className="px-3 py-2">Free</th>
            </tr>
          </thead>
          <tbody>
            {summary.stages.map((stage) => (
              <tr key={stage.key} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-900">
                  {stage.title}
                  <span className="block text-xs text-slate-500">{stage.key}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {summary.partnerRoleLabels.find((r) => r.role === stage.ownerRole)?.label ??
                    stage.ownerRole}
                </td>
                <td className="px-3 py-2 text-slate-700">{stage.slaDays}d</td>
                <td className="px-3 py-2 text-slate-700">
                  {stage.requiredEvidenceKinds.join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {stage.freeVisible ? "visible" : "hidden"}
                  {stage.freeCanSelfAdvance ? " · self-advance" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-medium text-slate-900">Jurisdiction copy</h2>
      <dl className="mt-2 space-y-2">
        {summary.copy.map((row) => (
          <div key={row.key} className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs uppercase text-slate-500">{row.key}</dt>
            <dd className="mt-1 text-sm text-slate-800">{row.text}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-xs text-slate-500">
        Playbooks exist for {summary.playbookStageKeys.length} of {summary.stages.length}{" "}
        stages. Playbook detail renders only on a case page.
      </p>
    </section>
  );
}
```

- [ ] **Step 6: Add the nav link**

In `src/app/cockpit/layout.tsx`, add after the "Partner panel" link:

```tsx
        <a
          href="/cockpit/market-packs"
          className="text-slate-700 hover:text-slate-900"
        >
          Market packs
        </a>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including the two new files.

- [ ] **Step 8: Commit**

```bash
git add src/domain/market-packs/inspector.ts src/server/cockpit-policy.ts src/app/cockpit/market-packs src/app/cockpit/layout.tsx tests/domain/market-pack-inspector.test.ts tests/server/pack-inspector-policy.test.ts
git commit -m "feat: advisor-only read-only market pack inspector in the cockpit"
```

---

### Task 9: Demo script, README and final verification

**Files:**
- Create: `docs/superpowers/plans/demo-script-market-packs.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1-8. Produces documentation only.

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-market-packs.md`:

```markdown
# Market pack demo script

Founder validation script for the **configuration layer** thesis: England & Wales is a
pack, not the product; the stage engine is country-agnostic; a second pack can be
registered without touching the engine; and an unknown or not-yet-enabled market fails
closed instead of silently behaving like the UK.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. E&W is a pack, and the cockpit can read it

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Two packs are listed: `ew · England & Wales` (**active**) and `au · Australia (configuration stub — not enabled)` (**disabled**).
3. On `ew`, confirm jurisdiction `england_wales`, locale `en-GB · GBP`, address keys `line1, line2, town, county, postcode`.
4. Modules: only `fx_deposit` is **on**. `chain_free_inventory`, `hard_client_sla`, `corridor_inbound`, `corridor_outbound`, `document_vault` and `partner_speed_rails` are **off** — the spec §9 dependency rule as data, not a promise in a doc.
5. The stage table shows the nine E&W stages with owner labels from the pack (`conveyancer`, `mortgage adviser`, `removals partner`), SLA days and required evidence.
6. Jurisdiction copy shows `region_prompt`, `directory_intro`, `mortgage_posture` and `jurisdiction_scope` — the same strings the funnel and portal render.
7. Note what is **not** here: no playbook prose. Playbook IP still renders only on a case page.

## 2. Entry context branches the pack, not the engine

1. Still on `/cockpit/market-packs`, click **returner overseas** → `money_readiness` requires `source_of_funds, fx_plan`; `move_logistics` requires `move_quote, vehicle_path`.
2. Click **uk resident speed** → `money_readiness` requires `source_of_funds` only and `move_logistics` drops `vehicle_path`.
3. Nothing about the engine changed: only `buildStages(entry)` on the pack.

## 3. The engine reads the pack through the case

1. `/cockpit/cases` → **Bloggs return (paid)**.
2. The current-owner banner's days-in-stage and escalation come from the pack's SLA for that stage (`purchase_profile` = 3 days), resolved via `case.marketPackId`.
3. **Warm intro** → the dropdown only offers members of the `ew` panel. Request one.
4. **Referrals & disclosure**: the disclosure text is the `ew` pack's wording — "introducer only", "do not give mortgage advice".
5. Advisor case controls → **Entry context** → change it. The required evidence rebuilds from the pack, not from a hardcoded list.

## 4. The second pack proves the registry without shipping AU

1. Back on `/cockpit/market-packs`, select the **au** pack.
2. Confirm locale `en-AU · AUD`, region noun `state`, stage key `finance_path` instead of `mortgage_path`, **every** stage `hidden` to free users, **zero** evidence kinds, **zero** playbooks, and every module off.
3. This is the whole point: the engine renders a nine-stage plan for a pack with different keys, a different currency and no UK legal steps. Corridor product work stays Plan 7.

## 5. Fail closed, not fail-UK

Run in a scratch shell (`npx tsx`), or read `tests/server/market-pack-resolution.test.ts`
which asserts exactly this:

1. Creating a case with `marketPackId: "au"` rejects with `Market pack is not enabled: au`.
2. Editing a stored case to `marketPackId: "zz"` makes `loadCase` reject with `Unknown market pack: zz`.
3. Neither falls back to `ew`. A market we have not built refuses to run rather than quietly applying English law.

## 6. Guardrails you cannot regress past

1. `npm test -- tests/domain/engine-country-agnostic.test.ts` — the engine-global modules
   contain no `£`, `GBP`, `en-GB`, `england` or `wales`, and never import the `ew` pack.
2. `npm test -- tests/domain/market-pack-flags.test.ts` — chain-free and hard-SLA modules
   are off in every registered pack.
3. `npm test -- tests/domain/market-pack-inspector.test.ts` — the inspector view model
   carries no playbook prose.
```

- [ ] **Step 2: Update the README**

In `README.md`, replace the "Advisor operating IP" section with the following two sections (keep every other section as-is, and keep the existing partner/scorecard section above it):

```markdown
## Market packs (configuration layer)

England & Wales is the **first market pack**, not the product. The stage engine is
country-agnostic; everything local lives in `src/domain/market-packs/`:

| Layer | File | Responsibility |
|---|---|---|
| Interface + pure helpers | `types.ts` | `MarketPack`, `MarketLocale`, `MarketFlags`, `MarketCopy`, `PartnerRoleLabels`, `StagePlaybook`, `MarketPackError` |
| Money formatting | `locale.ts` | `formatMoney(locale, amount)` — no currency literal anywhere else |
| E&W config | `ew-config.ts` | locale (`en-GB` / `GBP`), module flags, jurisdiction copy, partner-role labels |
| E&W legal spine | `ew-stages.ts` | the nine stage templates and their evidence kinds |
| E&W operating IP | `ew-playbook.ts` | entry-context playbooks (advisor-only) |
| E&W consumer law | `ew-disclosure.ts` | referral disclosure wording |
| Assembly | `ew.ts`, `au-stub.ts` | pack objects only |
| Resolution | `registry.ts` | `DEFAULT_MARKET_PACK_ID`, `listMarketPacks`, `resolveMarketPack` |
| Cockpit view model | `inspector.ts` | read-only `marketPackSummary` |

**Resolution is fail-closed.** Every surface resolves the pack from `case.marketPackId`
(`src/lib/case-pack.ts` → `casePack`, `stageSlaDays`). An unknown id or a registered-but-
disabled pack throws `MarketPackError` — it never falls back to `ew`.

**Module toggles are data, not scattered ifs.** `MarketFlags` on the pack are read through
`isModuleEnabled`. The `ew` pack runs `fx_deposit` only; `chain_free_inventory`,
`hard_client_sla`, `corridor_inbound`, `corridor_outbound`, `document_vault` and
`partner_speed_rails` are off in every pack, enforced by
`tests/domain/market-pack-flags.test.ts` (the spec's dependency rule).

**`au` is a stub, not a product.** It is registered and `enabled: false`, with a different
currency, address shape and stage keys (`finance_path`, `settlement_complete`), no
playbooks, no evidence kinds and no partners. It exists to prove the registry resolves more
than one pack. Corridor journeys (AU↔UK, US↔UK) are a later plan.

**What stays engine-global:** the stage engine, pressure/escalation model, freemium
discipline, partner scorecards and advisor cockpit. `tests/domain/engine-country-agnostic.test.ts`
scans those modules and fails if any of them gains a jurisdiction literal or imports the
`ew` pack directly.

**Known limitation:** `EntryContext` values (`RETURNER_IN_UK`, `UK_RESIDENT_SPEED`) are
persisted enum labels from earlier plans and were deliberately not renamed. Entry context
is metadata; packs localise it through `MarketCopy` and `buildPlaybooks(entry)`. Marketing
copy in `src/content/marketing.ts` is brand copy and is intentionally not pack data.

Walkthrough: [`docs/superpowers/plans/demo-script-market-packs.md`](docs/superpowers/plans/demo-script-market-packs.md).

## Advisor operating IP

Stage playbooks live in `src/domain/market-packs/ew-playbook.ts`, resolve through
`pack.buildPlaybooks(entry)` and render only inside `/cockpit`. `assertPlaybookVisible`
rejects every non-advisor role, and `tests/server/cockpit-playbook-policy.test.ts` asserts
no playbook string can appear in a client stage view. The read-only pack inspector at
`/cockpit/market-packs` is guarded by `assertPackInspectorVisible` and deliberately carries
no playbook prose.
```

Also update the seeded-panel table's caption line to note the market: change the line
`Seeded partner panel (`PartnerPanel`):` to:

```markdown
Seeded partner panel (`PartnerPanel`) — all five members are on the `ew` panel (`marketPackId = "ew"`):
```

- [ ] **Step 3: Full verification**

Run: `npm test`
Expected: PASS, no failing files.

Run: `npm run build`
Expected: `✓ Compiled successfully` with no TypeScript or lint errors.

Run: `npm run db:push && npm run db:seed`
Expected: both exit 0.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, then as `advisor@example.com`:
1. `/cockpit/market-packs` renders both packs, switches pack and entry context.
2. `/cockpit/cases/<id>` still shows the owner banner, playbook panel, warm intro and referral panel.
3. As `client@example.com`, a free case still shows the partner directory with the E&W intro copy and pack role labels.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/demo-script-market-packs.md README.md
git commit -m "docs: market pack demo script and README configuration layer"
```

---

## Self-review notes

**Spec coverage:**
- §8 "England & Wales as first market pack; feature-flag future segments and modules" → Tasks 1, 3, 5.
- §8 "country-agnostic stage engine; local rules/partners/copy live in market packs — do not encode UK-only assumptions (currency, address, legal steps as config/data)" → Task 1 (`MarketLocale`, `ew-stages.ts`), Task 4 (registry resolution + guard test), Task 6 (disclosure and region copy).
- §10 "What travels: portal pressure model, freemium discipline, partner scorecards, advisor cockpit" → untouched engine-global modules, asserted by the Task 4 guard test.
- §10 "What doesn't: mortgage rules, conveyancing, land registries, consumer law, partner panels — always local" → Task 6 (disclosure), Task 7 (panel), Tasks 1-2 (stages, evidence, playbooks).
- §9 dependency rule (no chain-free inventory, no hard SLAs) → Task 5 flag guard test.
- §13 sub-project 4 goals 1-8 → Task 1 (goal 1), Tasks 1-2 and 6 (goal 2), Tasks 3-4 (goal 3), Task 5 (goal 4), Task 8 (goal 5), Task 7 (goal 6), Task 9 (goal 7), Task 3 (goal 8, stub only).

**Non-goals honoured:** no AU/US journeys (the `au` pack is disabled with no playbooks, evidence, partners or disclosure copy), no partner APIs, no chain-free, no client SLAs, no document vault, no FCA AR, no marketplace. Plans 1-3 features are only touched where pack extraction requires it.

**Type consistency:** `MarketPack` gains `buildPlaybooks` in Task 2 and `disclosureText` in Task 6; `tests/support/fixture-pack.ts` and `au-stub.ts` are updated in the same tasks so no pack is ever missing a required field. `moneyEvidenceKinds` changes arity once (Task 5) and both call sites (`ewStageTemplates`, `ew-playbook.ts`) change with it. `stageSlaDays` changes signature once (Task 4) and both case pages move to the shared `src/lib/case-pack.ts` helper. `getStageTemplate` is re-exported from `ew.ts` in Task 1 purely so Tasks 1-3 compile, and that re-export is deleted in Task 4 together with its remaining importers.
