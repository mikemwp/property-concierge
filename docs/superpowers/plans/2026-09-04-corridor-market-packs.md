# Corridor Market Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four enabled bidirectional corridor packs (`au_uk`, `uk_au`, `us_uk`, `uk_us`) on the existing stage engine, proving destination-driven legal spines, corridor flags, local disclosure, intake selection for inbound-to-E&W diaspora, and advisor-created outbound cases — without turning on the disabled `au` stub or rebuilding Plans 1–6.

**Architecture:** Destination jurisdiction owns the legal spine. Shared `corridor.ts` helpers are country-agnostic and parameterized by flags + entry + copy. E&W-destination packs (`au_uk`, `us_uk`) reuse `ewLegalSpine` / `ewLegalPlaybooks` and overlay corridor evidence. AU-destination (`uk_au`) and US-destination (`uk_us`) ship real nine-stage product content. The registry stays fail-closed. The `au` stub stays disabled as architecture proof, not a domestic AU product.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§9 Phase 5, §10 bidirectional corridors, §13 sub-project 7).

**Builds on (already shipped, do not rebuild):**
- Plan 1 — `src/domain/stage-engine.ts` (`createCase` already accepts `marketPackId`).
- Plan 2 — intake, `/start`, playbooks, marketing funnel.
- Plan 3 — panel, scorecards, referrals, disclosure plumbing.
- Plan 4 — `MarketPack` / `MarketFlags` / `isModuleEnabled`, `ew` + disabled `au` stub, inspector, `createCaseRecord({ marketPackId })`.
- Plan 5 — `partner_speed_rails` on for `ew` only.
- Plan 6 — `chain_free_inventory` on for `ew` only; `chain_free_matching` is an E&W overlay.

**Follow-on plans (not this plan):** document vault, hard client-facing SLAs, domestic AU-only / US-only packs (only after corridor proof), seller views, open marketplace, FCA Appointed Representative status.

## Global Constraints

Copied from the spec and the Plan 7 brief. Every task's requirements implicitly include this section.

- **Country-agnostic engine:** no jurisdiction literals (`£`, `GBP`, `en-GB`, `england`, `wales`) in engine-global modules. Corridor helpers are parameterized; local names live in pack files.
- **Fail closed registry:** unknown or disabled packs throw `MarketPackError`. The `au` stub stays `enabled: false`.
- **`corridor_inbound` / `corridor_outbound` turn ON only on the four corridor packs.** They stay off on `ew` and the `au` stub.
- **`chain_free_inventory` stays ew-only** (Plan 6 overlay). Corridor packs must not insert `chain_free_matching`.
- **`partner_speed_rails` stays ew-only** (Plan 5).
- **`hard_client_sla` stays off everywhere.**
- **`fx_deposit` ON for every corridor pack** (cross-border money movement).
- **No estate-agency activity, no seller inventory, no hard client SLAs.**
- **No Prisma schema changes** unless a task proves they are required. Use the existing `Case.marketPackId` and `PartnerPanel.marketPackId` columns.
- **`EntryContext` enum is not renamed.** `RETURNER_OVERSEAS`, `RETURNER_IN_UK`, `UK_RESIDENT_SPEED` persist. Packs interpret them through copy and playbooks.
- **TDD** per task; `npm test` stays green after each task's own files; `npm test` + `npm run build` pass at the end.
- **Engineering:** DRY, YAGNI, frequent commits; server actions keep `{ ok: true } | { ok: false; error: string }` (or the existing signup `{ ok: false; errors }` shape).

## Locked design decisions

**Pack IDs (short, sortable):** `au_uk`, `uk_au`, `us_uk`, `uk_us`.

**Destination drives the legal spine:**

| Pack | Direction | Jurisdiction | Spine keys (legal close) | Disclosure / milestones |
|---|---|---|---|---|
| `au_uk` | Australia → E&W | `england_wales` | E&W: `mortgage_path`, `exchange_complete` | reuse `ewDisclosureText`, `ewPartnerMilestones` |
| `us_uk` | United States → E&W | `england_wales` | E&W: `mortgage_path`, `exchange_complete` | reuse `ewDisclosureText`, `ewPartnerMilestones` |
| `uk_au` | UK → Australia | `australia` | AU: `finance_path`, `settlement_complete` | new `au-disclosure.ts`, `au-milestones.ts` |
| `uk_us` | UK → United States | `united_states` | US: `finance_path`, `closing_complete` | new `us-disclosure.ts`, `us-milestones.ts` |

**Corridor flags (explicit per pack):** every corridor pack is inbound-to-destination **and** outbound-from-origin (departure / visa / shipping). Both flags are `true` on all four. Both stay `false` on `ew` and `au`.

**Entry-context interpretation (enum not renamed):**
- `RETURNER_OVERSEAS` — household is not yet in the destination (visa + departure + vehicle path).
- `RETURNER_IN_UK` — household is in the UK (inbound-to-E&W: already arrived; outbound-from-UK: still at origin).
- `UK_RESIDENT_SPEED` — UK-resident speed-seeker on the same engine. Corridor money still requires `fx_plan` because funds cross a border.

**Intake:** `/start` may select `ew` (default), `au_uk`, or `us_uk`. `uk_au` and `uk_us` are advisor-created (cockpit action) or seeded.

**Do not reassign a live case to a different pack.** Stage keys differ across spines; `saveCase` updates stages by `caseId_key` and cannot rebuild a spine. Create a new case instead.

## File structure (locked)

```
src/domain/
  intake.ts                                    # MODIFY (Task 7): optional marketPackId
  attribution.ts                               # MODIFY (Task 8): UK→AU / UK→US lead sources
  market-packs/
    corridor.ts                                # NEW (Task 1): evidence helpers + playbook overlay
    ew-stages.ts                               # MODIFY (Task 2): export ewLegalSpine
    ew-playbook.ts                             # MODIFY (Task 2): export ewLegalPlaybooks
    au-uk-config.ts                            # NEW (Task 2)
    au-uk-stages.ts                            # NEW (Task 2)
    au-uk-playbook.ts                          # NEW (Task 2)
    au-uk.ts                                   # NEW (Task 2)
    us-uk-config.ts                            # NEW (Task 3)
    us-uk-stages.ts                            # NEW (Task 3)
    us-uk-playbook.ts                          # NEW (Task 3)
    us-uk.ts                                   # NEW (Task 3)
    au-disclosure.ts                           # NEW (Task 4)
    au-milestones.ts                           # NEW (Task 4)
    uk-au-config.ts                            # NEW (Task 4)
    uk-au-stages.ts                            # NEW (Task 4)
    uk-au-playbook.ts                          # NEW (Task 4)
    uk-au.ts                                   # NEW (Task 4)
    us-disclosure.ts                           # NEW (Task 5)
    us-milestones.ts                           # NEW (Task 5)
    uk-us-config.ts                            # NEW (Task 5)
    uk-us-stages.ts                            # NEW (Task 5)
    uk-us-playbook.ts                          # NEW (Task 5)
    uk-us.ts                                   # NEW (Task 5)
    registry.ts                                # MODIFY (Tasks 2–5, 7)
    au-stub.ts                                 # MODIFY (Task 4): comment only — stays disabled
    inspector.ts                               # UNCHANGED (already pack-generic)
src/server/
  signup.ts                                    # MODIFY (Task 7): persist intake.marketPackId
  cases.ts                                     # MODIFY (Task 9): listCasesForUser includes marketPackId
src/app/actions/
  signup.ts                                    # MODIFY (Task 7)
  case-admin.ts                                # MODIFY (Task 9): createAdvisorCaseAction
src/components/
  marketing/StartForm.tsx                      # MODIFY (Task 7)
  CreateAdvisorCaseForm.tsx                    # NEW (Task 9)
src/app/cockpit/cases/page.tsx                 # MODIFY (Task 9)
prisma/seed.ts                                 # MODIFY (Task 8)
tests/domain/
  corridor.test.ts                             # NEW (Task 1)
  engine-country-agnostic.test.ts              # MODIFY (Task 1)
  au-uk-pack.test.ts                           # NEW (Task 2)
  us-uk-pack.test.ts                           # NEW (Task 3)
  uk-au-pack.test.ts                           # NEW (Task 4)
  au-disclosure.test.ts                        # NEW (Task 4)
  uk-us-pack.test.ts                           # NEW (Task 5)
  us-disclosure.test.ts                        # NEW (Task 5)
  market-pack-flags.test.ts                    # MODIFY (Tasks 2, 6)
  market-pack-registry.test.ts                 # MODIFY (Tasks 2–6)
  market-pack-inspector.test.ts                # MODIFY (Task 6)
  intake.test.ts                               # MODIFY (Task 7)
tests/server/
  signup.test.ts                               # MODIFY (Task 7)
  market-pack-resolution.test.ts               # MODIFY (Task 8)
  advisor-create-case.test.ts                  # NEW (Task 9)
docs/superpowers/plans/
  demo-script-corridor-packs.md                # NEW (Task 10)
  demo-script-market-packs.md                  # MODIFY (Task 10)
README.md                                      # MODIFY (Task 10)
```

**Layering rule:** `corridor.ts` imports only `../types` (entry) and `./types` (`MarketFlags`, `StageTemplate`, `StagePlaybook`, `isModuleEnabled`). It must not import `ew`, `ew-config`, Prisma, or Next. Pack files may import `ewLegalSpine` / `ewLegalPlaybooks` / `ewDisclosureText`. `registry.ts` is the only module that names every pack id in one array.

**Flag matrix (final, after Task 6):**

| Pack | enabled | fx_deposit | corridor_inbound | corridor_outbound | partner_speed_rails | chain_free_inventory | hard_client_sla | document_vault |
|---|---|---|---|---|---|---|---|---|
| `au` | false | off | off | off | off | off | off | off |
| `ew` | true | on | off | off | on | on | off | off |
| `au_uk` | true | on | on | on | off | off | off | off |
| `uk_au` | true | on | on | on | off | off | off | off |
| `us_uk` | true | on | on | on | off | off | off | off |
| `uk_us` | true | on | on | on | off | off | off | off |

---

### Task 1: Corridor domain helpers

**Files:**
- Create: `src/domain/market-packs/corridor.ts`
- Create: `tests/domain/corridor.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/domain/market-packs/corridor.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `EntryContext` from `src/domain/types.ts`; `MarketFlags`, `StageTemplate`, `StagePlaybook`, `isModuleEnabled` from `src/domain/market-packs/types.ts`.
- Produces: `CORRIDOR_INTENT_EVIDENCE` (`"corridor_intent"`), `CORRIDOR_DEPARTURE_EVIDENCE` (`"departure_plan"`), `CORRIDOR_VISA_EVIDENCE` (`"visa_status"`), `CorridorPlaybookCopy` (`{ originName: string; destinationName: string; currencyPair: string; visaLabel: string }`), `corridorProfileEvidence(flags: MarketFlags): string[]`, `corridorMoneyEvidence(entry: EntryContext, flags: MarketFlags): string[]`, `corridorMoveEvidence(entry: EntryContext, flags: MarketFlags): string[]`, `applyCorridorEvidence(stages: StageTemplate[], entry: EntryContext, flags: MarketFlags): StageTemplate[]`, `withCorridorPlaybookOverlay(playbooks: StagePlaybook[], entry: EntryContext, flags: MarketFlags, copy: CorridorPlaybookCopy): StagePlaybook[]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/corridor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { StagePlaybook, StageTemplate } from "../../src/domain/market-packs/types";
import {
  applyCorridorEvidence,
  CORRIDOR_DEPARTURE_EVIDENCE,
  CORRIDOR_INTENT_EVIDENCE,
  CORRIDOR_VISA_EVIDENCE,
  corridorMoneyEvidence,
  corridorMoveEvidence,
  corridorProfileEvidence,
  withCorridorPlaybookOverlay,
  type CorridorPlaybookCopy,
} from "../../src/domain/market-packs/corridor";

const CORRIDOR_ON = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
} as const;

const COPY: CorridorPlaybookCopy = {
  originName: "Originland",
  destinationName: "Destinationland",
  currencyPair: "AAA to BBB",
  visaLabel: "destination visa or right-to-reside",
};

function spine(): StageTemplate[] {
  return [
    {
      key: "purchase_profile",
      title: "Purchase profile",
      defaultOwnerRole: "CLIENT",
      slaDays: 3,
      requiredEvidenceKinds: ["profile_complete"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "money_readiness",
      title: "Money readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["source_of_funds"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: ["move_quote"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "offer_instruct",
      title: "Offer → instruct",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 5,
      requiredEvidenceKinds: ["conveyancer_instructed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
  ];
}

function playbooks(): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective: "Lock household constraints.",
      actions: [
        { day: 0, owner: "ADVISOR", action: "Run the profile call." },
        { day: 1, owner: "ADVISOR", action: "Write the budget band." },
      ],
      evidenceStandard: ["profile_complete: region, budget, decision-makers."],
      escalation: ["Day 3: call, do not email."],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective: "Prove the deposit.",
      actions: [
        { day: 0, owner: "ADVISOR", action: "Issue the source-of-funds list." },
        { day: 5, owner: "ADVISOR", action: "Review the pack." },
      ],
      evidenceStandard: ["source_of_funds: full-page statements."],
      escalation: ["Day 7: name the missing document."],
      partnerScript: null,
    },
    {
      stageKey: "move_logistics",
      objective: "Book the move.",
      actions: [
        { day: 0, owner: "ADVISOR", action: "Brief the move partner." },
        { day: 3, owner: "MOVE_PARTNER", action: "Return a written quote." },
      ],
      evidenceStandard: ["move_quote: written quote with a validity date."],
      escalation: ["Day 10: chase the partner."],
      partnerScript: null,
    },
  ];
}

describe("corridor evidence helpers", () => {
  it("adds corridor_intent only when a corridor flag is on", () => {
    expect(corridorProfileEvidence({})).toEqual(["profile_complete"]);
    expect(corridorProfileEvidence(CORRIDOR_ON)).toEqual([
      "profile_complete",
      CORRIDOR_INTENT_EVIDENCE,
    ]);
    expect(corridorProfileEvidence({ corridor_inbound: true })).toContain(
      CORRIDOR_INTENT_EVIDENCE,
    );
    expect(corridorProfileEvidence({ corridor_outbound: true })).toContain(
      CORRIDOR_INTENT_EVIDENCE,
    );
  });

  it("always requires fx_plan when fx_deposit is on, including UK_RESIDENT_SPEED", () => {
    expect(corridorMoneyEvidence("UK_RESIDENT_SPEED", CORRIDOR_ON)).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(corridorMoneyEvidence("RETURNER_OVERSEAS", CORRIDOR_ON)).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(corridorMoneyEvidence("RETURNER_OVERSEAS", {})).toEqual(["source_of_funds"]);
    expect(corridorMoneyEvidence("RETURNER_IN_UK", { fx_deposit: false })).toEqual([
      "source_of_funds",
    ]);
  });

  it("requires departure_plan on outbound packs and visa_status unless the household is a UK-resident speed-seeker", () => {
    expect(corridorMoveEvidence("RETURNER_OVERSEAS", CORRIDOR_ON)).toEqual([
      "move_quote",
      CORRIDOR_DEPARTURE_EVIDENCE,
      "vehicle_path",
      CORRIDOR_VISA_EVIDENCE,
    ]);
    expect(corridorMoveEvidence("RETURNER_IN_UK", CORRIDOR_ON)).toEqual([
      "move_quote",
      CORRIDOR_DEPARTURE_EVIDENCE,
      CORRIDOR_VISA_EVIDENCE,
    ]);
    expect(corridorMoveEvidence("UK_RESIDENT_SPEED", CORRIDOR_ON)).toEqual([
      "move_quote",
      CORRIDOR_DEPARTURE_EVIDENCE,
    ]);
    expect(corridorMoveEvidence("RETURNER_OVERSEAS", {})).toEqual(["move_quote"]);
  });
});

describe("applyCorridorEvidence", () => {
  it("rewrites only profile, money and move stages and leaves the legal spine untouched", () => {
    const next = applyCorridorEvidence(spine(), "RETURNER_OVERSEAS", CORRIDOR_ON);
    expect(next.map((s) => s.key)).toEqual([
      "purchase_profile",
      "money_readiness",
      "move_logistics",
      "offer_instruct",
    ]);
    expect(next[0]?.requiredEvidenceKinds).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);
    expect(next[1]?.requiredEvidenceKinds).toEqual(["source_of_funds", "fx_plan"]);
    expect(next[2]?.requiredEvidenceKinds).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
    expect(next[3]?.requiredEvidenceKinds).toEqual(["conveyancer_instructed"]);
  });
});

describe("withCorridorPlaybookOverlay", () => {
  it("injects corridor-specific actions and aligns evidenceStandard prefixes with required kinds", () => {
    const overlaid = withCorridorPlaybookOverlay(
      playbooks(),
      "RETURNER_OVERSEAS",
      CORRIDOR_ON,
      COPY,
    );
    const profile = overlaid.find((p) => p.stageKey === "purchase_profile");
    expect(profile?.objective).toMatch(/Originland/);
    expect(profile?.objective).toMatch(/Destinationland/);
    expect(profile?.actions.some((a) => /corridor_intent/i.test(a.action))).toBe(true);
    expect(profile?.evidenceStandard.map((line) => line.split(":")[0])).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);

    const money = overlaid.find((p) => p.stageKey === "money_readiness");
    expect(money?.actions.some((a) => /AAA to BBB/i.test(a.action))).toBe(true);
    expect(money?.evidenceStandard.map((line) => line.split(":")[0])).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);

    const move = overlaid.find((p) => p.stageKey === "move_logistics");
    expect(move?.actions.some((a) => /departure_plan/i.test(a.action))).toBe(true);
    expect(move?.actions.some((a) => /destination visa or right-to-reside/i.test(a.action))).toBe(
      true,
    );
    expect(move?.evidenceStandard.map((line) => line.split(":")[0])).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
  });

  it("does not invent seller introductions or completion-date guarantees", () => {
    const blob = JSON.stringify(
      withCorridorPlaybookOverlay(playbooks(), "RETURNER_OVERSEAS", CORRIDOR_ON, COPY),
    );
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/private listing/i);
    expect(blob).not.toMatch(/guaranteed completion/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/corridor.test.ts`

Expected: FAIL with `Cannot find module '../../src/domain/market-packs/corridor'`.

- [ ] **Step 3: Write the domain module**

Create `src/domain/market-packs/corridor.ts`:

```ts
import type { ActorRole, EntryContext } from "../types";
import {
  isModuleEnabled,
  type MarketFlags,
  type StagePlaybook,
  type StageTemplate,
} from "./types";

export const CORRIDOR_INTENT_EVIDENCE = "corridor_intent";
export const CORRIDOR_DEPARTURE_EVIDENCE = "departure_plan";
export const CORRIDOR_VISA_EVIDENCE = "visa_status";

export type CorridorPlaybookCopy = {
  originName: string;
  destinationName: string;
  currencyPair: string;
  visaLabel: string;
};

export function corridorProfileEvidence(flags: MarketFlags): string[] {
  const kinds = ["profile_complete"];
  if (
    isModuleEnabled(flags, "corridor_inbound") ||
    isModuleEnabled(flags, "corridor_outbound")
  ) {
    kinds.push(CORRIDOR_INTENT_EVIDENCE);
  }
  return kinds;
}

export function corridorMoneyEvidence(
  _entry: EntryContext,
  flags: MarketFlags,
): string[] {
  const kinds = ["source_of_funds"];
  if (isModuleEnabled(flags, "fx_deposit")) {
    kinds.push("fx_plan");
  }
  return kinds;
}

export function corridorMoveEvidence(
  entry: EntryContext,
  flags: MarketFlags,
): string[] {
  const kinds = ["move_quote"];
  if (isModuleEnabled(flags, "corridor_outbound")) {
    kinds.push(CORRIDOR_DEPARTURE_EVIDENCE);
    if (entry === "RETURNER_OVERSEAS") {
      kinds.push("vehicle_path");
    }
  }
  if (isModuleEnabled(flags, "corridor_inbound") && entry !== "UK_RESIDENT_SPEED") {
    kinds.push(CORRIDOR_VISA_EVIDENCE);
  }
  return kinds;
}

export function applyCorridorEvidence(
  stages: StageTemplate[],
  entry: EntryContext,
  flags: MarketFlags,
): StageTemplate[] {
  return stages.map((stage) => {
    if (stage.key === "purchase_profile") {
      return { ...stage, requiredEvidenceKinds: corridorProfileEvidence(flags) };
    }
    if (stage.key === "money_readiness") {
      return { ...stage, requiredEvidenceKinds: corridorMoneyEvidence(entry, flags) };
    }
    if (stage.key === "move_logistics") {
      return { ...stage, requiredEvidenceKinds: corridorMoveEvidence(entry, flags) };
    }
    return stage;
  });
}

function evidenceLine(
  kind: string,
  fallback: Record<string, string>,
  existing: string[],
): string {
  const fromExisting = existing.find((line) => line.startsWith(`${kind}:`));
  if (fromExisting) {
    return fromExisting;
  }
  const fromFallback = fallback[kind];
  if (!fromFallback) {
    throw new Error(`Missing corridor playbook evidence copy for ${kind}`);
  }
  return fromFallback;
}

function overlayProfilePlaybook(
  playbook: StagePlaybook,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook {
  const kinds = corridorProfileEvidence(flags);
  const extra: Array<{ day: number; owner: ActorRole; action: string }> = [];
  if (kinds.includes(CORRIDOR_INTENT_EVIDENCE)) {
    extra.push({
      day: 1,
      owner: "ADVISOR",
      action: `Record corridor_intent: the household is moving from ${copy.originName} to buy in ${copy.destinationName}, and name every person who will be on title.`,
    });
  }
  return {
    ...playbook,
    objective: `Lock household constraints for a ${copy.originName} → ${copy.destinationName} purchase: arrival window, target region, budget band, and who signs.`,
    actions: [...playbook.actions, ...extra],
    evidenceStandard: kinds.map((kind) =>
      evidenceLine(
        kind,
        {
          profile_complete:
            "profile_complete: target region named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
          corridor_intent: `corridor_intent: origin ${copy.originName}, destination ${copy.destinationName}, and the legal buyers named.`,
        },
        playbook.evidenceStandard,
      ),
    ),
  };
}

function overlayMoneyPlaybook(
  playbook: StagePlaybook,
  entry: EntryContext,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook {
  const kinds = corridorMoneyEvidence(entry, flags);
  const hasFxAction = playbook.actions.some((action) => /fx|transfer|currency/i.test(action.action));
  const extra: Array<{ day: number; owner: ActorRole; action: string }> = [];
  if (kinds.includes("fx_plan") && !hasFxAction) {
    extra.push({
      day: 2,
      owner: "ADVISOR",
      action: `Agree the FX plan for ${copy.currencyPair}: named transfer route, target settlement date, and the latest date funds must sit in a destination-currency account. The rate is not fixed by us.`,
    });
  }
  return {
    ...playbook,
    actions: [...playbook.actions, ...extra],
    evidenceStandard: kinds.map((kind) =>
      evidenceLine(
        kind,
        {
          source_of_funds:
            "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every large deposit explained.",
          fx_plan: `fx_plan: ${copy.currencyPair} transfer route named, target settlement date set, and the client understands the rate is not fixed by us.`,
        },
        playbook.evidenceStandard,
      ),
    ),
  };
}

function overlayMovePlaybook(
  playbook: StagePlaybook,
  entry: EntryContext,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook {
  const kinds = corridorMoveEvidence(entry, flags);
  const extra: Array<{ day: number; owner: ActorRole; action: string }> = [];
  if (kinds.includes(CORRIDOR_DEPARTURE_EVIDENCE)) {
    extra.push({
      day: 4,
      owner: "ADVISOR",
      action: `Submit departure_plan: what leaves ${copy.originName}, what is sold or stored, and the earliest and latest acceptable arrival dates in ${copy.destinationName}.`,
    });
  }
  if (kinds.includes("vehicle_path")) {
    extra.push({
      day: 4,
      owner: "ADVISOR",
      action:
        "Decide the vehicle path: ship, sell, or leave — and list the registration steps needed on arrival.",
    });
  }
  if (kinds.includes(CORRIDOR_VISA_EVIDENCE)) {
    extra.push({
      day: 5,
      owner: "ADVISOR",
      action: `Record visa_status: ${copy.visaLabel} for every adult buyer, including what is proven and what is still in progress.`,
    });
  }
  return {
    ...playbook,
    actions: [...playbook.actions, ...extra],
    evidenceStandard: kinds.map((kind) =>
      evidenceLine(
        kind,
        {
          move_quote:
            "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
          departure_plan: `departure_plan: goods that leave ${copy.originName}, goods sold or stored, and dated arrival window in ${copy.destinationName}.`,
          vehicle_path:
            "vehicle_path: decision recorded for each vehicle — ship, sell, or leave — with the registration steps listed.",
          visa_status: `visa_status: ${copy.visaLabel} recorded for every adult buyer, with outstanding applications named.`,
        },
        playbook.evidenceStandard,
      ),
    ),
  };
}

export function withCorridorPlaybookOverlay(
  playbooks: StagePlaybook[],
  entry: EntryContext,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook[] {
  return playbooks.map((playbook) => {
    if (playbook.stageKey === "purchase_profile") {
      return overlayProfilePlaybook(playbook, flags, copy);
    }
    if (playbook.stageKey === "money_readiness") {
      return overlayMoneyPlaybook(playbook, entry, flags, copy);
    }
    if (playbook.stageKey === "move_logistics") {
      return overlayMovePlaybook(playbook, entry, flags, copy);
    }
    return playbook;
  });
}
```

Add `"src/domain/market-packs/corridor.ts"` to `ENGINE_GLOBAL_FILES` in `tests/domain/engine-country-agnostic.test.ts` immediately after `"src/domain/chain-free.ts"`. Do not put `£`, `GBP`, `en-GB`, `england` or `wales` in `corridor.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/corridor.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/corridor.ts tests/domain/corridor.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: add country-agnostic corridor evidence and playbook helpers"
```

---

### Task 2: Australia → England & Wales pack (`au_uk`)

**Files:**
- Modify: `src/domain/market-packs/ew-stages.ts` — export `ewLegalSpine(entry, flags)`
- Modify: `src/domain/market-packs/ew-playbook.ts` — export `ewLegalPlaybooks(entry, flags)`
- Create: `src/domain/market-packs/au-uk-config.ts`
- Create: `src/domain/market-packs/au-uk-stages.ts`
- Create: `src/domain/market-packs/au-uk-playbook.ts`
- Create: `src/domain/market-packs/au-uk.ts`
- Modify: `src/domain/market-packs/registry.ts` — register `auUkMarketPack`
- Create: `tests/domain/au-uk-pack.test.ts`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-registry.test.ts`
- Modify: `tests/domain/ew-pack.test.ts` — only if `ewLegalSpine` changes the ew snapshot (it must not)

**Interfaces:**
- Consumes: `applyCorridorEvidence`, `withCorridorPlaybookOverlay`, `CorridorPlaybookCopy` from Task 1; `ewDisclosureText`; `ewPartnerMilestones`; `MarketPack` type.
- Produces: `ewLegalSpine(entry: EntryContext, flags?: MarketFlags): StageTemplate[]` — the nine E&W legal stages **without** `chain_free_matching`. `ewLegalPlaybooks(entry: EntryContext, flags?: MarketFlags): StagePlaybook[]` — matching playbooks **without** the chain-free insert. `AU_UK_FLAGS`, `AU_UK_CORRIDOR_COPY`, `auUkMarketPack` with `id: "au_uk"`, `enabled: true`, `jurisdiction: "england_wales"`. `ewStageTemplates` / `ewPlaybooks` keep today's behaviour (chain-free splice when the ew flag is on).

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/au-uk-pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { auUkMarketPack } from "../../src/domain/market-packs/au-uk";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import {
  getStageTemplate,
  isModuleEnabled,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("au_uk corridor pack", () => {
  it("is an enabled Australia → England & Wales destination pack", () => {
    expect(auUkMarketPack.id).toBe("au_uk");
    expect(auUkMarketPack.enabled).toBe(true);
    expect(auUkMarketPack.jurisdiction).toBe("england_wales");
    expect(auUkMarketPack.locale).toEqual(ewMarketPack.locale);
    expect(auUkMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(isModuleEnabled(auUkMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(auUkMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(auUkMarketPack.flags, "hard_client_sla")).toBe(false);
  });

  it("reuses the E&W legal spine without the chain-free overlay", () => {
    const stages = getStageTemplate(auUkMarketPack, "RETURNER_OVERSEAS");
    expect(stages.map((s) => s.key)).toEqual([
      "purchase_profile",
      "money_readiness",
      "mortgage_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "exchange_complete",
      "settle_light",
    ]);
    expect(stages.some((s) => s.key === "chain_free_matching")).toBe(false);
    expect(getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS").map((s) => s.key)).toContain(
      "chain_free_matching",
    );
  });

  it("requires corridor evidence on profile, money and move for an overseas household", () => {
    const stages = getStageTemplate(auUkMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "purchase_profile")?.requiredEvidenceKinds).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(stages.find((s) => s.key === "move_logistics")?.requiredEvidenceKinds).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
  });

  it("still requires FX for a UK-resident speed-seeker on this corridor", () => {
    const money = getStageTemplate(auUkMarketPack, "UK_RESIDENT_SPEED").find(
      (s) => s.key === "money_readiness",
    );
    expect(money?.requiredEvidenceKinds).toEqual(["source_of_funds", "fx_plan"]);
    const move = getStageTemplate(auUkMarketPack, "UK_RESIDENT_SPEED").find(
      (s) => s.key === "move_logistics",
    );
    expect(move?.requiredEvidenceKinds).toEqual(["move_quote", "departure_plan"]);
  });

  it("covers every stage with a real playbook and names the AU→E&W corridor in profile and move", () => {
    for (const entry of ["RETURNER_OVERSEAS", "RETURNER_IN_UK", "UK_RESIDENT_SPEED"] as const) {
      const keys = getStageTemplate(auUkMarketPack, entry).map((s) => s.key);
      expect(auUkMarketPack.buildPlaybooks(entry).map((p) => p.stageKey)).toEqual(keys);
      for (const key of keys) {
        expect(stagePlaybook(auUkMarketPack, key, entry)?.stageKey).toBe(key);
      }
    }
    const profile = stagePlaybook(auUkMarketPack, "purchase_profile", "RETURNER_OVERSEAS");
    expect(profile?.objective).toMatch(/Australia/);
    expect(profile?.actions.some((a) => /corridor_intent/i.test(a.action))).toBe(true);
    const move = stagePlaybook(auUkMarketPack, "move_logistics", "RETURNER_OVERSEAS");
    expect(move?.actions.some((a) => /departure_plan/i.test(a.action))).toBe(true);
    const blob = JSON.stringify(auUkMarketPack.buildPlaybooks("RETURNER_OVERSEAS"));
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/guaranteed completion/i);
  });

  it("reuses England & Wales disclosure and can back a live case", () => {
    const text = auUkMarketPack.disclosureText({
      role: "MORTGAGE_PARTNER",
      partnerName: "Priya Nair",
      partnerFirm: "Northstar Mortgages",
    });
    expect(text).toMatch(/introducer only/i);
    const created = createCase({
      id: "auuk1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      marketPackId: "au_uk",
    });
    expect(created.marketPackId).toBe("au_uk");
    expect(created.stages).toHaveLength(9);
    expect(created.stages[0]?.key).toBe("purchase_profile");
  });
});
```

In `tests/domain/market-pack-registry.test.ts` replace the list snapshot:

```ts
    expect(listMarketPacks().map((p) => [p.id, p.enabled])).toEqual([
      ["au", false],
      ["au_uk", true],
      ["ew", true],
    ]);
```

In `tests/domain/market-pack-flags.test.ts` replace the gated list and the FX-only test. The file must read:

```ts
/** Spec §9: hard SLAs and the vault stay unsold. Corridor flags are on for corridor packs only. */
const GATED_MODULES = ["hard_client_sla", "document_vault"] as const;
```

Replace `enables FX for the deposit in England & Wales only` with:

```ts
  it("enables FX on the beachhead pack and on every registered corridor pack", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "fx_deposit"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["au_uk", "ew"]);
  });

  it("turns corridor modules on only for registered corridor packs", () => {
    const inbound = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "corridor_inbound"))
      .map((pack) => pack.id);
    const outbound = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "corridor_outbound"))
      .map((pack) => pack.id);
    expect(inbound).toEqual(["au_uk"]);
    expect(outbound).toEqual(["au_uk"]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "ew")!.flags, "corridor_inbound")).toBe(
      false,
    );
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "corridor_outbound")).toBe(
      false,
    );
  });
```

Keep the existing `partner_speed_rails` and `chain_free_inventory` ew-only tests unchanged — they must still pass because `au_uk` leaves those flags off.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/au-uk-pack.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-flags.test.ts`

Expected: FAIL — `au-uk` module missing; registry still lists only `au` and `ew`.

- [ ] **Step 3: Extract the E&W legal spine and assemble `au_uk`**

In `src/domain/market-packs/ew-stages.ts` rename the current nine-object builder to `ewLegalSpine` and keep the chain-free splice on `ewStageTemplates`:

```ts
/** Nine-stage England & Wales legal spine. No chain-free overlay. */
export function ewLegalSpine(
  entry: EntryContext,
  flags: MarketFlags = EW_FLAGS,
): StageTemplate[] {
  return [
    {
      key: "purchase_profile",
      title: "Purchase profile",
      defaultOwnerRole: "CLIENT",
      slaDays: 3,
      requiredEvidenceKinds: ["profile_complete"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "money_readiness",
      title: "Money readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: moneyEvidenceKinds(entry, flags),
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "mortgage_path",
      title: "Mortgage path",
      defaultOwnerRole: "MORTGAGE_PARTNER",
      slaDays: 14,
      requiredEvidenceKinds: ["dip_aip"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: moveEvidenceKinds(entry),
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "search_readiness",
      title: "Search readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["buyer_ready"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "offer_instruct",
      title: "Offer → instruct",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 5,
      requiredEvidenceKinds: ["conveyancer_instructed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "diligence",
      title: "Diligence",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 21,
      requiredEvidenceKinds: ["searches_complete"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "exchange_complete",
      title: "Exchange → complete",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 14,
      requiredEvidenceKinds: ["completion_confirmed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "settle_light",
      title: "Settle (light)",
      defaultOwnerRole: "CLIENT",
      slaDays: 14,
      requiredEvidenceKinds: [],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
  ];
}

export function ewStageTemplates(entry: EntryContext): StageTemplate[] {
  const stages = ewLegalSpine(entry, EW_FLAGS);
  if (!isModuleEnabled(EW_FLAGS, "chain_free_inventory")) {
    return stages;
  }
  const insertAt = stages.findIndex((stage) => stage.key === "offer_instruct");
  return [
    ...stages.slice(0, insertAt),
    chainFreeMatchingTemplate(),
    ...stages.slice(insertAt),
  ];
}
```

In `src/domain/market-packs/ew-playbook.ts` change `needsCurrencyWork` to take flags, extract `ewLegalPlaybooks`, and keep the chain-free splice on `ewPlaybooks`:

```ts
function needsCurrencyWork(entry: EntryContext, flags: MarketFlags): boolean {
  return moneyEvidenceKinds(entry, flags).includes("fx_plan");
}

export function ewLegalPlaybooks(
  entry: EntryContext,
  flags: MarketFlags = EW_FLAGS,
): StagePlaybook[] {
  // Move the existing nine-playbook array here unchanged, except:
  // - needsCurrencyWork(entry) becomes needsCurrencyWork(entry, flags)
  // - moneyEvidenceKinds(entry, EW_FLAGS) becomes moneyEvidenceKinds(entry, flags)
  // Do not include chainFreeMatchingPlaybook in this array.
}

export function ewPlaybooks(entry: EntryContext): StagePlaybook[] {
  const playbooks = ewLegalPlaybooks(entry, EW_FLAGS);
  if (!isModuleEnabled(EW_FLAGS, "chain_free_inventory")) {
    return playbooks;
  }
  const insertAt = playbooks.findIndex((playbook) => playbook.stageKey === "offer_instruct");
  return [
    ...playbooks.slice(0, insertAt),
    chainFreeMatchingPlaybook(),
    ...playbooks.slice(insertAt),
  ];
}
```

Add `MarketFlags` to the `./types` import. Do not rewrite playbook prose. Existing `tests/domain/ew-pack.test.ts` and `tests/domain/ew-playbook.test.ts` must stay green.

Create `src/domain/market-packs/au-uk-config.ts`:

```ts
import type { MarketCopy, MarketFlags } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";
import { EW_COPY, EW_LOCALE, EW_PARTNER_ROLE_LABELS } from "./ew-config";

export { EW_LOCALE as AU_UK_LOCALE, EW_PARTNER_ROLE_LABELS as AU_UK_PARTNER_ROLE_LABELS };

export const AU_UK_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
};

export const AU_UK_COPY: MarketCopy = {
  ...EW_COPY,
  jurisdiction_scope:
    "We orchestrate Australia → England & Wales purchases. Scotland and Northern Ireland are not covered. This is not a domestic Australia product.",
  region_prompt: "Where in England & Wales are you buying on the way home from Australia?",
  directory_intro:
    "Our curated England & Wales panel for households buying from Australia. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const AU_UK_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "Australia",
  destinationName: "England & Wales",
  currencyPair: "AUD to GBP",
  visaLabel: "UK visa, settled status, or other right-to-reside",
};
```

Create `src/domain/market-packs/au-uk-stages.ts`:

```ts
import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { AU_UK_FLAGS } from "./au-uk-config";
import { ewLegalSpine } from "./ew-stages";
import type { StageTemplate } from "./types";

export function auUkStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(ewLegalSpine(entry, AU_UK_FLAGS), entry, AU_UK_FLAGS);
}
```

Create `src/domain/market-packs/au-uk-playbook.ts`:

```ts
import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { AU_UK_CORRIDOR_COPY, AU_UK_FLAGS } from "./au-uk-config";
import { ewLegalPlaybooks } from "./ew-playbook";
import type { StagePlaybook } from "./types";

export function auUkPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ewLegalPlaybooks(entry, AU_UK_FLAGS),
    entry,
    AU_UK_FLAGS,
    AU_UK_CORRIDOR_COPY,
  );
}

export function auUkStagePlaybook(
  stageKey: string,
  entry: EntryContext,
): StagePlaybook | null {
  return auUkPlaybooks(entry).find((playbook) => playbook.stageKey === stageKey) ?? null;
}
```

Create `src/domain/market-packs/au-uk.ts`:

```ts
import {
  AU_UK_COPY,
  AU_UK_FLAGS,
  AU_UK_LOCALE,
  AU_UK_PARTNER_ROLE_LABELS,
} from "./au-uk-config";
import { auUkPlaybooks } from "./au-uk-playbook";
import { auUkStageTemplates } from "./au-uk-stages";
import { ewDisclosureText } from "./ew-disclosure";
import { ewPartnerMilestones } from "./ew-milestones";
import type { MarketPack } from "./types";

export const auUkMarketPack: MarketPack = {
  id: "au_uk",
  name: "Australia → England & Wales",
  jurisdiction: "england_wales",
  enabled: true,
  locale: AU_UK_LOCALE,
  flags: AU_UK_FLAGS,
  copy: AU_UK_COPY,
  partnerRoleLabels: AU_UK_PARTNER_ROLE_LABELS,
  buildStages: auUkStageTemplates,
  buildPlaybooks: auUkPlaybooks,
  partnerMilestones: ewPartnerMilestones,
  disclosureText: ewDisclosureText,
};
```

In `src/domain/market-packs/registry.ts`:

```ts
import { auStubPack } from "./au-stub";
import { auUkMarketPack } from "./au-uk";
import { ewMarketPack } from "./ew";
import { MarketPackError, type MarketPack } from "./types";

export const DEFAULT_MARKET_PACK_ID = "ew";

const PACKS: readonly MarketPack[] = [ewMarketPack, auStubPack, auUkMarketPack];
```

Leave `listMarketPacks` / `resolveMarketPack` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/au-uk-pack.test.ts tests/domain/ew-pack.test.ts tests/domain/ew-playbook.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-flags.test.ts tests/domain/corridor.test.ts`

Expected: PASS. `ew` still has ten stages including `chain_free_matching`. `au_uk` has nine. `createCase({ marketPackId: "au_uk" })` succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/ew-stages.ts src/domain/market-packs/ew-playbook.ts src/domain/market-packs/au-uk-config.ts src/domain/market-packs/au-uk-stages.ts src/domain/market-packs/au-uk-playbook.ts src/domain/market-packs/au-uk.ts src/domain/market-packs/registry.ts tests/domain/au-uk-pack.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts
git commit -m "feat: enable the Australia to England and Wales corridor pack"
```

---

### Task 3: United States → England & Wales pack (`us_uk`)

**Files:**
- Create: `src/domain/market-packs/us-uk-config.ts`
- Create: `src/domain/market-packs/us-uk-stages.ts`
- Create: `src/domain/market-packs/us-uk-playbook.ts`
- Create: `src/domain/market-packs/us-uk.ts`
- Modify: `src/domain/market-packs/registry.ts` — add `usUkMarketPack` to `PACKS`
- Create: `tests/domain/us-uk-pack.test.ts`
- Modify: `tests/domain/market-pack-flags.test.ts` — extend FX and corridor id lists
- Modify: `tests/domain/market-pack-registry.test.ts` — extend the sorted list

**Interfaces:**
- Consumes: `ewLegalSpine`, `ewLegalPlaybooks`, `applyCorridorEvidence`, `withCorridorPlaybookOverlay`, `ewDisclosureText`, `ewPartnerMilestones`.
- Produces: `US_UK_FLAGS` (same three flags as `AU_UK_FLAGS`), `US_UK_CORRIDOR_COPY`, `usUkMarketPack` with `id: "us_uk"`, `enabled: true`, `jurisdiction: "england_wales"`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/us-uk-pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { usUkMarketPack } from "../../src/domain/market-packs/us-uk";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import {
  getStageTemplate,
  isModuleEnabled,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("us_uk corridor pack", () => {
  it("is an enabled United States → England & Wales destination pack", () => {
    expect(usUkMarketPack.id).toBe("us_uk");
    expect(usUkMarketPack.enabled).toBe(true);
    expect(usUkMarketPack.jurisdiction).toBe("england_wales");
    expect(usUkMarketPack.locale).toEqual(ewMarketPack.locale);
    expect(usUkMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(isModuleEnabled(usUkMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(usUkMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(usUkMarketPack.flags, "hard_client_sla")).toBe(false);
  });

  it("reuses the E&W legal spine without the chain-free overlay", () => {
    expect(getStageTemplate(usUkMarketPack, "RETURNER_OVERSEAS").map((s) => s.key)).toEqual([
      "purchase_profile",
      "money_readiness",
      "mortgage_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "exchange_complete",
      "settle_light",
    ]);
  });

  it("requires USD→GBP FX and US departure evidence for an overseas household", () => {
    const stages = getStageTemplate(usUkMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(stages.find((s) => s.key === "move_logistics")?.requiredEvidenceKinds).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
  });

  it("names the US→E&W corridor in profile and move playbooks", () => {
    const profile = stagePlaybook(usUkMarketPack, "purchase_profile", "RETURNER_OVERSEAS");
    expect(profile?.objective).toMatch(/United States/);
    expect(profile?.actions.some((a) => /corridor_intent/i.test(a.action))).toBe(true);
    const money = stagePlaybook(usUkMarketPack, "money_readiness", "UK_RESIDENT_SPEED");
    expect(money?.actions.some((a) => /USD to GBP/i.test(a.action))).toBe(true);
    const keys = getStageTemplate(usUkMarketPack, "RETURNER_IN_UK").map((s) => s.key);
    expect(usUkMarketPack.buildPlaybooks("RETURNER_IN_UK").map((p) => p.stageKey)).toEqual(keys);
  });

  it("can back a live case on the existing engine", () => {
    const created = createCase({
      id: "usuk1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      marketPackId: "us_uk",
    });
    expect(created.marketPackId).toBe("us_uk");
    expect(created.stages.some((s) => s.key === "mortgage_path")).toBe(true);
    expect(created.stages.some((s) => s.key === "chain_free_matching")).toBe(false);
  });
});
```

In `tests/domain/market-pack-registry.test.ts` replace the list snapshot:

```ts
    expect(listMarketPacks().map((p) => [p.id, p.enabled])).toEqual([
      ["au", false],
      ["au_uk", true],
      ["ew", true],
      ["us_uk", true],
    ]);
```

In `tests/domain/market-pack-flags.test.ts` replace the two expected arrays:

```ts
    expect(enabled).toEqual(["au_uk", "ew", "us_uk"]);
```

and

```ts
    expect(inbound).toEqual(["au_uk", "us_uk"]);
    expect(outbound).toEqual(["au_uk", "us_uk"]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/us-uk-pack.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-flags.test.ts`

Expected: FAIL — `us-uk` module missing.

- [ ] **Step 3: Assemble `us_uk`**

Create `src/domain/market-packs/us-uk-config.ts`:

```ts
import type { MarketCopy, MarketFlags } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";
import { EW_COPY, EW_LOCALE, EW_PARTNER_ROLE_LABELS } from "./ew-config";

export { EW_LOCALE as US_UK_LOCALE, EW_PARTNER_ROLE_LABELS as US_UK_PARTNER_ROLE_LABELS };

export const US_UK_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
};

export const US_UK_COPY: MarketCopy = {
  ...EW_COPY,
  jurisdiction_scope:
    "We orchestrate United States → England & Wales purchases. Scotland and Northern Ireland are not covered. This is not a domestic United States product.",
  region_prompt: "Where in England & Wales are you buying on the way home from the United States?",
  directory_intro:
    "Our curated England & Wales panel for households buying from the United States. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const US_UK_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "the United States",
  destinationName: "England & Wales",
  currencyPair: "USD to GBP",
  visaLabel: "UK visa, settled status, or other right-to-reside",
};
```

Create `src/domain/market-packs/us-uk-stages.ts`:

```ts
import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { ewLegalSpine } from "./ew-stages";
import { US_UK_FLAGS } from "./us-uk-config";
import type { StageTemplate } from "./types";

export function usUkStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(ewLegalSpine(entry, US_UK_FLAGS), entry, US_UK_FLAGS);
}
```

Create `src/domain/market-packs/us-uk-playbook.ts`:

```ts
import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { ewLegalPlaybooks } from "./ew-playbook";
import type { StagePlaybook } from "./types";
import { US_UK_CORRIDOR_COPY, US_UK_FLAGS } from "./us-uk-config";

export function usUkPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ewLegalPlaybooks(entry, US_UK_FLAGS),
    entry,
    US_UK_FLAGS,
    US_UK_CORRIDOR_COPY,
  );
}
```

Create `src/domain/market-packs/us-uk.ts`:

```ts
import { ewDisclosureText } from "./ew-disclosure";
import { ewPartnerMilestones } from "./ew-milestones";
import type { MarketPack } from "./types";
import {
  US_UK_COPY,
  US_UK_FLAGS,
  US_UK_LOCALE,
  US_UK_PARTNER_ROLE_LABELS,
} from "./us-uk-config";
import { usUkPlaybooks } from "./us-uk-playbook";
import { usUkStageTemplates } from "./us-uk-stages";

export const usUkMarketPack: MarketPack = {
  id: "us_uk",
  name: "United States → England & Wales",
  jurisdiction: "england_wales",
  enabled: true,
  locale: US_UK_LOCALE,
  flags: US_UK_FLAGS,
  copy: US_UK_COPY,
  partnerRoleLabels: US_UK_PARTNER_ROLE_LABELS,
  buildStages: usUkStageTemplates,
  buildPlaybooks: usUkPlaybooks,
  partnerMilestones: ewPartnerMilestones,
  disclosureText: ewDisclosureText,
};
```

In `src/domain/market-packs/registry.ts` add the import and append `usUkMarketPack` to `PACKS`:

```ts
import { usUkMarketPack } from "./us-uk";

const PACKS: readonly MarketPack[] = [
  ewMarketPack,
  auStubPack,
  auUkMarketPack,
  usUkMarketPack,
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/us-uk-pack.test.ts tests/domain/au-uk-pack.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/us-uk-config.ts src/domain/market-packs/us-uk-stages.ts src/domain/market-packs/us-uk-playbook.ts src/domain/market-packs/us-uk.ts src/domain/market-packs/registry.ts tests/domain/us-uk-pack.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts
git commit -m "feat: enable the United States to England and Wales corridor pack"
```

---

### Task 4: United Kingdom → Australia pack (`uk_au`)

**Files:**
- Create: `src/domain/market-packs/au-disclosure.ts`
- Create: `src/domain/market-packs/au-milestones.ts`
- Create: `src/domain/market-packs/uk-au-config.ts`
- Create: `src/domain/market-packs/uk-au-stages.ts`
- Create: `src/domain/market-packs/uk-au-playbook.ts`
- Create: `src/domain/market-packs/uk-au.ts`
- Modify: `src/domain/market-packs/au-stub.ts` — comment only; pack stays disabled
- Modify: `src/domain/market-packs/registry.ts` — add `ukAuMarketPack`
- Create: `tests/domain/uk-au-pack.test.ts`
- Create: `tests/domain/au-disclosure.test.ts`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-registry.test.ts`

**Interfaces:**
- Consumes: `applyCorridorEvidence`, `withCorridorPlaybookOverlay`, `DisclosureInput`, `isPartnerActorRole`.
- Produces: `auDisclosureText(input: DisclosureInput): string`, `auPartnerMilestones(role: ActorRole): PartnerMilestone[]`, `UK_AU_FLAGS` (same three corridor flags), `ukAuMarketPack` with `id: "uk_au"`, `enabled: true`, `jurisdiction: "australia"`, locale `en-AU` / `AUD`, stage keys `finance_path` and `settlement_complete`. The `au` stub remains `enabled: false` with empty playbooks.

AU spine keys (same as the stub, real content):

```
purchase_profile, money_readiness, finance_path, move_logistics,
search_readiness, offer_instruct, diligence, settlement_complete, settle_light
```

AU evidence kinds: `finance_path` → `pre_approval`; `offer_instruct` → `conveyancer_instructed`; `diligence` → `searches_complete`; `settlement_complete` → `settlement_confirmed`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/au-disclosure.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { auDisclosureText } from "../../src/domain/market-packs/au-disclosure";

describe("Australia destination disclosure", () => {
  it("states introducer-only and no credit advice for mortgage brokers", () => {
    const text = auDisclosureText({
      role: "MORTGAGE_PARTNER",
      partnerName: "Mia Chen",
      partnerFirm: "Harbour Brokers",
    });
    expect(text).toContain("Mia Chen (Harbour Brokers)");
    expect(text).toMatch(/introducer only/i);
    expect(text).toMatch(/do not give credit assistance or mortgage advice/i);
    expect(text).toMatch(/free to use any mortgage broker/i);
  });

  it("discloses a referral fee for conveyancers and commission for removalists", () => {
    expect(
      auDisclosureText({
        role: "CONVEYANCER",
        partnerName: "Owen Blake",
        partnerFirm: null,
      }),
    ).toMatch(/free to instruct any conveyancer or solicitor/i);
    expect(
      auDisclosureText({
        role: "MOVE_PARTNER",
        partnerName: "Sam Reid",
        partnerFirm: "Southern Cross Removalists",
      }),
    ).toMatch(/free to use any removalist/i);
  });

  it("refuses client and advisor roles", () => {
    expect(() =>
      auDisclosureText({ role: "CLIENT", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles only/i);
  });
});
```

Create `tests/domain/uk-au-pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { ukAuMarketPack } from "../../src/domain/market-packs/uk-au";
import {
  getStageTemplate,
  isModuleEnabled,
  packEvidenceKinds,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("uk_au corridor pack", () => {
  it("is the live UK → Australia product; the au stub stays disabled", () => {
    expect(ukAuMarketPack.id).toBe("uk_au");
    expect(ukAuMarketPack.enabled).toBe(true);
    expect(ukAuMarketPack.jurisdiction).toBe("australia");
    expect(ukAuMarketPack.locale).toEqual({
      bcp47: "en-AU",
      currencyCode: "AUD",
      addressFieldKeys: ["line1", "line2", "suburb", "state", "postcode"],
      regionNoun: "state",
    });
    expect(ukAuMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(auStubPack.enabled).toBe(false);
    expect(packEvidenceKinds(auStubPack)).toEqual([]);
    expect(isModuleEnabled(ukAuMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(ukAuMarketPack.flags, "partner_speed_rails")).toBe(false);
  });

  it("uses the AU legal spine, not mortgage_path or exchange_complete", () => {
    const keys = getStageTemplate(ukAuMarketPack, "RETURNER_OVERSEAS").map((s) => s.key);
    expect(keys).toEqual([
      "purchase_profile",
      "money_readiness",
      "finance_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "settlement_complete",
      "settle_light",
    ]);
    expect(keys).not.toContain("mortgage_path");
    expect(keys).not.toContain("exchange_complete");
    expect(keys).not.toContain("chain_free_matching");
  });

  it("uses AU evidence kinds and corridor overlays", () => {
    const stages = getStageTemplate(ukAuMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "finance_path")).toMatchObject({
      title: "Finance path",
      requiredEvidenceKinds: ["pre_approval"],
      defaultOwnerRole: "MORTGAGE_PARTNER",
    });
    expect(stages.find((s) => s.key === "settlement_complete")).toMatchObject({
      title: "Settlement → complete",
      requiredEvidenceKinds: ["settlement_confirmed"],
    });
    expect(stages.find((s) => s.key === "purchase_profile")?.requiredEvidenceKinds).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
  });

  it("ships real playbooks and AU partner labels", () => {
    expect(ukAuMarketPack.partnerRoleLabels.MORTGAGE_PARTNER).toBe("mortgage broker");
    expect(ukAuMarketPack.partnerRoleLabels.MOVE_PARTNER).toBe("removalist");
    const finance = stagePlaybook(ukAuMarketPack, "finance_path", "UK_RESIDENT_SPEED");
    expect(finance?.objective.length).toBeGreaterThan(20);
    expect(finance?.actions.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(finance)).toMatch(/pre_approval/);
    expect(JSON.stringify(finance)).not.toMatch(/dip_aip/);
    const keys = getStageTemplate(ukAuMarketPack, "RETURNER_IN_UK").map((s) => s.key);
    expect(ukAuMarketPack.buildPlaybooks("RETURNER_IN_UK").map((p) => p.stageKey)).toEqual(keys);
    const blob = JSON.stringify(ukAuMarketPack.buildPlaybooks("RETURNER_OVERSEAS"));
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
  });

  it("uses Australian disclosure and can back a live case", () => {
    expect(
      ukAuMarketPack.disclosureText({
        role: "MORTGAGE_PARTNER",
        partnerName: "Mia Chen",
        partnerFirm: "Harbour Brokers",
      }),
    ).toMatch(/credit assistance/i);
    const created = createCase({
      id: "ukau1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      marketPackId: "uk_au",
    });
    expect(created.stages.some((s) => s.key === "finance_path")).toBe(true);
    expect(created.stages.some((s) => s.key === "settlement_complete")).toBe(true);
  });
});
```

In `tests/domain/market-pack-registry.test.ts`:

```ts
    expect(listMarketPacks().map((p) => [p.id, p.enabled])).toEqual([
      ["au", false],
      ["au_uk", true],
      ["ew", true],
      ["uk_au", true],
      ["us_uk", true],
    ]);
```

In `tests/domain/market-pack-flags.test.ts`:

```ts
    expect(enabled).toEqual(["au_uk", "ew", "uk_au", "us_uk"]);
    expect(inbound).toEqual(["au_uk", "uk_au", "us_uk"]);
    expect(outbound).toEqual(["au_uk", "uk_au", "us_uk"]);
```

Keep the existing `au stub pack` tests in `market-pack-registry.test.ts` unchanged — the stub must still refuse to run.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/uk-au-pack.test.ts tests/domain/au-disclosure.test.ts tests/domain/market-pack-registry.test.ts`

Expected: FAIL — `uk-au` and `au-disclosure` modules missing.

- [ ] **Step 3: Write AU destination law and the `uk_au` pack**

Create `src/domain/market-packs/au-disclosure.ts`:

```ts
import type { DisclosureInput } from "./types";

function displayName(partnerName: string, partnerFirm: string | null): string {
  return partnerFirm ? `${partnerName} (${partnerFirm})` : partnerName;
}

export function auDisclosureText(input: DisclosureInput): string {
  const who = displayName(input.partnerName, input.partnerFirm);
  switch (input.role) {
    case "MORTGAGE_PARTNER":
      return `Property Concierge introduced you to ${who}. We act as an introducer only and do not give credit assistance or mortgage advice. We may receive an introducer fee from ${who} if you take a loan through them. You are free to use any mortgage broker.`;
    case "CONVEYANCER":
      return `Property Concierge referred you to ${who}. We may receive a referral fee from ${who} if you instruct them. You are free to instruct any conveyancer or solicitor.`;
    case "MOVE_PARTNER":
      return `Property Concierge referred you to ${who}. We may receive a commission from ${who} if you book with them. You are free to use any removalist or relocation provider.`;
    default:
      throw new Error("Disclosure text applies to partner roles only");
  }
}
```

Create `src/domain/market-packs/au-milestones.ts`:

```ts
import { isPartnerActorRole, type ActorRole } from "../types";
import type { PartnerMilestone } from "./types";

const AU_MILESTONES: Record<string, Array<[string, string]>> = {
  MORTGAGE_PARTNER: [
    ["fact_find_booked", "Fact find booked"],
    ["pre_approval_submitted", "Pre-approval submitted"],
    ["lender_decision", "Lender decision received"],
  ],
  CONVEYANCER: [
    ["client_care_sent", "Client care pack sent"],
    ["contract_reviewed", "Contract reviewed"],
    ["searches_ordered", "Searches ordered"],
    ["settlement_booked", "Settlement booked"],
  ],
  MOVE_PARTNER: [
    ["survey_booked", "Pre-move survey booked"],
    ["quote_issued", "Move quote issued"],
    ["date_held", "Move date provisionally held"],
  ],
};

export function auPartnerMilestones(role: ActorRole): PartnerMilestone[] {
  if (!isPartnerActorRole(role)) {
    return [];
  }
  return (AU_MILESTONES[role] ?? []).map(([key, label]) => ({ key, label, role }));
}
```

Create `src/domain/market-packs/uk-au-config.ts`:

```ts
import type { MarketCopy, MarketFlags, MarketLocale, PartnerRoleLabels } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";

export const UK_AU_LOCALE: MarketLocale = {
  bcp47: "en-AU",
  currencyCode: "AUD",
  addressFieldKeys: ["line1", "line2", "suburb", "state", "postcode"],
  regionNoun: "state",
};

export const UK_AU_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
};

export const UK_AU_COPY: MarketCopy = {
  jurisdiction_scope:
    "We orchestrate United Kingdom → Australia purchases. State land-title rules are local. This is not a domestic Australia-only product and it does not enable the disabled au stub.",
  mortgage_posture:
    "We introduce you to a mortgage broker. We are an introducer only and do not give credit assistance or mortgage advice.",
  region_prompt: "Which Australian state are you buying in?",
  directory_intro:
    "Our curated Australia panel for households buying from the United Kingdom. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const UK_AU_PARTNER_ROLE_LABELS: PartnerRoleLabels = {
  CLIENT: "household",
  ADVISOR: "advisor",
  MORTGAGE_PARTNER: "mortgage broker",
  CONVEYANCER: "conveyancer",
  MOVE_PARTNER: "removalist",
};

export const UK_AU_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "the United Kingdom",
  destinationName: "Australia",
  currencyPair: "GBP to AUD",
  visaLabel: "Australian visa or right-to-reside",
};
```

Create `src/domain/market-packs/uk-au-stages.ts`:

```ts
import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { UK_AU_FLAGS } from "./uk-au-config";
import type { StageTemplate } from "./types";

function auLegalSpine(): StageTemplate[] {
  return [
    {
      key: "purchase_profile",
      title: "Purchase profile",
      defaultOwnerRole: "CLIENT",
      slaDays: 3,
      requiredEvidenceKinds: ["profile_complete"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "money_readiness",
      title: "Money readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["source_of_funds"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "finance_path",
      title: "Finance path",
      defaultOwnerRole: "MORTGAGE_PARTNER",
      slaDays: 14,
      requiredEvidenceKinds: ["pre_approval"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: ["move_quote"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "search_readiness",
      title: "Search readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["buyer_ready"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "offer_instruct",
      title: "Offer → instruct",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 5,
      requiredEvidenceKinds: ["conveyancer_instructed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "diligence",
      title: "Diligence",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 21,
      requiredEvidenceKinds: ["searches_complete"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "settlement_complete",
      title: "Settlement → complete",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 14,
      requiredEvidenceKinds: ["settlement_confirmed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "settle_light",
      title: "Settle (light)",
      defaultOwnerRole: "CLIENT",
      slaDays: 14,
      requiredEvidenceKinds: [],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
  ];
}

export function ukAuStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(auLegalSpine(), entry, UK_AU_FLAGS);
}
```

Create `src/domain/market-packs/uk-au-playbook.ts`:

```ts
import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { UK_AU_CORRIDOR_COPY, UK_AU_FLAGS } from "./uk-au-config";
import type { StagePlaybook } from "./types";

function ukAuLegalPlaybooks(): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective:
        "Lock the household constraints that every later Australian stage is planned against: arrival window, target state, budget band, and who signs.",
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
            "Sanity-check the stated budget band against the target state; flag it now if the two do not meet.",
        },
      ],
      evidenceStandard: [
        "profile_complete: target state named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
      ],
      escalation: [
        "Day 3: no profile call booked — advisor calls, does not email.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective:
        "Get the deposit provable and movable into Australian dollars before anyone inspects a property.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Issue the source-of-funds list: statements covering six months, evidence of any gift, and the account the deposit will settle from.",
        },
        {
          day: 5,
          owner: "ADVISOR",
          action:
            "Review the pack against the standard below and reject anything a lender or conveyancer would bounce — once, properly, not twice.",
        },
      ],
      evidenceStandard: [
        "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every large deposit explained.",
      ],
      escalation: [
        "Day 7 (SLA): pack incomplete — advisor calls the client and names the single missing document.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "finance_path",
      objective:
        "Hand a clean, pre-briefed case to the Australian mortgage broker and hold them to a written pre-approval without giving credit assistance ourselves.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Send the warm intro with the profile summary, income shape, deposit position and target settlement window attached.",
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
            "Chase the lender pack if no pre-approval has landed; ask for the specific blocking item, not a status update.",
        },
      ],
      evidenceStandard: [
        "pre_approval: written pre-approval naming the lender, the amount, and its expiry date.",
      ],
      escalation: [
        "Day 14 (SLA): no pre-approval — advisor calls the broker and sets a 48-hour deadline in the thread.",
      ],
      partnerScript:
        "Introducer framing: 'We do not advise on the loan. We are handing you a prepared buyer and we will hold the timeline. Confirm the pre-approval or the blocking item by <date>.'",
    },
    {
      stageKey: "move_logistics",
      objective:
        "Turn the UK→Australia move into a booked, priced plan sequenced against settlement, not against the first free shipping date.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Brief the removalist with volume, UK origin, destination state and the earliest and latest acceptable arrival dates.",
        },
        {
          day: 3,
          owner: "MOVE_PARTNER",
          action:
            "Return a written quote covering packing, transit, storage rate and the cancellation terms.",
        },
      ],
      evidenceStandard: [
        "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
      ],
      escalation: [
        "Day 10 (SLA): no quote — advisor chases the partner directly and offers the second panel member.",
      ],
      partnerScript:
        "'This household has a settlement window we control. Quote to the window, include storage, and tell us your cut-off for booking.'",
    },
    {
      stageKey: "search_readiness",
      objective:
        "Make the household credible to Australian agents on day one: proven funds, a pre-approval, and a written must-have list.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Write the buyer-ready one-pager: budget band, lender, deposit proven, timeline, and who to contact.",
        },
        {
          day: 2,
          owner: "CLIENT",
          action:
            "Agree the must-have versus nice-to-have split so offers are not re-litigated later in the family.",
        },
      ],
      evidenceStandard: [
        "buyer_ready: one-pager exists, pre-approval is unexpired, deposit evidence accepted, and must-haves are written down.",
      ],
      escalation: [
        "Day 7 (SLA): must-haves still unresolved — advisor runs a decision call rather than waiting for consensus.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "offer_instruct",
      objective:
        "Convert an accepted offer into an instructed Australian conveyancer with ID and AML cleared, in days rather than weeks.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Warm-intro the conveyancer the same day the offer is accepted; do not wait for the agent's contract pack.",
        },
        {
          day: 1,
          owner: "CONVEYANCER",
          action:
            "Issue the client care pack and the ID/AML request, and confirm in the thread when it was sent.",
        },
      ],
      evidenceStandard: [
        "conveyancer_instructed: client care pack signed, ID/AML cleared, and the firm has confirmed it is on the record.",
      ],
      escalation: [
        "Day 5 (SLA): not instructed — advisor calls the firm and the agent on the same day.",
      ],
      partnerScript:
        "'Offer accepted on <date>. We hold the timeline and the client is document-ready. Confirm instruction and your contract review date.'",
    },
    {
      stageKey: "diligence",
      objective:
        "Keep contract review, searches, building inspection and valuation moving in parallel and surface defects while there is still time to price them.",
      actions: [
        {
          day: 0,
          owner: "CONVEYANCER",
          action:
            "Review the contract on day one of instruction and state cooling-off and special-condition dates in the thread.",
        },
        {
          day: 2,
          owner: "ADVISOR",
          action:
            "Book the building and pest inspection in parallel with searches; never sequence them.",
        },
      ],
      evidenceStandard: [
        "searches_complete: ordered searches returned, contract enquiries raised, and any adverse finding summarised for the client in plain English.",
      ],
      escalation: [
        "Day 21 (SLA): enquiries still open — advisor escalates to the fee earner's supervisor with the dated list.",
      ],
      partnerScript:
        "'Here is the dated list of open enquiries and who holds each one. Which three close this week?'",
    },
    {
      stageKey: "settlement_complete",
      objective:
        "Land funds and dates together so settlement happens on the planned day, not the first day everyone is free.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Work backwards from the target settlement date to the date cleared funds must sit in the conveyancer's trust account.",
        },
        {
          day: 3,
          owner: "CONVEYANCER",
          action:
            "Confirm the settlement booking in the thread and give the removalist the same date that day.",
        },
      ],
      evidenceStandard: [
        "settlement_confirmed: settlement booked in writing, date circulated to client and removalist, keys handover arranged.",
      ],
      escalation: [
        "Day 14 (SLA): no settlement date — advisor escalates and tells the client exactly who is holding it.",
      ],
      partnerScript:
        "'Target settlement is <date>. Funds clear on <date - 2>. Confirm you can settle or tell us who cannot.'",
    },
    {
      stageKey: "settle_light",
      objective:
        "Close the loop on the light settle checklist and capture what this corridor case taught us before the file goes quiet.",
      actions: [
        {
          day: 1,
          owner: "CLIENT",
          action:
            "Work the settle checklist: utilities, council rates, Medicare or GP, schools, address updates.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Run the debrief call: what was slow, which partner performed, and would they recommend us in their community.",
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

export function ukAuPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ukAuLegalPlaybooks(),
    entry,
    UK_AU_FLAGS,
    UK_AU_CORRIDOR_COPY,
  );
}
```

Create `src/domain/market-packs/uk-au.ts`:

```ts
import { auDisclosureText } from "./au-disclosure";
import { auPartnerMilestones } from "./au-milestones";
import type { MarketPack } from "./types";
import {
  UK_AU_COPY,
  UK_AU_FLAGS,
  UK_AU_LOCALE,
  UK_AU_PARTNER_ROLE_LABELS,
} from "./uk-au-config";
import { ukAuPlaybooks } from "./uk-au-playbook";
import { ukAuStageTemplates } from "./uk-au-stages";

export const ukAuMarketPack: MarketPack = {
  id: "uk_au",
  name: "United Kingdom → Australia",
  jurisdiction: "australia",
  enabled: true,
  locale: UK_AU_LOCALE,
  flags: UK_AU_FLAGS,
  copy: UK_AU_COPY,
  partnerRoleLabels: UK_AU_PARTNER_ROLE_LABELS,
  buildStages: ukAuStageTemplates,
  buildPlaybooks: ukAuPlaybooks,
  partnerMilestones: auPartnerMilestones,
  disclosureText: auDisclosureText,
};
```

In `src/domain/market-packs/au-stub.ts` replace the file-header comment and the disclosure comment only. Do not enable the pack, do not add playbooks, do not add evidence:

```ts
/**
 * Spec §3: "Second-country market packs (architecture ready only)". This pack
 * exists to prove the registry resolves more than one pack — it deliberately
 * ships no AU journeys, playbooks, evidence standards, partners or disclosure
 * copy. It stays `enabled: false`, so `resolveMarketPack("au")` refuses to
 * back a case. Live AU destination work is the `uk_au` corridor pack.
 */
```

```ts
  /** AU partner process language lives on uk_au, not on this stub. */
  partnerMilestones: () => [],
  disclosureText: () => {
    throw new MarketPackError("Australia disclosure copy is not written on the stub; use uk_au");
  },
```

In `src/domain/market-packs/registry.ts` add the import and append `ukAuMarketPack` to `PACKS`:

```ts
import { ukAuMarketPack } from "./uk-au";

const PACKS: readonly MarketPack[] = [
  ewMarketPack,
  auStubPack,
  auUkMarketPack,
  usUkMarketPack,
  ukAuMarketPack,
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/uk-au-pack.test.ts tests/domain/au-disclosure.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-flags.test.ts tests/domain/au-uk-pack.test.ts`

Expected: PASS. `resolveMarketPack("au")` still throws. `createCase({ marketPackId: "uk_au" })` succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/au-disclosure.ts src/domain/market-packs/au-milestones.ts src/domain/market-packs/uk-au-config.ts src/domain/market-packs/uk-au-stages.ts src/domain/market-packs/uk-au-playbook.ts src/domain/market-packs/uk-au.ts src/domain/market-packs/au-stub.ts src/domain/market-packs/registry.ts tests/domain/uk-au-pack.test.ts tests/domain/au-disclosure.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts
git commit -m "feat: ship the UK to Australia corridor pack and keep the au stub disabled"
```

---

### Task 5: United Kingdom → United States pack (`uk_us`)

**Files:**
- Create: `src/domain/market-packs/us-disclosure.ts`
- Create: `src/domain/market-packs/us-milestones.ts`
- Create: `src/domain/market-packs/uk-us-config.ts`
- Create: `src/domain/market-packs/uk-us-stages.ts`
- Create: `src/domain/market-packs/uk-us-playbook.ts`
- Create: `src/domain/market-packs/uk-us.ts`
- Modify: `src/domain/market-packs/registry.ts` — add `ukUsMarketPack`
- Create: `tests/domain/uk-us-pack.test.ts`
- Create: `tests/domain/us-disclosure.test.ts`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/market-pack-registry.test.ts`

**Interfaces:**
- Consumes: `applyCorridorEvidence`, `withCorridorPlaybookOverlay`, `DisclosureInput`, `isPartnerActorRole`.
- Produces: `usDisclosureText(input: DisclosureInput): string`, `usPartnerMilestones(role: ActorRole): PartnerMilestone[]`, `UK_US_FLAGS`, `ukUsMarketPack` with `id: "uk_us"`, `enabled: true`, `jurisdiction: "united_states"`, locale `en-US` / `USD`, stage key `closing_complete`.

US spine keys:

```
purchase_profile, money_readiness, finance_path, move_logistics,
search_readiness, offer_instruct, diligence, closing_complete, settle_light
```

US evidence kinds: `finance_path` → `pre_approval`; `offer_instruct` → `closing_agent_instructed`; `diligence` → `inspection_complete`; `closing_complete` → `closing_confirmed`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/us-disclosure.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { usDisclosureText } from "../../src/domain/market-packs/us-disclosure";

describe("United States destination disclosure", () => {
  it("states introducer-only and no mortgage advice for brokers", () => {
    const text = usDisclosureText({
      role: "MORTGAGE_PARTNER",
      partnerName: "Jordan Hale",
      partnerFirm: "Liberty Lending",
    });
    expect(text).toContain("Jordan Hale (Liberty Lending)");
    expect(text).toMatch(/introducer only/i);
    expect(text).toMatch(/do not give mortgage advice/i);
    expect(text).toMatch(/free to use any mortgage broker/i);
  });

  it("discloses a referral fee for closing attorneys and commission for movers", () => {
    expect(
      usDisclosureText({
        role: "CONVEYANCER",
        partnerName: "Riley Cho",
        partnerFirm: null,
      }),
    ).toMatch(/free to instruct any closing attorney or escrow company/i);
    expect(
      usDisclosureText({
        role: "MOVE_PARTNER",
        partnerName: "Pat Nguyen",
        partnerFirm: "Atlantic Movers",
      }),
    ).toMatch(/free to use any movers/i);
  });

  it("refuses client and advisor roles", () => {
    expect(() =>
      usDisclosureText({ role: "ADVISOR", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles only/i);
  });
});
```

Create `tests/domain/uk-us-pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ukUsMarketPack } from "../../src/domain/market-packs/uk-us";
import {
  getStageTemplate,
  isModuleEnabled,
  stagePlaybook,
} from "../../src/domain/market-packs/types";

describe("uk_us corridor pack", () => {
  it("is an enabled United Kingdom → United States destination pack", () => {
    expect(ukUsMarketPack.id).toBe("uk_us");
    expect(ukUsMarketPack.enabled).toBe(true);
    expect(ukUsMarketPack.jurisdiction).toBe("united_states");
    expect(ukUsMarketPack.locale).toEqual({
      bcp47: "en-US",
      currencyCode: "USD",
      addressFieldKeys: ["line1", "line2", "city", "state", "zip"],
      regionNoun: "state",
    });
    expect(ukUsMarketPack.flags).toEqual({
      fx_deposit: true,
      corridor_inbound: true,
      corridor_outbound: true,
    });
    expect(ukUsMarketPack.partnerRoleLabels.CONVEYANCER).toBe("closing attorney");
    expect(ukUsMarketPack.partnerRoleLabels.MOVE_PARTNER).toBe("movers");
    expect(isModuleEnabled(ukUsMarketPack.flags, "chain_free_inventory")).toBe(false);
    expect(isModuleEnabled(ukUsMarketPack.flags, "partner_speed_rails")).toBe(false);
    expect(isModuleEnabled(ukUsMarketPack.flags, "hard_client_sla")).toBe(false);
  });

  it("uses the US legal spine with closing, not exchange_complete", () => {
    const keys = getStageTemplate(ukUsMarketPack, "RETURNER_OVERSEAS").map((s) => s.key);
    expect(keys).toEqual([
      "purchase_profile",
      "money_readiness",
      "finance_path",
      "move_logistics",
      "search_readiness",
      "offer_instruct",
      "diligence",
      "closing_complete",
      "settle_light",
    ]);
    expect(keys).not.toContain("mortgage_path");
    expect(keys).not.toContain("exchange_complete");
    expect(keys).not.toContain("settlement_complete");
    expect(keys).not.toContain("chain_free_matching");
  });

  it("uses US evidence kinds and corridor overlays", () => {
    const stages = getStageTemplate(ukUsMarketPack, "RETURNER_OVERSEAS");
    expect(stages.find((s) => s.key === "finance_path")?.requiredEvidenceKinds).toEqual([
      "pre_approval",
    ]);
    expect(stages.find((s) => s.key === "offer_instruct")?.requiredEvidenceKinds).toEqual([
      "closing_agent_instructed",
    ]);
    expect(stages.find((s) => s.key === "diligence")?.requiredEvidenceKinds).toEqual([
      "inspection_complete",
    ]);
    expect(stages.find((s) => s.key === "closing_complete")).toMatchObject({
      title: "Closing",
      requiredEvidenceKinds: ["closing_confirmed"],
    });
    expect(stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
  });

  it("ships real playbooks that name closing and forbid seller introductions", () => {
    const close = stagePlaybook(ukUsMarketPack, "closing_complete", "UK_RESIDENT_SPEED");
    expect(close?.objective.length).toBeGreaterThan(20);
    expect(close?.actions.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(close)).toMatch(/closing_confirmed/);
    const keys = getStageTemplate(ukUsMarketPack, "RETURNER_IN_UK").map((s) => s.key);
    expect(ukUsMarketPack.buildPlaybooks("RETURNER_IN_UK").map((p) => p.stageKey)).toEqual(keys);
    const blob = JSON.stringify(ukUsMarketPack.buildPlaybooks("RETURNER_OVERSEAS"));
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/guaranteed completion/i);
  });

  it("uses US disclosure and can back a live case", () => {
    expect(
      ukUsMarketPack.disclosureText({
        role: "CONVEYANCER",
        partnerName: "Riley Cho",
        partnerFirm: "Harbor Title",
      }),
    ).toMatch(/closing attorney or escrow/i);
    const created = createCase({
      id: "ukus1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      marketPackId: "uk_us",
    });
    expect(created.stages.some((s) => s.key === "closing_complete")).toBe(true);
    expect(created.stages).toHaveLength(9);
  });
});
```

In `tests/domain/market-pack-registry.test.ts`:

```ts
    expect(listMarketPacks().map((p) => [p.id, p.enabled])).toEqual([
      ["au", false],
      ["au_uk", true],
      ["ew", true],
      ["uk_au", true],
      ["uk_us", true],
      ["us_uk", true],
    ]);
```

In `tests/domain/market-pack-flags.test.ts`:

```ts
    expect(enabled).toEqual(["au_uk", "ew", "uk_au", "uk_us", "us_uk"]);
    expect(inbound).toEqual(["au_uk", "uk_au", "uk_us", "us_uk"]);
    expect(outbound).toEqual(["au_uk", "uk_au", "uk_us", "us_uk"]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/uk-us-pack.test.ts tests/domain/us-disclosure.test.ts tests/domain/market-pack-registry.test.ts`

Expected: FAIL — `uk-us` and `us-disclosure` modules missing.

- [ ] **Step 3: Write US destination law and the `uk_us` pack**

Create `src/domain/market-packs/us-disclosure.ts`:

```ts
import type { DisclosureInput } from "./types";

function displayName(partnerName: string, partnerFirm: string | null): string {
  return partnerFirm ? `${partnerName} (${partnerFirm})` : partnerName;
}

export function usDisclosureText(input: DisclosureInput): string {
  const who = displayName(input.partnerName, input.partnerFirm);
  switch (input.role) {
    case "MORTGAGE_PARTNER":
      return `Property Concierge introduced you to ${who}. We act as an introducer only and do not give mortgage advice. We may receive an introducer fee from ${who} if you take a loan through them. You are free to use any mortgage broker.`;
    case "CONVEYANCER":
      return `Property Concierge referred you to ${who}. We may receive a referral fee from ${who} if you instruct them. You are free to instruct any closing attorney or escrow company.`;
    case "MOVE_PARTNER":
      return `Property Concierge referred you to ${who}. We may receive a commission from ${who} if you book with them. You are free to use any movers or relocation provider.`;
    default:
      throw new Error("Disclosure text applies to partner roles only");
  }
}
```

Create `src/domain/market-packs/us-milestones.ts`:

```ts
import { isPartnerActorRole, type ActorRole } from "../types";
import type { PartnerMilestone } from "./types";

const US_MILESTONES: Record<string, Array<[string, string]>> = {
  MORTGAGE_PARTNER: [
    ["fact_find_booked", "Fact find booked"],
    ["pre_approval_submitted", "Pre-approval submitted"],
    ["lender_decision", "Lender decision received"],
  ],
  CONVEYANCER: [
    ["engagement_sent", "Engagement letter sent"],
    ["title_ordered", "Title search ordered"],
    ["inspection_period_open", "Inspection period open"],
    ["closing_scheduled", "Closing scheduled"],
  ],
  MOVE_PARTNER: [
    ["survey_booked", "Pre-move survey booked"],
    ["quote_issued", "Move quote issued"],
    ["date_held", "Move date provisionally held"],
  ],
};

export function usPartnerMilestones(role: ActorRole): PartnerMilestone[] {
  if (!isPartnerActorRole(role)) {
    return [];
  }
  return (US_MILESTONES[role] ?? []).map(([key, label]) => ({ key, label, role }));
}
```

Create `src/domain/market-packs/uk-us-config.ts`:

```ts
import type { MarketCopy, MarketFlags, MarketLocale, PartnerRoleLabels } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";

export const UK_US_LOCALE: MarketLocale = {
  bcp47: "en-US",
  currencyCode: "USD",
  addressFieldKeys: ["line1", "line2", "city", "state", "zip"],
  regionNoun: "state",
};

export const UK_US_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
};

export const UK_US_COPY: MarketCopy = {
  jurisdiction_scope:
    "We orchestrate United Kingdom → United States purchases. State closing, title and escrow rules are local. This is not a domestic United States-only product.",
  mortgage_posture:
    "We introduce you to a mortgage broker. We are an introducer only and do not give mortgage advice.",
  region_prompt: "Which US state are you buying in?",
  directory_intro:
    "Our curated United States panel for households buying from the United Kingdom. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const UK_US_PARTNER_ROLE_LABELS: PartnerRoleLabels = {
  CLIENT: "household",
  ADVISOR: "advisor",
  MORTGAGE_PARTNER: "mortgage broker",
  CONVEYANCER: "closing attorney",
  MOVE_PARTNER: "movers",
};

export const UK_US_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "the United Kingdom",
  destinationName: "the United States",
  currencyPair: "GBP to USD",
  visaLabel: "US visa, green card, or other right-to-reside",
};
```

Create `src/domain/market-packs/uk-us-stages.ts`:

```ts
import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { UK_US_FLAGS } from "./uk-us-config";
import type { StageTemplate } from "./types";

function usLegalSpine(): StageTemplate[] {
  return [
    {
      key: "purchase_profile",
      title: "Purchase profile",
      defaultOwnerRole: "CLIENT",
      slaDays: 3,
      requiredEvidenceKinds: ["profile_complete"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "money_readiness",
      title: "Money readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["source_of_funds"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "finance_path",
      title: "Finance path",
      defaultOwnerRole: "MORTGAGE_PARTNER",
      slaDays: 14,
      requiredEvidenceKinds: ["pre_approval"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: ["move_quote"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "search_readiness",
      title: "Search readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["buyer_ready"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "offer_instruct",
      title: "Offer → instruct",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 5,
      requiredEvidenceKinds: ["closing_agent_instructed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "diligence",
      title: "Diligence",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 21,
      requiredEvidenceKinds: ["inspection_complete"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "closing_complete",
      title: "Closing",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 14,
      requiredEvidenceKinds: ["closing_confirmed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "settle_light",
      title: "Settle (light)",
      defaultOwnerRole: "CLIENT",
      slaDays: 14,
      requiredEvidenceKinds: [],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
  ];
}

export function ukUsStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(usLegalSpine(), entry, UK_US_FLAGS);
}
```

Create `src/domain/market-packs/uk-us-playbook.ts`:

```ts
import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { UK_US_CORRIDOR_COPY, UK_US_FLAGS } from "./uk-us-config";
import type { StagePlaybook } from "./types";

function ukUsLegalPlaybooks(): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective:
        "Lock the household constraints that every later US stage is planned against: arrival window, target state, budget band, and who signs.",
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
            "Sanity-check the stated budget band against the target state; flag it now if the two do not meet.",
        },
      ],
      evidenceStandard: [
        "profile_complete: target state named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
      ],
      escalation: ["Day 3: no profile call booked — advisor calls, does not email."],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective:
        "Get the down payment provable and movable into US dollars before anyone tours a property.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Issue the source-of-funds list: statements covering six months, evidence of any gift, and the account the down payment will settle from.",
        },
        {
          day: 5,
          owner: "ADVISOR",
          action:
            "Review the pack against the standard below and reject anything a lender or closing attorney would bounce — once, properly, not twice.",
        },
      ],
      evidenceStandard: [
        "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every large deposit explained.",
      ],
      escalation: [
        "Day 7 (SLA): pack incomplete — advisor calls the client and names the single missing document.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "finance_path",
      objective:
        "Hand a clean, pre-briefed case to the US mortgage broker and hold them to a written pre-approval without giving mortgage advice ourselves.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Send the warm intro with the profile summary, income shape, down-payment position and target closing window attached.",
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
            "Chase the lender pack if no pre-approval has landed; ask for the specific blocking item, not a status update.",
        },
      ],
      evidenceStandard: [
        "pre_approval: written pre-approval naming the lender, the amount, and its expiry date.",
      ],
      escalation: [
        "Day 14 (SLA): no pre-approval — advisor calls the broker and sets a 48-hour deadline in the thread.",
      ],
      partnerScript:
        "Introducer framing: 'We do not advise on the mortgage. We are handing you a prepared buyer and we will hold the timeline. Confirm the pre-approval or the blocking item by <date>.'",
    },
    {
      stageKey: "move_logistics",
      objective:
        "Turn the UK→US move into a booked, priced plan sequenced against closing, not against the first free shipping date.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Brief the movers with volume, UK origin, destination state and the earliest and latest acceptable arrival dates.",
        },
        {
          day: 3,
          owner: "MOVE_PARTNER",
          action:
            "Return a written quote covering packing, transit, storage rate and the cancellation terms.",
        },
      ],
      evidenceStandard: [
        "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
      ],
      escalation: [
        "Day 10 (SLA): no quote — advisor chases the partner directly and offers the second panel member.",
      ],
      partnerScript:
        "'This household has a closing window we control. Quote to the window, include storage, and tell us your cut-off for booking.'",
    },
    {
      stageKey: "search_readiness",
      objective:
        "Make the household credible to US agents on day one: proven funds, a pre-approval, and a written must-have list.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Write the buyer-ready one-pager: budget band, lender, down payment proven, timeline, and who to contact.",
        },
        {
          day: 2,
          owner: "CLIENT",
          action:
            "Agree the must-have versus nice-to-have split so offers are not re-litigated later in the family.",
        },
      ],
      evidenceStandard: [
        "buyer_ready: one-pager exists, pre-approval is unexpired, deposit evidence accepted, and must-haves are written down.",
      ],
      escalation: [
        "Day 7 (SLA): must-haves still unresolved — advisor runs a decision call rather than waiting for consensus.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "offer_instruct",
      objective:
        "Convert an accepted offer into an engaged closing attorney or escrow company with ID cleared, in days rather than weeks.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Warm-intro the closing attorney the same day the offer is accepted; do not wait for the listing agent's packet.",
        },
        {
          day: 1,
          owner: "CONVEYANCER",
          action:
            "Issue the engagement letter and the ID request, and confirm in the thread when it was sent.",
        },
      ],
      evidenceStandard: [
        "closing_agent_instructed: engagement letter signed, ID cleared, and the attorney or escrow company has confirmed it is on the record.",
      ],
      escalation: [
        "Day 5 (SLA): not instructed — advisor calls the firm and the listing agent on the same day.",
      ],
      partnerScript:
        "'Offer accepted on <date>. We hold the timeline and the client is document-ready. Confirm engagement and your title-order date.'",
    },
    {
      stageKey: "diligence",
      objective:
        "Keep inspection, title, appraisal and HOA review moving in parallel and surface defects while there is still time to price them.",
      actions: [
        {
          day: 0,
          owner: "CONVEYANCER",
          action:
            "Open the inspection period on day one of engagement and state the contingency dates in the thread.",
        },
        {
          day: 2,
          owner: "ADVISOR",
          action:
            "Book the home inspection in parallel with title; never sequence them.",
        },
      ],
      evidenceStandard: [
        "inspection_complete: inspection report received, title exceptions summarised, and any adverse finding explained to the client in plain English.",
      ],
      escalation: [
        "Day 21 (SLA): contingencies still open — advisor escalates with the dated list.",
      ],
      partnerScript:
        "'Here is the dated list of open contingencies and who holds each one. Which three close this week?'",
    },
    {
      stageKey: "closing_complete",
      objective:
        "Land funds and dates together so closing happens on the planned day, not the first day everyone is free.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Work backwards from the target closing date to the date cleared funds must sit with escrow.",
        },
        {
          day: 3,
          owner: "CONVEYANCER",
          action:
            "Confirm the closing appointment in the thread and give the movers the same date that day.",
        },
      ],
      evidenceStandard: [
        "closing_confirmed: closing appointment booked in writing, date circulated to client and movers, keys handover arranged.",
      ],
      escalation: [
        "Day 14 (SLA): no closing date — advisor escalates and tells the client exactly who is holding it.",
      ],
      partnerScript:
        "'Target closing is <date>. Funds clear on <date - 2>. Confirm you can close or tell us who cannot.'",
    },
    {
      stageKey: "settle_light",
      objective:
        "Close the loop on the light settle checklist and capture what this corridor case taught us before the file goes quiet.",
      actions: [
        {
          day: 1,
          owner: "CLIENT",
          action:
            "Work the settle checklist: utilities, property tax, doctor, schools, address updates.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Run the debrief call: what was slow, which partner performed, and would they recommend us in their community.",
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

export function ukUsPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ukUsLegalPlaybooks(),
    entry,
    UK_US_FLAGS,
    UK_US_CORRIDOR_COPY,
  );
}
```

Create `src/domain/market-packs/uk-us.ts`:

```ts
import type { MarketPack } from "./types";
import { usDisclosureText } from "./us-disclosure";
import { usPartnerMilestones } from "./us-milestones";
import {
  UK_US_COPY,
  UK_US_FLAGS,
  UK_US_LOCALE,
  UK_US_PARTNER_ROLE_LABELS,
} from "./uk-us-config";
import { ukUsPlaybooks } from "./uk-us-playbook";
import { ukUsStageTemplates } from "./uk-us-stages";

export const ukUsMarketPack: MarketPack = {
  id: "uk_us",
  name: "United Kingdom → United States",
  jurisdiction: "united_states",
  enabled: true,
  locale: UK_US_LOCALE,
  flags: UK_US_FLAGS,
  copy: UK_US_COPY,
  partnerRoleLabels: UK_US_PARTNER_ROLE_LABELS,
  buildStages: ukUsStageTemplates,
  buildPlaybooks: ukUsPlaybooks,
  partnerMilestones: usPartnerMilestones,
  disclosureText: usDisclosureText,
};
```

In `src/domain/market-packs/registry.ts` add the import and append `ukUsMarketPack` to `PACKS`:

```ts
import { ukUsMarketPack } from "./uk-us";

const PACKS: readonly MarketPack[] = [
  ewMarketPack,
  auStubPack,
  auUkMarketPack,
  usUkMarketPack,
  ukAuMarketPack,
  ukUsMarketPack,
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/uk-us-pack.test.ts tests/domain/us-disclosure.test.ts tests/domain/uk-au-pack.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-flags.test.ts`

Expected: PASS. All four corridor packs resolve. `au` still fails closed.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/us-disclosure.ts src/domain/market-packs/us-milestones.ts src/domain/market-packs/uk-us-config.ts src/domain/market-packs/uk-us-stages.ts src/domain/market-packs/uk-us-playbook.ts src/domain/market-packs/uk-us.ts src/domain/market-packs/registry.ts tests/domain/uk-us-pack.test.ts tests/domain/us-disclosure.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts
git commit -m "feat: enable the UK to United States corridor pack"
```

---

### Task 6: Flag matrix, registry contract, and inspector coverage

**Files:**
- Modify: `tests/domain/market-pack-flags.test.ts` — final matrix assertions
- Modify: `tests/domain/market-pack-registry.test.ts` — fail-closed + stub still architecture-only
- Modify: `tests/domain/market-pack-inspector.test.ts` — corridor pack summary rows
- Modify: `src/domain/market-packs/registry.ts` — only if `CORRIDOR_PACK_IDS` is added here (allowed; no behaviour change)

**Interfaces:**
- Consumes: `listMarketPacks`, `resolveMarketPack`, `isModuleEnabled`, `marketPackSummary`, the four corridor packs.
- Produces: `CORRIDOR_PACK_IDS` as `readonly ["au_uk", "uk_au", "uk_us", "us_uk"]` (sorted) exported from `registry.ts`. Inspector continues to carry no playbook prose.

- [ ] **Step 1: Write the failing tests**

Replace `tests/domain/market-pack-flags.test.ts` in full with:

```ts
import { describe, it, expect } from "vitest";
import { CORRIDOR_PACK_IDS, listMarketPacks } from "../../src/domain/market-packs/registry";
import { moneyEvidenceKinds } from "../../src/domain/market-packs/ew-stages";
import { EW_FLAGS } from "../../src/domain/market-packs/ew-config";
import {
  isModuleEnabled,
  MARKET_MODULE_KEYS,
  packModules,
} from "../../src/domain/market-packs/types";

const GATED_MODULES = ["hard_client_sla", "document_vault"] as const;

describe("module flags are pack data", () => {
  it("keeps every globally gated module off in every registered pack", () => {
    for (const pack of listMarketPacks()) {
      for (const key of GATED_MODULES) {
        expect(isModuleEnabled(pack.flags, key), `${pack.id}.${key}`).toBe(false);
      }
    }
  });

  it("enables FX on the beachhead pack and on every registered corridor pack", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "fx_deposit"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["au_uk", "ew", "uk_au", "uk_us", "us_uk"]);
  });

  it("runs partner speed rails in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "partner_speed_rails"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
  });

  it("runs the chain-free overlay in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "chain_free_inventory"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "hard_client_sla"),
    ).toBe(false);
  });

  it("turns corridor modules on only for the four corridor packs", () => {
    const inbound = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "corridor_inbound"))
      .map((pack) => pack.id);
    const outbound = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "corridor_outbound"))
      .map((pack) => pack.id);
    expect(inbound).toEqual([...CORRIDOR_PACK_IDS]);
    expect(outbound).toEqual([...CORRIDOR_PACK_IDS]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "ew")!.flags, "corridor_inbound")).toBe(
      false,
    );
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "corridor_outbound")).toBe(
      false,
    );
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

Add this test to `tests/domain/market-pack-registry.test.ts` after the existing list test:

```ts
  it("exports the four corridor pack ids in sorted order", () => {
    expect(CORRIDOR_PACK_IDS).toEqual(["au_uk", "uk_au", "uk_us", "us_uk"]);
    for (const id of CORRIDOR_PACK_IDS) {
      expect(resolveMarketPack(id).enabled).toBe(true);
    }
  });
```

Add the `CORRIDOR_PACK_IDS` import next to the existing registry imports in that file.

Add this test to `tests/domain/market-pack-inspector.test.ts`:

```ts
import { auUkMarketPack } from "../../src/domain/market-packs/au-uk";
import { ukAuMarketPack } from "../../src/domain/market-packs/uk-au";

  it("summarises a corridor pack without leaking playbook prose", () => {
    const inbound = marketPackSummary(auUkMarketPack, "RETURNER_OVERSEAS");
    expect(inbound.enabled).toBe(true);
    expect(inbound.modules.find((m) => m.key === "corridor_inbound")?.enabled).toBe(true);
    expect(inbound.modules.find((m) => m.key === "chain_free_inventory")?.enabled).toBe(false);
    expect(inbound.stages.map((s) => s.key)).not.toContain("chain_free_matching");
    expect(inbound.playbookStageKeys).toEqual(inbound.stages.map((s) => s.key));

    const outbound = marketPackSummary(ukAuMarketPack, "UK_RESIDENT_SPEED");
    expect(outbound.locale.currencyCode).toBe("AUD");
    expect(outbound.stages.map((s) => s.key)).toContain("finance_path");
    expect(JSON.stringify(outbound)).not.toContain(
      ukAuMarketPack.buildPlaybooks("UK_RESIDENT_SPEED")[0]!.objective,
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-inspector.test.ts`

Expected: FAIL — `CORRIDOR_PACK_IDS` is not exported.

- [ ] **Step 3: Export the corridor id list**

In `src/domain/market-packs/registry.ts` add, next to `DEFAULT_MARKET_PACK_ID`:

```ts
/** Sorted ids of the enabled bidirectional corridor packs. The au stub is not in this list. */
export const CORRIDOR_PACK_IDS = ["au_uk", "uk_au", "uk_us", "us_uk"] as const;
```

Do not change inspector.ts. Do not enable the `au` stub.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/uk-us-pack.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/registry.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts tests/domain/market-pack-inspector.test.ts
git commit -m "test: lock corridor flag matrix and inspector coverage"
```

---

### Task 7: Intake and `/start` corridor selection

**Files:**
- Modify: `src/domain/market-packs/registry.ts` — `SELF_SERVE_MARKET_PACK_IDS`, `isSelfServeMarketPack`
- Modify: `src/domain/intake.ts` — optional `marketPackId`
- Modify: `src/app/actions/signup.ts` — pass the field through
- Modify: `src/server/signup.ts` — persist `intake.marketPackId`
- Modify: `src/components/marketing/StartForm.tsx` — pack selector + pack-local `region_prompt`
- Modify: `tests/domain/intake.test.ts`
- Modify: `tests/server/signup.test.ts`

**Interfaces:**
- Consumes: `resolveMarketPack`, `DEFAULT_MARKET_PACK_ID`, `CORRIDOR_PACK_IDS`.
- Produces: `SELF_SERVE_MARKET_PACK_IDS` as `readonly ["ew", "au_uk", "us_uk"]`, `isSelfServeMarketPack(id: string): boolean`, `IntakeFields.marketPackId?: string | null`, `ParsedIntake.marketPackId: string` (always set; defaults to `ew`). Self-serve refuses `uk_au`, `uk_us`, `au`, and unknown ids. `createSelfServeCase` writes `createCaseRecord({ marketPackId: intake.marketPackId })`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/domain/intake.test.ts` (keep the existing `valid` fixture unchanged so omitted `marketPackId` still succeeds):

```ts
import { DEFAULT_MARKET_PACK_ID } from "../../src/domain/market-packs/registry";

  it("defaults marketPackId to the beachhead pack", () => {
    const result = parseIntake(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.marketPackId).toBe(DEFAULT_MARKET_PACK_ID);
  });

  it("accepts diaspora self-serve corridor packs and copies their region prompt on empty region", () => {
    const auUk = parseIntake({ ...valid, marketPackId: "au_uk", targetRegion: "Bristol" });
    expect(auUk.ok && auUk.value.marketPackId).toBe("au_uk");

    const usUk = parseIntake({ ...valid, marketPackId: "us_uk" });
    expect(usUk.ok && usUk.value.marketPackId).toBe("us_uk");

    const missingRegion = parseIntake({
      ...valid,
      marketPackId: "au_uk",
      targetRegion: "",
    });
    expect(missingRegion.ok).toBe(false);
    if (missingRegion.ok) return;
    expect(missingRegion.errors.targetRegion).toMatch(/England & Wales/);
    expect(missingRegion.errors.targetRegion).toMatch(/Australia/);
  });

  it("refuses advisor-only and disabled packs on the public funnel", () => {
    const outbound = parseIntake({ ...valid, marketPackId: "uk_au" });
    expect(outbound.ok).toBe(false);
    if (outbound.ok) return;
    expect(outbound.errors.marketPackId).toMatch(/advisor/i);

    const stub = parseIntake({ ...valid, marketPackId: "au" });
    expect(stub.ok).toBe(false);
    if (stub.ok) return;
    expect(stub.errors.marketPackId).toMatch(/not enabled|not available/i);

    const unknown = parseIntake({ ...valid, marketPackId: "zz" });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.errors.marketPackId).toMatch(/unknown|not available/i);
  });
```

In `tests/server/signup.test.ts` add `marketPackId: "ew"` to the existing `intake` fixture (required once `ParsedIntake` includes the field). Then add:

```ts
  it("persists a self-serve corridor pack id onto the case", async () => {
    const created = await createSelfServeCase({
      intake: {
        ...intake,
        email: "signup-auuk@example.com",
        marketPackId: "au_uk",
        caseTitle: "Bloggs household — Bristol",
      },
      attribution: {
        leadSource: "DIASPORA_AU_UK",
        leadCampaign: "poms-in-oz-sept",
        leadReferrer: null,
      },
    });
    const caseState = await loadCase(created.caseId);
    expect(caseState.marketPackId).toBe("au_uk");
    expect(caseState.stages.some((s) => s.key === "chain_free_matching")).toBe(false);
    expect(caseState.stages.find((s) => s.key === "money_readiness")?.requiredEvidenceKinds).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/intake.test.ts tests/server/signup.test.ts`

Expected: FAIL — `ParsedIntake` has no `marketPackId`; `createSelfServeCase` still defaults every case to `ew`.

- [ ] **Step 3: Thread `marketPackId` through intake, signup and the start form**

In `src/domain/market-packs/registry.ts` add:

```ts
export const SELF_SERVE_MARKET_PACK_IDS = ["ew", "au_uk", "us_uk"] as const;

export function isSelfServeMarketPack(id: string): boolean {
  return (SELF_SERVE_MARKET_PACK_IDS as readonly string[]).includes(id);
}
```

Replace `src/domain/intake.ts` so intake resolves copy from the chosen pack, not a module-level default:

```ts
import { ENTRY_CONTEXTS, type EntryContext, type Tier } from "./types";
import {
  DEFAULT_MARKET_PACK_ID,
  isSelfServeMarketPack,
  resolveMarketPack,
} from "./market-packs/registry";
import { MarketPackError } from "./market-packs/types";

export type IntakeFields = {
  name?: string | null;
  email?: string | null;
  password?: string | null;
  entryContext?: string | null;
  plan?: string | null;
  targetRegion?: string | null;
  marketPackId?: string | null;
};

export type ParsedIntake = {
  name: string;
  email: string;
  password: string;
  entryContext: EntryContext;
  tier: Tier;
  targetRegion: string;
  caseTitle: string;
  marketPackId: string;
};
```

Keep `MIN_PASSWORD_LENGTH`, `caseTitleFor`, `isEntryContext`, and `tierFromPlan` as they are today. Inside `parseIntake`, after the existing field checks and **before** the `Object.keys(errors)` return, resolve the pack:

```ts
  const requestedPack = (fields.marketPackId ?? "").trim() || DEFAULT_MARKET_PACK_ID;
  let marketPackId = DEFAULT_MARKET_PACK_ID;
  try {
    const pack = resolveMarketPack(requestedPack);
    if (!isSelfServeMarketPack(pack.id)) {
      errors.marketPackId = "This corridor is opened by your advisor.";
    } else {
      marketPackId = pack.id;
    }
  } catch (err) {
    if (err instanceof MarketPackError) {
      errors.marketPackId = err.message.includes("not enabled")
        ? "That market is not enabled."
        : "Unknown market pack.";
    } else {
      errors.marketPackId = "That market is not available.";
    }
  }

  const packForCopy = isSelfServeMarketPack(requestedPack)
    ? resolveMarketPack(requestedPack)
    : resolveMarketPack(DEFAULT_MARKET_PACK_ID);

  const targetRegion = (fields.targetRegion ?? "").trim();
  if (targetRegion.length === 0) {
    errors.targetRegion = packForCopy.copy.region_prompt;
  } else if (targetRegion.length > MAX_TEXT_LENGTH) {
    errors.targetRegion = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
  }
```

Delete the module-level `const DEFAULT_PACK = resolveMarketPack(DEFAULT_MARKET_PACK_ID)` and the old `targetRegion` block that used it. Include `marketPackId` on the success value.

Do **not** put `england` or `wales` string literals in `intake.ts` — the region prompt comes from pack copy. `intake.ts` stays in `ENGINE_GLOBAL_FILES`.

In `src/app/actions/signup.ts` pass the field through:

```ts
  const parsed = parseIntake({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    entryContext: field(formData, "entryContext"),
    plan: field(formData, "plan"),
    targetRegion: field(formData, "targetRegion"),
    marketPackId: field(formData, "marketPackId"),
  });
```

In `src/server/signup.ts`, pass the pack into `createCaseRecord`:

```ts
      const caseState = await createCaseRecord(
        {
          title: input.intake.caseTitle,
          entryContext: input.intake.entryContext,
          tier: input.intake.tier,
          clientUserId: user.id,
          advisorUserId: advisor.id,
          marketPackId: input.intake.marketPackId,
          attribution: input.attribution,
        },
        tx,
      );
```

In `src/components/marketing/StartForm.tsx` replace the hardcoded `REGION_PROMPT` with a client-side selector. Keep the existing hidden UTM fields, entry-context select, and submit button. Add this immediately above the household-name field, and bind the region label to the selected pack:

```tsx
import { useMemo, useState } from "react";
import {
  SELF_SERVE_MARKET_PACK_IDS,
  resolveMarketPack,
} from "@/domain/market-packs/registry";

const PACK_OPTIONS = SELF_SERVE_MARKET_PACK_IDS.map((id) => {
  const pack = resolveMarketPack(id);
  return { id: pack.id, name: pack.name, regionPrompt: pack.copy.region_prompt };
});

export function StartForm({ plan, entryContext, attribution }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [marketPackId, setMarketPackId] = useState(DEFAULT_MARKET_PACK_ID);
  const selectedPack = useMemo(
    () => PACK_OPTIONS.find((pack) => pack.id === marketPackId) ?? PACK_OPTIONS[0]!,
    [marketPackId],
  );
```

Add the select:

```tsx
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Which corridor are you buying on?</span>
        <select
          name="marketPackId"
          value={marketPackId}
          onChange={(event) => setMarketPackId(event.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {PACK_OPTIONS.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.name}
            </option>
          ))}
        </select>
        {errors.marketPackId && (
          <span className="text-xs text-red-700">{errors.marketPackId}</span>
        )}
      </label>
```

Change the region label from `REGION_PROMPT` to `{selectedPack.regionPrompt}`. Do not add `uk_au` or `uk_us` to this select.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/intake.test.ts tests/server/signup.test.ts tests/domain/engine-country-agnostic.test.ts tests/domain/market-pack-registry.test.ts`

Expected: PASS. Existing signup fixture must include `marketPackId: "ew"` so TypeScript compiles.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/registry.ts src/domain/intake.ts src/app/actions/signup.ts src/server/signup.ts src/components/marketing/StartForm.tsx tests/domain/intake.test.ts tests/server/signup.test.ts
git commit -m "feat: let diaspora self-serve pick au_uk or us_uk on the start funnel"
```

---

### Task 8: Seed corridor cases and pack-scoped panel members

**Files:**
- Modify: `src/domain/attribution.ts` — add `DIASPORA_UK_AU` and `DIASPORA_UK_US`
- Modify: `prisma/seed.ts` — four corridor cases + panel rows
- Modify: `tests/server/market-pack-resolution.test.ts` — enabled corridor create
- Modify: tests that exhaustively list `LeadSource` if any fail (search for `DIASPORA_US_UK` snapshots)

**Interfaces:**
- Consumes: `createCaseRecord({ marketPackId })`, existing seed users (`seed_client`, `seed_advisor`, partner user ids), existing `PartnerPanel.marketPackId`.
- Produces: one paid demo case per corridor pack; additional `PartnerPanel` rows that reuse existing partner users (no new logins, no Prisma schema change). New lead sources are strings on the existing `leadSource` column.

Seed case titles (stable, used by the demo script):

| Title | pack | entry | tier | leadSource |
|---|---|---|---|---|
| Chen AU→UK return (paid) | `au_uk` | `RETURNER_OVERSEAS` | `PAID_DWY` | `DIASPORA_AU_UK` |
| Morales US→UK return (paid) | `us_uk` | `RETURNER_OVERSEAS` | `PAID_DWY` | `DIASPORA_US_UK` |
| Patel UK→AU purchase (paid) | `uk_au` | `UK_RESIDENT_SPEED` | `PAID_DWY` | `DIASPORA_UK_AU` |
| Hughes UK→US purchase (paid) | `uk_us` | `RETURNER_OVERSEAS` | `PAID_DWY` | `DIASPORA_UK_US` |

Keep the existing Bloggs / Smith / Okafor E&W cases.

- [ ] **Step 1: Write the failing tests**

Add to `tests/server/market-pack-resolution.test.ts`:

```ts
  it("creates a live case on an enabled corridor pack", async () => {
    const created = await createCaseRecord({
      title: "Corridor resolution case",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "mp_client",
      advisorUserId: "mp_advisor",
      marketPackId: "au_uk",
    });
    expect(created.marketPackId).toBe("au_uk");
    const loaded = await loadCase(created.id);
    expect(loaded.stages.some((s) => s.key === "mortgage_path")).toBe(true);
    expect(loaded.stages.some((s) => s.key === "chain_free_matching")).toBe(false);
  });
```

If `tests/domain` attribution tests enumerate `LeadSource`, add the two new sources there in this same step. Search for `DIASPORA_US_UK` and extend every exhaustive list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/market-pack-resolution.test.ts`

Expected: FAIL until Task 2–5 packs are registered (should already pass create if those tasks landed). If the new test is the only addition and packs exist, this step goes green on the assertion file; continue to Step 3 and seed anyway.

- [ ] **Step 3: Add lead sources, panel rows and seed cases**

In `src/domain/attribution.ts` extend the union and the runtime list:

```ts
export type LeadSource =
  | "DIASPORA_AU_UK"
  | "DIASPORA_US_UK"
  | "DIASPORA_UK_AU"
  | "DIASPORA_UK_US"
  | "COMMUNITY_REFERRAL"
  | "PARTNER_REFERRAL"
  | "ORGANIC"
  | "DIRECT";

const LEAD_SOURCES: readonly LeadSource[] = [
  "DIASPORA_AU_UK",
  "DIASPORA_US_UK",
  "DIASPORA_UK_AU",
  "DIASPORA_UK_US",
  "COMMUNITY_REFERRAL",
  "PARTNER_REFERRAL",
  "ORGANIC",
  "DIRECT",
];
```

Add source-map slugs:

```ts
  "uk-au": "DIASPORA_UK_AU",
  "brits-to-australia": "DIASPORA_UK_AU",
  "uk-us": "DIASPORA_UK_US",
  "brits-to-america": "DIASPORA_UK_US",
```

Extend `isDiasporaLead`:

```ts
    source === "DIASPORA_AU_UK" ||
    source === "DIASPORA_US_UK" ||
    source === "DIASPORA_UK_AU" ||
    source === "DIASPORA_UK_US" ||
    source === "COMMUNITY_REFERRAL"
```

In `prisma/seed.ts`, after the existing `ew` panel rows, add pack-scoped copies that reuse the same partner users (new row ids, same `userId`):

```ts
      {
        id: "seed_panel_priya_au_uk",
        roleType: "MORTGAGE_PARTNER",
        name: "Priya Nair",
        firm: "Northstar Mortgages",
        slaDays: 3,
        userId: "seed_mortgage_partner",
        marketPackId: "au_uk",
      },
      {
        id: "seed_panel_tom_au_uk",
        roleType: "CONVEYANCER",
        name: "Tom Ashby",
        firm: "Harbour Law LLP",
        slaDays: 5,
        userId: "seed_conveyancer",
        marketPackId: "au_uk",
      },
      {
        id: "seed_panel_dan_au_uk",
        roleType: "MOVE_PARTNER",
        name: "Dan Whitfield",
        firm: "Compass Removals",
        slaDays: 4,
        userId: "seed_move_partner",
        marketPackId: "au_uk",
      },
      {
        id: "seed_panel_priya_us_uk",
        roleType: "MORTGAGE_PARTNER",
        name: "Priya Nair",
        firm: "Northstar Mortgages",
        slaDays: 3,
        userId: "seed_mortgage_partner",
        marketPackId: "us_uk",
      },
      {
        id: "seed_panel_tom_us_uk",
        roleType: "CONVEYANCER",
        name: "Tom Ashby",
        firm: "Harbour Law LLP",
        slaDays: 5,
        userId: "seed_conveyancer",
        marketPackId: "us_uk",
      },
      {
        id: "seed_panel_dan_us_uk",
        roleType: "MOVE_PARTNER",
        name: "Dan Whitfield",
        firm: "Compass Removals",
        slaDays: 4,
        userId: "seed_move_partner",
        marketPackId: "us_uk",
      },
      {
        id: "seed_panel_mia_uk_au",
        roleType: "MORTGAGE_PARTNER",
        name: "Mia Chen",
        firm: "Harbour Brokers",
        slaDays: 3,
        userId: "seed_mortgage_partner",
        marketPackId: "uk_au",
      },
      {
        id: "seed_panel_owen_uk_au",
        roleType: "CONVEYANCER",
        name: "Owen Blake",
        firm: "Southern Title",
        slaDays: 5,
        userId: "seed_conveyancer",
        marketPackId: "uk_au",
      },
      {
        id: "seed_panel_sam_uk_au",
        roleType: "MOVE_PARTNER",
        name: "Sam Reid",
        firm: "Southern Cross Removalists",
        slaDays: 4,
        userId: "seed_move_partner",
        marketPackId: "uk_au",
      },
      {
        id: "seed_panel_jordan_uk_us",
        roleType: "MORTGAGE_PARTNER",
        name: "Jordan Hale",
        firm: "Liberty Lending",
        slaDays: 3,
        userId: "seed_mortgage_partner",
        marketPackId: "uk_us",
      },
      {
        id: "seed_panel_riley_uk_us",
        roleType: "CONVEYANCER",
        name: "Riley Cho",
        firm: "Harbor Title",
        slaDays: 5,
        userId: "seed_conveyancer",
        marketPackId: "uk_us",
      },
      {
        id: "seed_panel_pat_uk_us",
        roleType: "MOVE_PARTNER",
        name: "Pat Nguyen",
        firm: "Atlantic Movers",
        slaDays: 4,
        userId: "seed_move_partner",
        marketPackId: "uk_us",
      },
```

After the existing three `createCaseRecord` calls, add:

```ts
  await createCaseRecord({
    title: "Chen AU→UK return (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "au_uk",
    attribution: {
      leadSource: "DIASPORA_AU_UK",
      leadCampaign: "poms-in-oz-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Morales US→UK return (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "us_uk",
    attribution: {
      leadSource: "DIASPORA_US_UK",
      leadCampaign: "brits-in-america-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Patel UK→AU purchase (paid)",
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "uk_au",
    attribution: {
      leadSource: "DIASPORA_UK_AU",
      leadCampaign: "brits-to-australia-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Hughes UK→US purchase (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "uk_us",
    attribution: {
      leadSource: "DIASPORA_UK_US",
      leadCampaign: "brits-to-america-sept",
      leadReferrer: null,
    },
  });
```

Do not add Prisma columns. Do not create an `au` case.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/market-pack-resolution.test.ts tests/domain/attribution.test.ts tests/server/panel.test.ts tests/server/referrals.test.ts`

Expected: PASS. Then run `npx tsx prisma/seed.ts` (or `npm run db:seed`). Expected: exit 0, seven cases total (three E&W + four corridor).

- [ ] **Step 5: Commit**

```bash
git add src/domain/attribution.ts prisma/seed.ts tests/server/market-pack-resolution.test.ts
git commit -m "feat: seed one demo case and panel members per corridor pack"
```

If attribution tests also changed, include those files in the same commit.

---

### Task 9: Advisor-created outbound cases and cockpit pack badge

**Files:**
- Modify: `src/app/actions/case-admin.ts` — `createAdvisorCaseAction`
- Create: `src/components/CreateAdvisorCaseForm.tsx`
- Modify: `src/server/cases.ts` — `listCasesForUser` includes `marketPackId`
- Modify: `src/app/cockpit/cases/page.tsx` — mount the form; show pack id
- Modify: `src/app/portal/page.tsx` only if it destructures the list row (keep compiling)
- Create: `tests/server/advisor-create-case.test.ts`

**Interfaces:**
- Consumes: `createCaseRecord`, `resolveMarketPack`, `ENTRY_CONTEXTS`, existing advisor session helpers in `case-admin.ts`.
- Produces: `CreateAdvisorCaseResult = { ok: true; caseId: string } | { ok: false; error: string }`, `createAdvisorCaseAction(input: { clientEmail: string; title: string; entryContext: string; marketPackId: string; tier: string }): Promise<CreateAdvisorCaseResult>`. Any **enabled** pack may be chosen, including `uk_au` and `uk_us`. Disabled `au` and unknown ids fail closed. The action does **not** reassign an existing case's pack.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/advisor-create-case.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase } from "../../src/server/cases";
import { MarketPackError } from "../../src/domain/market-packs/types";

describe("advisor-created corridor cases", () => {
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
        { id: "adv_client", email: "adv-client@example.com", role: "CLIENT", passwordHash },
        { id: "adv_advisor", email: "adv-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a uk_au case with the AU spine for an existing client", async () => {
    const created = await createCaseRecord({
      title: "Patel UK→AU purchase (paid)",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "adv_client",
      advisorUserId: "adv_advisor",
      marketPackId: "uk_au",
    });
    const loaded = await loadCase(created.id);
    expect(loaded.marketPackId).toBe("uk_au");
    expect(loaded.stages.map((s) => s.key)).toContain("finance_path");
    expect(loaded.stages.map((s) => s.key)).toContain("settlement_complete");
  });

  it("still refuses the disabled au stub", async () => {
    await expect(
      createCaseRecord({
        title: "Should fail",
        entryContext: "RETURNER_OVERSEAS",
        tier: "PAID_DWY",
        clientUserId: "adv_client",
        advisorUserId: "adv_advisor",
        marketPackId: "au",
      }),
    ).rejects.toThrow(MarketPackError);
  });

  it("wires the cockpit list to the create action and shows marketPackId", () => {
    const action = readFileSync(
      path.resolve(process.cwd(), "src/app/actions/case-admin.ts"),
      "utf8",
    );
    const form = readFileSync(
      path.resolve(process.cwd(), "src/components/CreateAdvisorCaseForm.tsx"),
      "utf8",
    );
    const list = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/page.tsx"),
      "utf8",
    );
    expect(action).toContain("createAdvisorCaseAction");
    expect(form).toContain("createAdvisorCaseAction");
    expect(form).toContain("uk_au");
    expect(form).toContain("uk_us");
    expect(list).toContain("CreateAdvisorCaseForm");
    expect(list).toContain("marketPackId");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/advisor-create-case.test.ts`

Expected: FAIL — `CreateAdvisorCaseForm.tsx` does not exist; `createAdvisorCaseAction` is not exported.

- [ ] **Step 3: Add the action, form and list badge**

Add to `src/app/actions/case-admin.ts`:

```ts
import { resolveMarketPack } from "@/domain/market-packs/registry";
import { MarketPackError } from "@/domain/market-packs/types";
import { createCaseRecord } from "@/server/cases";
import { prisma } from "@/lib/db";
import type { Tier } from "@/domain/types";

export type CreateAdvisorCaseResult =
  | { ok: true; caseId: string }
  | { ok: false; error: string };

export async function createAdvisorCaseAction(input: {
  clientEmail: string;
  title: string;
  entryContext: string;
  marketPackId: string;
  tier: string;
}): Promise<CreateAdvisorCaseResult> {
  const authResult = await requireAdvisorSession();
  if (!authResult.ok) {
    return authResult;
  }

  if (!ENTRY_CONTEXTS.includes(input.entryContext as EntryContext)) {
    return { ok: false, error: "Unknown entry context" };
  }

  const tier: Tier = input.tier === "FREE_DIY" ? "FREE_DIY" : "PAID_DWY";
  const title = input.title.trim();
  if (title.length === 0) {
    return { ok: false, error: "Give the case a title." };
  }

  try {
    resolveMarketPack(input.marketPackId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof MarketPackError ? err.message : "Unknown market pack",
    };
  }

  const client = await prisma.user.findUnique({
    where: { email: input.clientEmail.trim().toLowerCase() },
  });
  if (!client || client.role !== "CLIENT") {
    return { ok: false, error: "No client account exists for that email." };
  }

  try {
    const created = await createCaseRecord({
      title,
      entryContext: input.entryContext as EntryContext,
      tier,
      clientUserId: client.id,
      advisorUserId: authResult.userId,
      marketPackId: input.marketPackId,
    });
    revalidateCasePaths(created.id);
    return { ok: true, caseId: created.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

Extend `mapError` so `MarketPackError` returns `err.message`.

Create `src/components/CreateAdvisorCaseForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createAdvisorCaseAction } from "@/app/actions/case-admin";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import { listMarketPacks } from "@/domain/market-packs/registry";
import { ENTRY_CONTEXTS } from "@/domain/types";

const ENABLED_PACKS = listMarketPacks().filter((pack) => pack.enabled);

export function CreateAdvisorCaseForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-8 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      action={async (formData) => {
        setError(null);
        const result = await createAdvisorCaseAction({
          clientEmail: String(formData.get("clientEmail") ?? ""),
          title: String(formData.get("title") ?? ""),
          entryContext: String(formData.get("entryContext") ?? ""),
          marketPackId: String(formData.get("marketPackId") ?? ""),
          tier: String(formData.get("tier") ?? "PAID_DWY"),
        });
        if (!result.ok) {
          setError(result.error);
        }
      }}
    >
      <h2 className="text-lg font-medium text-slate-900">Open a corridor case</h2>
      <p className="text-sm text-slate-600">
        Use this for UK → Australia and UK → United States. Do not reassign an
        existing case — stage keys differ across spines.
      </p>
      <ActionErrorBanner error={error} />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Client email</span>
        <input
          name="clientEmail"
          type="email"
          required
          defaultValue="client@example.com"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Case title</span>
        <input
          name="title"
          required
          placeholder="Patel UK→AU purchase (paid)"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Market pack</span>
        <select
          name="marketPackId"
          defaultValue="uk_au"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {ENABLED_PACKS.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.id} · {pack.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Entry context</span>
        <select
          name="entryContext"
          defaultValue="RETURNER_OVERSEAS"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {ENTRY_CONTEXTS.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="tier" value="PAID_DWY" />
      <button
        type="submit"
        className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
      >
        Create case
      </button>
    </form>
  );
}
```

In `src/server/cases.ts` change `listCasesForUser` to include `marketPackId`:

```ts
export async function listCasesForUser(
  userId: string,
): Promise<
  Array<{ id: string; title: string; tier: string; leadSource: string; marketPackId: string }>
> {
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
    marketPackId: participant.case.marketPackId,
  }));
}
```

In `src/app/cockpit/cases/page.tsx` import `CreateAdvisorCaseForm` and render it above the list. Show the pack id on each row:

```tsx
import { CreateAdvisorCaseForm } from "@/components/CreateAdvisorCaseForm";

      <CreateAdvisorCaseForm />

                <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {c.leadSource.replace(/_/g, " ").toLowerCase()}
                </span>
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {c.marketPackId}
                </span>
```

If `src/app/portal/page.tsx` maps `listCasesForUser` rows, add `marketPackId` to that destructure so TypeScript still compiles. Do not add the advisor form to the portal.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/advisor-create-case.test.ts tests/server/market-pack-resolution.test.ts tests/domain/case-admin.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/case-admin.ts src/components/CreateAdvisorCaseForm.tsx src/server/cases.ts src/app/cockpit/cases/page.tsx src/app/portal/page.tsx tests/server/advisor-create-case.test.ts
git commit -m "feat: let advisors open enabled corridor cases without reassigning spines"
```

---

### Task 10: Demo script and README

**Files:**
- Create: `docs/superpowers/plans/demo-script-corridor-packs.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the four enabled corridor packs, seed logins (`advisor@example.com`, `client@example.com`, password `password`), `/start`, `/cockpit/market-packs`, `/cockpit/cases`.
- Produces: a founder walkthrough that proves bidirectional corridors, destination-driven spines, the disabled `au` stub, self-serve inbound packs, advisor-created outbound packs, and the explicit non-goals.

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-corridor-packs.md`:

````md
# Corridor market packs demo script

Founder validation script for the **bidirectional corridor** thesis: the stage engine stays country-agnostic; destination jurisdiction owns the legal spine; AU↔UK and US↔UK are four enabled packs; the disabled `au` stub is still not a domestic Australia product.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. Re-seed is required so the four corridor cases and pack-scoped panel members exist. All logins use password `password`.

---

## 1. Six packs in the inspector, one of them still a stub

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Confirm the sorted list: `au` (disabled), `au_uk` (active), `ew` (active), `uk_au` (active), `uk_us` (active), `us_uk` (active).
3. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory` **on**. `corridor_inbound`, `corridor_outbound`, `hard_client_sla`, `document_vault` **off**. Stage table still includes **Chain-free position**.
4. Select **`au`**. Still disabled. `finance_path` is present, playbooks are empty, every module is off. `resolveMarketPack("au")` still refuses to back a case.
5. This stub is architecture proof. It is not the Australia product.

## 2. Inbound-to-E&W corridors reuse the E&W spine without chain-free

1. Select **`au_uk`**. Jurisdiction `england_wales`, locale `en-GB · GBP`.
2. Modules: `fx_deposit`, `corridor_inbound`, `corridor_outbound` **on**. `chain_free_inventory`, `partner_speed_rails`, `hard_client_sla` **off**.
3. Stages are the nine E&W legal keys (`mortgage_path`, `exchange_complete`). There is **no** `chain_free_matching`.
4. Click **returner overseas**. `purchase_profile` requires `profile_complete, corridor_intent`. `money_readiness` requires `source_of_funds, fx_plan`. `move_logistics` requires `move_quote, departure_plan, vehicle_path, visa_status`.
5. Select **`us_uk`**. Same E&W spine and the same three corridor flags. Copy names the United States as origin.

## 3. Outbound corridors use destination law

1. Select **`uk_au`**. Jurisdiction `australia`, locale `en-AU · AUD`, region noun `state`.
2. Stage keys include `finance_path` and `settlement_complete`. They do **not** include `mortgage_path` or `exchange_complete`.
3. Partner labels: mortgage broker, conveyancer, removalist.
4. Select **`uk_us`**. Jurisdiction `united_states`, locale `en-US · USD`. Stage keys include `finance_path` and `closing_complete`. Conveyancer label is **closing attorney**.

## 4. Seeded cases run on the existing engine

1. `/cockpit/cases`. Confirm four new titles with pack badges: **Chen AU→UK return (paid)** (`au_uk`), **Morales US→UK return (paid)** (`us_uk`), **Patel UK→AU purchase (paid)** (`uk_au`), **Hughes UK→US purchase (paid)** (`uk_us`).
2. Open **Chen**. Timeline has nine stages. Playbook on `purchase_profile` names Australia → England & Wales and `corridor_intent`. Warm-intro dropdown offers the `au_uk` panel (Priya / Tom / Dan copies), not the `ew`-only rows alone.
3. Open **Patel**. Timeline shows **Finance path** and **Settlement → complete**. Disclosure on a warm intro uses Australian introducer-only wording (no credit assistance).
4. Open **Hughes**. Timeline shows **Closing**. Partner label in the owner banner is **closing attorney** when that stage is active.

## 5. Diaspora self-serve can pick inbound packs only

1. Sign out → `/start`.
2. The form has **Which corridor are you buying on?** with `England & Wales`, `Australia → England & Wales`, and `United States → England & Wales`. `uk_au` and `uk_us` are absent.
3. Choose **Australia → England & Wales**. The region prompt changes to the `au_uk` copy. Submit a throwaway account if you want; the new case's `marketPackId` is `au_uk` and it has no chain-free stage.

## 6. Advisors open outbound cases; they do not reassign spines

1. Back as advisor on `/cockpit/cases`.
2. **Open a corridor case**: client `client@example.com`, title `Demo UK→AU extra`, pack `uk_au`, entry `returner overseas`.
3. The new case appears with badge `uk_au` and the AU spine.
4. There is no control to change `marketPackId` on an existing case. Entry context can still change; pack cannot.

## 7. What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | Four enabled corridor packs; destination-driven spines; corridor flags; local disclosure; self-serve `au_uk`/`us_uk`; advisor-created `uk_au`/`uk_us`; pack-scoped panel rows; inspector + seed |
| **Stubbed** | Partner adapters and inbound webhooks stay Plan 5 stubs. Hard client SLAs stay off. |
| **Absent** | Domestic AU-only / US-only products, enabling the `au` stub, seller inventory, private seller–buyer introductions, chain-free on corridor packs, speed rails on corridor packs, Prisma schema changes, EntryContext rename |

---

## Automated verification

```bash
npm test -- tests/domain/corridor.test.ts tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/uk-us-pack.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts tests/domain/intake.test.ts tests/server/signup.test.ts tests/server/advisor-create-case.test.ts tests/domain/engine-country-agnostic.test.ts
```
````

- [ ] **Step 2: Point README and the market-pack demo at the new packs**

In `docs/superpowers/plans/demo-script-market-packs.md`:

1. Section 1 step 2: the list is now six packs, not two. Name them.
2. Section 1 step 4: `corridor_inbound` / `corridor_outbound` are **on for corridor packs only**; they stay **off** on `ew` and `au`.
3. Replace section 4 step 3 ("Corridor product work stays Plan 7") with:

```md
3. This stub still proves the registry can hold a disabled pack. Live AU destination work is `uk_au`. Live AU→E&W work is `au_uk`. Walkthrough: [`demo-script-corridor-packs.md`](demo-script-corridor-packs.md).
```

In `README.md` Market packs section:

1. Add rows to the layer table for `corridor.ts`, `au-uk-*.ts`, `us-uk-*.ts`, `uk-au-*.ts`, `uk-us-*.ts`, `au-disclosure.ts`, `us-disclosure.ts`.
2. Replace the module-toggles paragraph with:

```md
**Module toggles are data, not scattered ifs.** `MarketFlags` on the pack are read through
`isModuleEnabled`. The `ew` pack runs `fx_deposit`, `partner_speed_rails` and
`chain_free_inventory`. The four corridor packs (`au_uk`, `uk_au`, `us_uk`, `uk_us`)
run `fx_deposit`, `corridor_inbound` and `corridor_outbound`. `hard_client_sla` and
`document_vault` stay **off** in every pack. `chain_free_inventory` and
`partner_speed_rails` stay **ew-only**. Enforced by `tests/domain/market-pack-flags.test.ts`.
```

3. Replace the `au` stub paragraph with:

```md
**`au` is still a stub, not a product.** It stays registered and `enabled: false`.
Live Australia destination work is the `uk_au` corridor pack. Domestic AU-only and
US-only packs wait until these corridors are proven.

**Corridor packs (Plan 7).** Destination jurisdiction owns the legal spine:
`au_uk` / `us_uk` reuse England & Wales (`mortgage_path`, `exchange_complete`);
`uk_au` uses `finance_path` + `settlement_complete`; `uk_us` uses `finance_path` +
`closing_complete`. `/start` can open `ew`, `au_uk` and `us_uk`. Advisors open
`uk_au` and `uk_us` from the cockpit. Packs are not reassigned on a live case.

Walkthrough: [`docs/superpowers/plans/demo-script-corridor-packs.md`](docs/superpowers/plans/demo-script-corridor-packs.md).
```

Do not rename `EntryContext` in the README known-limitation paragraph.

- [ ] **Step 3: Full verification**

Run: `npm test`

Expected: PASS, no failing files. Confirm specifically that `tests/domain/market-pack-flags.test.ts`, `tests/domain/market-pack-registry.test.ts`, `tests/domain/ew-pack.test.ts`, `tests/domain/intake.test.ts`, `tests/domain/engine-country-agnostic.test.ts`, `tests/server/signup.test.ts`, `tests/server/panel.test.ts` and `tests/server/chain-free-policy.test.ts` are green.

Run: `npm run build`

Expected: `✓ Compiled successfully` with no TypeScript errors.

Run: `npm run db:push && npm run db:seed`

Expected: both exit 0. Seeded corridor cases load in the cockpit.

- [ ] **Step 4: Manual smoke check**

`npm run dev`, then walk sections 1–6 of `docs/superpowers/plans/demo-script-corridor-packs.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/demo-script-corridor-packs.md docs/superpowers/plans/demo-script-market-packs.md README.md
git commit -m "docs: corridor packs demo script and README bidirectional positioning"
```

---

## Self-review notes

**Spec coverage:**
- §9 Phase 5 "first corridor AU↔UK (bidirectional), then US↔UK; domestic AU/US packs only after corridor proof" → Tasks 2–5 ship the four corridor packs; Task 4 keeps `au` disabled; no domestic AU/US product.
- §10 country-agnostic engine; local mortgage/conveyancing/consumer law/panels → Task 1 helpers have no jurisdiction literals; Tasks 2–3 reuse E&W law; Tasks 4–5 ship AU/US disclosure, milestones, labels and close-stage names.
- §10 "Think AU↔UK, US↔UK — not only into the UK" → inbound packs `au_uk`/`us_uk` and outbound packs `uk_au`/`uk_us`.
- §13 sub-project 7 → this entire plan.
- §7 buyer-side only / no estate-agency → playbook guards in Tasks 1–5; demo script Absent row.
- §9 dependency rule remainder → `hard_client_sla` stays gated; `chain_free_inventory` and `partner_speed_rails` stay ew-only (Task 6 matrix).

**Non-goals honoured:** no Prisma schema change; no `EntryContext` rename; no enabling the `au` stub; no seller inventory; no hard client SLA; no chain-free or speed-rails on corridor packs; no rebuild of Plans 1–6 except the `ewLegalSpine` / `ewLegalPlaybooks` extracts required for reuse without the chain-free overlay.

**Placeholder scan:** no TBD / TODO / "implement later" / "similar to Task N". Every new export is named in a task Interfaces block and reused with the same spelling later.

**Type-consistency ledger:**
- Pack ids are `au_uk`, `uk_au`, `us_uk`, `uk_us`.
- `CORRIDOR_PACK_IDS` is the sorted tuple `["au_uk", "uk_au", "uk_us", "us_uk"]`.
- `SELF_SERVE_MARKET_PACK_IDS` is `["ew", "au_uk", "us_uk"]`.
- Evidence kinds: `corridor_intent`, `departure_plan`, `visa_status`, plus destination-local `pre_approval`, `settlement_confirmed`, `closing_agent_instructed`, `inspection_complete`, `closing_confirmed`.
- `CorridorPlaybookCopy` fields are `originName`, `destinationName`, `currencyPair`, `visaLabel`.
- `ParsedIntake.marketPackId: string` is always set.
- `createAdvisorCaseAction` returns `{ ok: true; caseId: string } | { ok: false; error: string }`.
- `listCasesForUser` rows include `marketPackId`.
- Lead sources added: `DIASPORA_UK_AU`, `DIASPORA_UK_US`.

**Existing tests that must change, and why:** `market-pack-flags` gated list (corridor flags become real); registry list snapshot (four new ids); inspector (corridor summary); intake / signup (new field); attribution enumerations; `listCasesForUser` consumers that need `marketPackId`. `ew-pack` and `ew-playbook` must stay green after the legal-spine extract. Chain-free and speed-rails tests stay green because those flags remain ew-only.

**Deliberate non-migration:** existing E&W cases keep their pack and stages. Corridor cases are new rows. There is no `setMarketPack` helper — YAGNI, and stage-key mismatch would corrupt `saveCase`.
