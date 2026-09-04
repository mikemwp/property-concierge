# Core Stage Engine & Dual Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working England & Wales Property Concierge app where a household case runs on a rigid stage ledger, clients see who is blocking, and a named advisor can advance/pause/block stages from a cockpit — with free DIY deliberately limited so paid done-with-you is the real product.

**Architecture:** Next.js App Router monolith with a pure TypeScript domain stage engine (no framework imports) tested under Vitest; Prisma persists cases/stages/actors; role-gated UI for client portal, advisor cockpit, and light partner view. England & Wales is the first **market pack** config; the engine stays country-agnostic.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma + SQLite (Postgres-ready), Vitest, Tailwind CSS, Auth.js (NextAuth v5) credentials/dev provider for v1 roles.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md`

**Follow-on plans (not this plan):** partner scorecards + referral plumbing; marketing/acquisition funnel; document vault uploads; deep partner APIs; chain-free module; additional market packs.

## Global Constraints

- Product generality: stage names and domain must not assume “international only”; entry context is metadata (`RETURNER_OVERSEAS` | `RETURNER_IN_UK` | `UK_RESIDENT_SPEED`).
- Geography v1: England & Wales only (`marketPackId: "ew"`); Scotland/NI out of scope.
- Exactly one current stage owner per case at a time.
- Free DIY is a funnel, not a substitute — IP and verified gate clearing stay behind `PAID_DWY` (done-with-you).
- Manual partner ops OK behind clean interfaces (`PartnerPort` types); no real third-party API integrations in this plan.
- Portal is source of truth; do not build email-as-workflow.
- TDD: failing test → implement → pass → commit per task.
- DRY/YAGNI: no chain-free inventory, no hard SLAs, no FCA advice engine, no Rightmove search.

## File structure (locked)

```
package.json
vitest.config.ts
prisma/schema.prisma
prisma/seed.ts
src/
  domain/
    types.ts                 # shared domain types/enums
    market-packs/ew.ts       # E&W stage template + checklist branching
    stage-engine.ts          # pure stage ledger operations
    freemium.ts              # what free vs paid may see/do
    escalation.ts            # days-in-stage / SLA helpers
  lib/
    db.ts                    # Prisma client
    auth.ts                  # Auth.js config + role helpers
    partner-port.ts          # PartnerPort interface (manual stub)
  server/
    cases.ts                 # server actions / use-cases wrapping engine + db
  app/
    layout.tsx
    page.tsx                 # marketing stub (CTA only)
    (auth)/login/page.tsx
    portal/
      layout.tsx
      cases/[caseId]/page.tsx
    cockpit/
      layout.tsx
      cases/[caseId]/page.tsx
      cases/page.tsx
    partner/
      layout.tsx
      cases/[caseId]/page.tsx
  components/
    StageTimeline.tsx
    CurrentOwnerBanner.tsx
    EvidenceForm.tsx
tests/
  domain/
    stage-engine.test.ts
    freemium.test.ts
    escalation.test.ts
    ew-pack.test.ts
```

---

### Task 1: Scaffold app, Vitest, Prisma

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `prisma/schema.prisma`, `src/lib/db.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`, `README.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: none
- Produces: runnable `npm test`, `npm run dev`; Prisma client export `prisma` from `src/lib/db.ts`

- [ ] **Step 1: Write the failing smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("loads the domain package path alias", async () => {
    const mod = await import("../src/domain/types");
    expect(mod).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/smoke.test.ts`

Expected: FAIL (missing vitest config and/or `src/domain/types.ts`)

- [ ] **Step 3: Scaffold project**

From repo root:

```bash
npm init -y
npm install next@15 react@19 react-dom@19
npm install -D typescript @types/node @types/react @types/react-dom vitest tsx prisma
npm install @prisma/client
npx tsc --init
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create minimal `src/domain/types.ts`:

```ts
export type EntryContext =
  | "RETURNER_OVERSEAS"
  | "RETURNER_IN_UK"
  | "UK_RESIDENT_SPEED";

export type Tier = "FREE_DIY" | "PAID_DWY";

export type ActorRole =
  | "CLIENT"
  | "ADVISOR"
  | "MORTGAGE_PARTNER"
  | "CONVEYANCER"
  | "MOVE_PARTNER";

export type StageStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "DONE" | "SKIPPED";
```

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      String
  createdAt DateTime @default(now())
  cases     CaseParticipant[]
}

model Case {
  id            String   @id @default(cuid())
  marketPackId  String
  entryContext  String
  tier          String
  title         String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  stages        Stage[]
  participants  CaseParticipant[]
  events        StageEvent[]
}

model CaseParticipant {
  id     String @id @default(cuid())
  caseId String
  userId String
  role   String
  case   Case   @relation(fields: [caseId], references: [id])
  user   User   @relation(fields: [userId], references: [id])

  @@unique([caseId, userId])
}

model Stage {
  id              String    @id @default(cuid())
  caseId          String
  key             String
  title           String
  sortOrder       Int
  status          String
  ownerRole       String
  dueAt           DateTime?
  activatedAt     DateTime?
  completedAt     DateTime?
  blockedReason   String?
  case            Case      @relation(fields: [caseId], references: [id])
  evidence        Evidence[]

  @@unique([caseId, key])
}

model Evidence {
  id        String   @id @default(cuid())
  stageId   String
  kind      String
  note      String?
  accepted  Boolean  @default(false)
  createdAt DateTime @default(now())
  stage     Stage    @relation(fields: [stageId], references: [id])
}

model StageEvent {
  id        String   @id @default(cuid())
  caseId    String
  stageKey  String
  type      String
  actorRole String
  payload   String?
  createdAt DateTime @default(now())
  case      Case     @relation(fields: [caseId], references: [id])
}
```

Create `.env`:

```
DATABASE_URL="file:./dev.db"
```

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

Create stub `src/app/layout.tsx` and `src/app/page.tsx` (marketing CTA placeholder). Add `.gitignore` for `node_modules`, `.next`, `.env`, `*.db`.

Run: `npx prisma db push`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS for `tests/smoke.test.ts`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts next.config.ts prisma src tests .gitignore .env.example README.md
git commit -m "chore: scaffold Next.js app with Vitest and Prisma"
```

Do not commit `.env` or `*.db`. Put `DATABASE_URL` in `.env.example` only.

---

### Task 2: England & Wales market pack stage template

**Files:**
- Create: `src/domain/market-packs/ew.ts`, `src/domain/market-packs/types.ts`
- Modify: `src/domain/types.ts` (if needed)
- Test: `tests/domain/ew-pack.test.ts`

**Interfaces:**
- Consumes: `EntryContext` from `src/domain/types.ts`
- Produces:
  - `MarketPack` type
  - `ewMarketPack: MarketPack`
  - `getStageTemplate(pack: MarketPack, entry: EntryContext): StageTemplate[]`
  - `StageTemplate = { key: string; title: string; defaultOwnerRole: ActorRole; slaDays: number; requiredEvidenceKinds: string[]; freeVisible: boolean; freeCanSelfAdvance: boolean }`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/ew-pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ewMarketPack, getStageTemplate } from "../../src/domain/market-packs/ew";

describe("ew market pack", () => {
  it("returns nine canonical stage keys in order", () => {
    const stages = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS");
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
  });

  it("does not use international-only stage titles", () => {
    const stages = getStageTemplate(ewMarketPack, "UK_RESIDENT_SPEED");
    expect(stages.every((s) => !/homecoming|international/i.test(s.title))).toBe(
      true,
    );
  });

  it("marks verified finance gates as not free-self-advanceable", () => {
    const stages = getStageTemplate(ewMarketPack, "RETURNER_OVERSEAS");
    const money = stages.find((s) => s.key === "money_readiness");
    expect(money?.freeCanSelfAdvance).toBe(false);
    expect(money?.freeVisible).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/ew-pack.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement market pack**

Create `src/domain/market-packs/types.ts`:

```ts
import type { ActorRole, EntryContext } from "../types";

export type StageTemplate = {
  key: string;
  title: string;
  defaultOwnerRole: ActorRole;
  slaDays: number;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
};

export type MarketPack = {
  id: string;
  name: string;
  jurisdiction: "england_wales";
  buildStages: (entry: EntryContext) => StageTemplate[];
};

export function getStageTemplate(
  pack: MarketPack,
  entry: EntryContext,
): StageTemplate[] {
  return pack.buildStages(entry);
}
```

Create `src/domain/market-packs/ew.ts` exporting `ewMarketPack` whose `buildStages` returns the nine stages with titles:

- Purchase profile
- Money readiness
- Mortgage path
- Move logistics
- Search readiness
- Offer → instruct
- Diligence
- Exchange → complete
- Settle (light)

Rules inside `buildStages`:
- `purchase_profile`: owner `CLIENT`, `freeCanSelfAdvance: true`, `slaDays: 3`
- `money_readiness`, `mortgage_path`, `offer_instruct`, `diligence`, `exchange_complete`: `freeCanSelfAdvance: false`
- For `UK_RESIDENT_SPEED`, `money_readiness.requiredEvidenceKinds` omits `fx_plan`; for returner contexts include `fx_plan`
- `move_logistics` always present; required evidence kinds may include `move_quote` for all; add `vehicle_path` only when entry is `RETURNER_OVERSEAS`

Re-export `getStageTemplate` from `ew.ts` for the test import path above (or update test to import from `types.ts` — keep test imports working).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/ew-pack.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs tests/domain/ew-pack.test.ts src/domain/types.ts
git commit -m "feat: add England & Wales market pack stage template"
```

---

### Task 3: Stage engine — create case and single active owner

**Files:**
- Create: `src/domain/stage-engine.ts`
- Test: `tests/domain/stage-engine.test.ts`

**Interfaces:**
- Consumes: `StageTemplate`, `getStageTemplate`, `ewMarketPack`, domain types
- Produces:
  - `CaseState` in-memory type
  - `createCase(input): CaseState`
  - `getCurrentStage(case): StageState | null`
  - Invariants: exactly one `ACTIVE` stage after create; its `ownerRole` set

```ts
export type StageState = {
  key: string;
  title: string;
  sortOrder: number;
  status: StageStatus;
  ownerRole: ActorRole;
  dueAt: string | null; // ISO
  activatedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
  acceptedEvidenceKinds: string[];
};

export type CaseState = {
  id: string;
  marketPackId: string;
  entryContext: EntryContext;
  tier: Tier;
  stages: StageState[];
  events: Array<{
    type: string;
    stageKey: string;
    actorRole: ActorRole;
    at: string;
    payload?: string;
  }>;
};

export function createCase(input: {
  id: string;
  entryContext: EntryContext;
  tier: Tier;
  marketPackId?: string;
  now?: Date;
}): CaseState;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createCase, getCurrentStage } from "../../src/domain/stage-engine";

describe("createCase", () => {
  it("activates purchase_profile owned by CLIENT and only one ACTIVE stage", () => {
    const c = createCase({
      id: "case_1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      now: new Date("2026-09-04T10:00:00.000Z"),
    });
    const active = c.stages.filter((s) => s.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].key).toBe("purchase_profile");
    expect(active[0].ownerRole).toBe("CLIENT");
    expect(getCurrentStage(c)?.key).toBe("purchase_profile");
    expect(c.marketPackId).toBe("ew");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/stage-engine.test.ts`

Expected: FAIL — `createCase` not defined

- [ ] **Step 3: Implement `createCase` and `getCurrentStage`**

In `src/domain/stage-engine.ts`: build stages from `ewMarketPack` when `marketPackId` is `"ew"` or omitted; set first stage `ACTIVE` with `activatedAt`/`dueAt = now + slaDays`; all others `PENDING`; append event `CASE_CREATED`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/stage-engine.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/stage-engine.ts tests/domain/stage-engine.test.ts
git commit -m "feat: create case with single active stage owner"
```

---

### Task 4: Stage engine — submit evidence, advance, pause, block

**Files:**
- Modify: `src/domain/stage-engine.ts`
- Modify: `tests/domain/stage-engine.test.ts`

**Interfaces:**
- Produces:
  - `submitEvidence(case, { stageKey, kind, actorRole, now? }): CaseState`
  - `acceptEvidence(case, { stageKey, kind, actorRole, now? }): CaseState` — advisor/partner only
  - `advanceStage(case, { actorRole, now? }): CaseState` — completes current if evidence satisfied; activates next; sets owner from template
  - `blockStage(case, { reason, actorRole, now? }): CaseState`
  - `pauseStage` = block with reason prefix `PAUSED:` OR explicit `pauseStage`
  - `assertSingleActive(case)` used internally; throw `StageEngineError` on invariant break

Rules:
- Clients on `PAID_DWY` may submit evidence; only `ADVISOR` or matching partner role may `acceptEvidence` and `advanceStage` for non-`freeCanSelfAdvance` stages
- On advance: previous `DONE` + `completedAt`; next `ACTIVE`; event `STAGE_ADVANCED`
- Cannot advance if required evidence kinds not all accepted

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/stage-engine.test.ts`:

```ts
describe("advanceStage", () => {
  it("refuses advance when required evidence missing", () => {
    let c = createCase({
      id: "case_2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    // force current to money_readiness for a focused test by advancing profile first
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
    c = advanceStage(c, { actorRole: "ADVISOR" });
    expect(() => advanceStage(c, { actorRole: "ADVISOR" })).toThrow(
      /evidence/i,
    );
  });

  it("keeps exactly one ACTIVE stage after a successful advance", () => {
    let c = createCase({
      id: "case_3",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
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
    c = advanceStage(c, { actorRole: "ADVISOR" });
    expect(c.stages.filter((s) => s.status === "ACTIVE")).toHaveLength(1);
    expect(getCurrentStage(c)?.key).toBe("money_readiness");
  });
});
```

Ensure `purchase_profile.requiredEvidenceKinds` includes `profile_complete` in the E&W pack (update pack + pack tests if needed in this same task).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/stage-engine.test.ts`

Expected: FAIL — functions missing

- [ ] **Step 3: Implement evidence + advance + block**

Implement pure functions returning new `CaseState` (immutable updates). Throw `StageEngineError` with clear messages: `NO_ACTIVE_STAGE`, `EVIDENCE_INCOMPLETE`, `FORBIDDEN_ROLE`, `ALREADY_ACCEPTED`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/stage-engine.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/stage-engine.ts src/domain/market-packs tests/domain/stage-engine.test.ts
git commit -m "feat: advance, evidence, and block rules in stage engine"
```

---

### Task 5: Freemium gating

**Files:**
- Create: `src/domain/freemium.ts`
- Test: `tests/domain/freemium.test.ts`

**Interfaces:**
- Consumes: `CaseState`, `Tier`, stage flags
- Produces:
  - `canViewStage(case, stageKey): boolean`
  - `canSelfAdvance(case, stageKey): boolean`
  - `canUseWarmIntro(case): boolean` — true only for `PAID_DWY`
  - `canViewPlaybook(case, stageKey): boolean` — false for `FREE_DIY`
  - `clientStageView(case): PublicStageView[]` — strips playbook/IP fields for free

```ts
export type PublicStageView = {
  key: string;
  title: string;
  status: StageStatus;
  ownerRole: ActorRole | null; // null if free and stage not freeVisible detail
  daysInStage: number | null;
  isCurrent: boolean;
  limited: boolean; // true when free user sees teaser only
};
```

Rules from spec:
- Free sees high-level map / that stages exist
- Free cannot warm-intro, cannot see advisor playbooks, cannot clear verified gates
- Paid is default product path — `limited: true` teasers should encourage upgrade

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import {
  canSelfAdvance,
  canUseWarmIntro,
  canViewPlaybook,
  clientStageView,
} from "../../src/domain/freemium";

describe("freemium", () => {
  it("blocks warm intro and playbooks on FREE_DIY", () => {
    const c = createCase({
      id: "f1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(canUseWarmIntro(c)).toBe(false);
    expect(canViewPlaybook(c, "money_readiness")).toBe(false);
    expect(canSelfAdvance(c, "money_readiness")).toBe(false);
  });

  it("marks non-free stages limited on free tier views", () => {
    const c = createCase({
      id: "f2",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    const views = clientStageView(c, new Date("2026-09-04T10:00:00.000Z"));
    const money = views.find((v) => v.key === "money_readiness");
    expect(money?.limited).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/freemium.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement freemium helpers**

Implement `src/domain/freemium.ts` per interfaces. For free users, `clientStageView` still lists all nine keys/titles (map orientation) but sets `limited: true` and clears owner detail for stages where `freeVisible` detail should be teaser-only — specifically any stage with `freeCanSelfAdvance === false` beyond the current teaser rules: show status as `LOCKED` visually via `limited` + `ownerRole: null` when not the simple free-advanceable current stage.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/freemium.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/freemium.ts tests/domain/freemium.test.ts
git commit -m "feat: freemium gating keeps DIY from replacing paid"
```

---

### Task 6: Escalation / days-in-stage

**Files:**
- Create: `src/domain/escalation.ts`
- Test: `tests/domain/escalation.test.ts`

**Interfaces:**
- Produces:
  - `daysInStage(stage, now): number`
  - `isOverSla(stage, slaDays, now): boolean`
  - `escalationLevel(stage, slaDays, now): "OK" | "WARN" | "BREACH"`
    - WARN at `slaDays`, BREACH at `slaDays * 1.5` (ceil)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { escalationLevel, daysInStage } from "../../src/domain/escalation";
import type { StageState } from "../../src/domain/stage-engine";

const base: StageState = {
  key: "purchase_profile",
  title: "Purchase profile",
  sortOrder: 0,
  status: "ACTIVE",
  ownerRole: "CLIENT",
  dueAt: null,
  activatedAt: "2026-09-01T10:00:00.000Z",
  completedAt: null,
  blockedReason: null,
  requiredEvidenceKinds: [],
  freeVisible: true,
  freeCanSelfAdvance: true,
  acceptedEvidenceKinds: [],
};

describe("escalation", () => {
  it("returns BREACH when well past SLA", () => {
    expect(
      escalationLevel(base, 3, new Date("2026-09-10T10:00:00.000Z")),
    ).toBe("BREACH");
    expect(daysInStage(base, new Date("2026-09-04T10:00:00.000Z"))).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/escalation.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement escalation helpers**

Pure date math using UTC date floors; export from `src/domain/escalation.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/escalation.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/escalation.ts tests/domain/escalation.test.ts
git commit -m "feat: days-in-stage escalation levels for portal pressure"
```

---

### Task 7: Persist cases via Prisma + server use-cases

**Files:**
- Create: `src/server/cases.ts`, `src/server/mappers.ts`
- Create: `prisma/seed.ts`
- Test: `tests/server/cases.roundtrip.test.ts`

**Interfaces:**
- Consumes: stage engine + prisma
- Produces:
  - `createCaseRecord(input): Promise<CaseState>`
  - `loadCase(caseId): Promise<CaseState>`
  - `saveCase(case: CaseState): Promise<void>` — writes stages, evidence accept flags, events
  - `listCasesForUser(userId): Promise<Array<{ id: string; title: string; tier: string }>>`

- [ ] **Step 1: Write the failing round-trip test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase } from "../../src/server/cases";
import { advanceStage, acceptEvidence, submitEvidence } from "../../src/domain/stage-engine";

describe("cases persistence", () => {
  beforeAll(async () => {
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: { id: "user_client", email: "client@example.com", role: "CLIENT" },
    });
    await prisma.user.create({
      data: { id: "user_advisor", email: "advisor@example.com", role: "ADVISOR" },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("round-trips a created case", async () => {
    const created = await createCaseRecord({
      title: "Bloggs return",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
    });
    const loaded = await loadCase(created.id);
    expect(loaded.stages).toHaveLength(9);
    expect(loaded.stages.filter((s) => s.status === "ACTIVE")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/cases.roundtrip.test.ts`

Expected: FAIL — server module missing

- [ ] **Step 3: Implement mappers + `createCaseRecord` / `loadCase` / `saveCase`**

Map `CaseState` ↔ Prisma models. On create: insert Case, participants, all Stage rows, initial event. `Case` model is named `Case` in Prisma — use `prisma.case` carefully (Prisma allows it).

Also implement `saveCase` used after engine transitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx prisma db push` then `npx vitest run tests/server/cases.roundtrip.test.ts`

Expected: PASS

- [ ] **Step 5: Add seed + commit**

`prisma/seed.ts` creates advisor `advisor@example.com`, client `client@example.com`, partner users, and one demo `PAID_DWY` case + one `FREE_DIY` case.

```bash
git add src/server prisma/seed.ts tests/server
git commit -m "feat: persist cases and stage ledger with Prisma"
```

---

### Task 8: Auth and role-gated route shells

**Files:**
- Create: `src/lib/auth.ts`, `src/app/(auth)/login/page.tsx`, `src/app/portal/layout.tsx`, `src/app/cockpit/layout.tsx`, `src/app/partner/layout.tsx`, `src/middleware.ts`
- Modify: `package.json` (add `next-auth@5` / `auth` package)
- Test: `tests/lib/auth-roles.test.ts`

**Interfaces:**
- Produces: `auth()` session with `user.id`, `user.role`
- `requireRole(role | role[])` helper
- Middleware: `/portal` requires CLIENT (or ADVISOR read-only optional — keep CLIENT+ADVISOR), `/cockpit` requires ADVISOR, `/partner` requires partner roles

For v1 use Auth.js Credentials provider against seeded users (password `password` hashed with bcryptjs) — local only.

- [ ] **Step 1: Write the failing role helper test**

```ts
import { describe, it, expect } from "vitest";
import { roleCanAccess } from "../../src/lib/auth-roles";

describe("roleCanAccess", () => {
  it("allows advisor into cockpit", () => {
    expect(roleCanAccess("ADVISOR", "cockpit")).toBe(true);
    expect(roleCanAccess("CLIENT", "cockpit")).toBe(false);
    expect(roleCanAccess("CONVEYANCER", "partner")).toBe(true);
  });
});
```

Put pure helper in `src/lib/auth-roles.ts` so it is unit-testable without Next runtime.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/auth-roles.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement auth-roles + Auth.js wiring + layouts**

Implement credentials login page; protect layouts by redirecting to `/login`.

- [ ] **Step 4: Run unit test + manual check**

Run: `npx vitest run tests/lib/auth-roles.test.ts`  
Expected: PASS  

Manual: `npm run dev` → login as seeded advisor → `/cockpit` loads shell.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth-roles.ts src/app src/middleware.ts tests/lib/auth-roles.test.ts package.json package-lock.json
git commit -m "feat: role-gated portal, cockpit, and partner shells"
```

---

### Task 9: Client portal case view

**Files:**
- Create: `src/components/StageTimeline.tsx`, `src/components/CurrentOwnerBanner.tsx`, `src/components/UpgradeCallout.tsx`, `src/app/portal/cases/[caseId]/page.tsx`, `src/app/portal/page.tsx`
- Create: `src/app/actions/portal.ts` (server actions: submit evidence on free-advanceable / paid-allowed)
- Test: `tests/domain/freemium.test.ts` already covers gating; add `tests/components` only if using shallow render — prefer domain tests + manual UI check to avoid heavy RTL setup unless already installed

**Interfaces:**
- Page loads case via `loadCase`, renders `clientStageView`
- Shows `CurrentOwnerBanner` with owner role + days in stage + escalation level
- Free users see `UpgradeCallout` whenever `limited` stages exist
- Submit evidence form only when `canSelfAdvance` or paid client submit allowed by engine

- [ ] **Step 1: Write failing server-action policy test**

Create `tests/server/portal-actions.test.ts` testing a pure policy function `assertPortalSubmit(case, stageKey, tier)` living in `src/server/portal-policy.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertPortalSubmit } from "../../src/server/portal-policy";

describe("assertPortalSubmit", () => {
  it("throws for free user on money_readiness", () => {
    const c = createCase({
      id: "p1",
      entryContext: "RETURNER_OVERSEAS",
      tier: "FREE_DIY",
    });
    expect(() => assertPortalSubmit(c, "money_readiness")).toThrow(/upgrade|paid|forbidden/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/portal-actions.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement policy + portal UI**

Implement components with Tailwind. Timeline lists stages; current stage highlighted; blocker owner named for paid; teaser for free.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all PASS

Manual: login as free client — see upgrade callouts; login as paid client — see owner banner and evidence submit on profile stage.

- [ ] **Step 5: Commit**

```bash
git add src/components src/app/portal src/app/actions src/server/portal-policy.ts tests/server/portal-actions.test.ts
git commit -m "feat: client portal timeline with freemium-limited view"
```

---

### Task 10: Advisor cockpit

**Files:**
- Create: `src/app/cockpit/cases/page.tsx`, `src/app/cockpit/cases/[caseId]/page.tsx`, `src/app/actions/cockpit.ts`, `src/components/AdvisorStageControls.tsx`, `src/components/WarmIntroButton.tsx`
- Create: `src/lib/partner-port.ts`
- Test: `tests/server/cockpit-actions.test.ts`

**Interfaces:**
- `PartnerPort = { requestWarmIntro(input: { caseId: string; partnerType: ActorRole; note: string }): Promise<{ ticketId: string }> }`
- `ManualPartnerPort` stub appends a `WARM_INTRO_REQUESTED` stage event via saveCase (no email)
- Cockpit actions: `acceptEvidenceAction`, `advanceAction`, `blockAction`, `warmIntroAction` — ADVISOR only

- [ ] **Step 1: Write failing test for warm intro requiring paid tier**

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertWarmIntro } from "../../src/server/cockpit-policy";

describe("assertWarmIntro", () => {
  it("rejects free cases", () => {
    const c = createCase({
      id: "w1",
      entryContext: "RETURNER_IN_UK",
      tier: "FREE_DIY",
    });
    expect(() => assertWarmIntro(c)).toThrow(/paid/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/cockpit-actions.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement cockpit policy, PartnerPort stub, UI controls**

Advisor page shows full stage IP/playbook placeholder text (`Playbook: chase lender pack within 48h`) only in cockpit, never on free portal.

- [ ] **Step 4: Run tests + manual advance path**

Run: `npm test`  
Manual: advisor accepts profile evidence, advances to money_readiness, requests warm intro to `MORTGAGE_PARTNER` — event appears on case.

- [ ] **Step 5: Commit**

```bash
git add src/app/cockpit src/app/actions/cockpit.ts src/components src/lib/partner-port.ts src/server/cockpit-policy.ts tests/server/cockpit-actions.test.ts
git commit -m "feat: advisor cockpit with advance controls and warm-intro port"
```

---

### Task 11: Partner mini-view + end-to-end demo script

**Files:**
- Create: `src/app/partner/cases/[caseId]/page.tsx`, `src/app/actions/partner.ts`
- Create: `docs/superpowers/plans/demo-script-core-portal.md`
- Modify: `README.md` with run instructions
- Test: `tests/server/partner-actions.test.ts`

**Interfaces:**
- Partner may submit evidence on stages where `ownerRole` matches their role and status is `ACTIVE` or `BLOCKED`
- Partner cannot advance (advisor advances after accept) — keeps control with orchestrator
- `assertPartnerSubmit(case, role, stageKey)`

- [ ] **Step 1: Write failing partner policy test**

```ts
import { describe, it, expect } from "vitest";
import { createCase, advanceStage, acceptEvidence, submitEvidence } from "../../src/domain/stage-engine";
import { assertPartnerSubmit } from "../../src/server/partner-policy";

describe("assertPartnerSubmit", () => {
  it("allows conveyancer only when they own the active stage", () => {
    let c = createCase({
      id: "cv1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(() =>
      assertPartnerSubmit(c, "CONVEYANCER", "purchase_profile"),
    ).toThrow(/owner/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/partner-actions.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement partner policy + mini UI + README demo script**

README sections: setup, seed logins, happy-path demo (free vs paid difference), test command.

Demo script doc: step-by-step clicks for founder validation of the rigid portal thesis.

- [ ] **Step 4: Run full suite**

Run: `npm test`

Expected: all PASS

Run: `npm run build`

Expected: Next.js build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/partner src/server/partner-policy.ts src/app/actions/partner.ts tests/server/partner-actions.test.ts README.md docs/superpowers/plans/demo-script-core-portal.md
git commit -m "feat: partner mini-view and core portal demo script"
```

---

## Plan self-review

**Spec coverage (this plan only — Plan 1):**
| Spec item | Task |
|---|---|
| Country-agnostic stages + E&W pack | 2, 3 |
| Entry context metadata | 2, 3, 7 |
| Single current owner + pressure/escalation | 3, 4, 6, 9 |
| Free funnel vs paid product / IP gating | 5, 9, 10 |
| Client portal + advisor cockpit | 9, 10 |
| Partner mini-view light | 11 |
| Manual ops behind clean PartnerPort | 10 |
| No Rightmove / no hard SLA / no chain-free | Global constraints + omitted tasks |
| International-ready (no UK hardcode in engine) | 2–4 (pack vs engine split) |

**Deferred to later plans:** referral fee plumbing, scorecards aggregation UI, document vault binary uploads, Auth.js production providers, marketing diaspora pages, FX/mortgage real integrations, guarantees, AU/US packs.

**Placeholder scan:** none intentional — stack pinned; passwords only for local seed.

**Type consistency:** `CaseState` / `StageState` / `EntryContext` / `Tier` / `ActorRole` shared from domain; server mappers adapt Prisma strings ↔ unions.
