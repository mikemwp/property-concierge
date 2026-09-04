# Partner Panel, Scorecards & Referral Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the manual warm-intro port from Plans 1–2 into a curated partner network: a persisted `PartnerPanel` of named firms/people, scorecards derived purely from the existing stage ledger (time-in-stage, miss rate, completions, portal participation, SLA breaches), referral records with fee status and a disclosure text/timestamp that the client portal shows, advisor tools to nudge / re-route / demote partners, and a names-only directory for Free DIY cases.

**Architecture:** Same Next.js App Router monolith. Two new Prisma models (`PartnerPanel`, `Referral`) hang off the existing `User` and `Case`. All scoring, disclosure copy and partner-ops transitions are pure domain modules under `src/domain/` that consume the existing `CaseState` ledger and `src/domain/escalation.ts`; thin server modules under `src/server/` persist and aggregate; server actions keep the existing `{ ok: true } | { ok: false; error }` shape. `ManualPartnerPort` is deepened (named panel member in the `WARM_INTRO_REQUESTED` payload) without any third-party API. Nudge and re-route are new `StageEvent` types (`PARTNER_NUDGED`, `PARTNER_REROUTED`) appended through the existing `saveCase`, so scorecards read them from the same ledger as everything else.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§4 pressure model, §5 freemium discipline, §7 monetisation/partners/regulatory posture, §8 system shape + failure behaviour, §9 dependency rule, §13 sub-project 3).

**Builds on (already shipped, do not rebuild):**
- `docs/superpowers/plans/2026-09-04-core-stage-portal.md` — stage engine (`src/domain/stage-engine.ts`: `CaseState`, `StageState`, events, `submittedEvidenceKinds`), `ManualPartnerPort` (`src/lib/partner-port.ts`), `attachPartnerParticipant` (`src/server/case-access.ts`), partner mini-view (`src/app/partner/*`), `src/domain/escalation.ts` (`daysInStage`, `isOverSla`, `escalationLevel`), freemium gating (`src/domain/freemium.ts`).
- `docs/superpowers/plans/2026-09-04-acquisition-ops-playbook.md` — lead attribution on `Case` (`leadSource/leadCampaign/leadReferrer`, **do not rebuild**), marketing/signup, funnel page, `CaseAdminControls` pattern, `ActionErrorBanner`.

**Follow-on plans (not this plan):** deep partner APIs (speed rails), chain-free overlay, hard client-facing SLAs / guarantee dates, document vault, market-pack configuration UI, FCA Appointed Representative status, actual fee payout / invoicing.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include this section.

- **Curated panel, not a marketplace:** "Small curated panel, not an open marketplace". "Contracted on: response SLA, portal participation, referral disclosure, quality score from ledger". Panel membership is advisor-managed; there is no partner self-signup.
- **Scorecards come from the ledger only:** "Partner quality = time-in-stage, miss rate, completion rate from the same ledger". "Partner scorecard (derived from ledger)". No manual star ratings, no free-text scores.
- **Dependency rule:** "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real. Speed credibility is earned in the ledger first." This plan produces scorecards; it does **not** surface any SLA promise to clients.
- **Failure behaviour:** "Partner non-response → nudge + scorecard hit + advisor re-route". Nudge and re-route are advisor actions recorded on the case ledger and counted in the scorecard.
- **Manual ops behind clean interfaces:** "Manual partner ops in v1 behind clean APIs/interfaces so deeper integrations can land without rewrite". Deepen `PartnerPort`; no real third-party calls.
- **Referral event shape:** "Referral event (partner, case, fee status, disclosure record)". Fees are **recorded**, never paid or invoiced by this system.
- **Regulatory posture (E&W):** "Mortgage: introducer only; no advice". "Conveyancing referrals: lawful if disclosed". "Buyer-side orchestrator: avoid estate-agency activity". "Do not start as an FCA Appointed Representative." Every referral carries disclosure text; mortgage disclosure text must state introducer-only / no advice.
- **Freemium discipline:** Free DIY gets "Partner directory (not warm intro)"; paid gets "warm intros to named mortgage / conveyancer / removals (and related) partners". "Free may earn light disclosed referral if user self-selects a directory partner" — supported via advisor-marked referrals, still disclosed. Paid CTA stays primary in any directory copy.
- **IP behind paid:** "Partner routing logic and warm-intro threads" and "Escalation rules and advisor cockpit behaviours" render in `/cockpit` only. Scorecards, quality scores, SLA days and nudge/re-route controls never appear in `/portal` or `/partner`.
- **Geography v1:** England & Wales only; `marketPackId` stays `"ew"`. Disclosure copy is E&W wording; the domain module keys copy by `ActorRole`, not by country.
- **Explicit non-goals in this plan:** deep partner APIs, chain-free, hard client-facing SLAs, document vault, market-pack config UI, FCA AR, actual fee payouts (record only), partner-facing scorecards, partner self-service panel edits.
- **Engineering:** TDD (failing test → implement → pass → commit) per task; pure domain modules import no framework or Prisma code; server actions follow the existing `{ ok: true } | { ok: false; error }` shape; existing tests must keep passing (`npm test`); `npm run build` must pass at the end; DRY, YAGNI.

## File structure (locked)

```
prisma/
  schema.prisma                         # MODIFY: PartnerPanel + Referral models; User.panelMember; Case.referrals
  seed.ts                               # MODIFY: clear + seed 5 panel members (3 linked to partner logins, 1 inactive)
src/
  domain/
    types.ts                            # MODIFY: PARTNER_ROLES + isPartnerActorRole
    panel.ts                            # NEW: PanelMember type, DirectoryEntry, directoryEntries, canViewDirectory (pure)
    referral.ts                         # NEW: FeeStatus/ReferralSource/ReferralRecord, transitions, E&W disclosure copy (pure)
    scorecard.ts                        # NEW: attribution, per-stage outcomes, quality score, rating (pure; uses escalation.ts)
    partner-ops.ts                      # NEW: nudgePartner / reroutePartner CaseState transitions (pure)
  server/
    panel.ts                            # NEW: PartnerNetworkError, listPanel, getPanelMember, findActivePanelMemberForRole, setPanelMemberActive
    referrals.ts                        # NEW: createReferral, listReferralsForCase, activeReferralForRole, supersedeActiveReferrals, setReferralFeeStatus
    scorecards.ts                       # NEW: loadPanelScorecards (aggregates referrals → cases → buildScorecard)
    case-access.ts                      # MODIFY: attachPartnerParticipant(preferredUserId), detachPartnerParticipant
    cockpit-policy.ts                   # MODIFY: assertReroute
  lib/
    partner-port.ts                     # MODIFY: warm intro carries panelMemberId + panelMemberName
  app/
    actions/
      cockpit.ts                        # MODIFY: warmIntroAction(caseId, panelMemberId, note) → referral + participant
      partner-network.ts                # NEW: setPanelActiveAction, markReferralAction, setFeeStatusAction, nudgePartnerAction, reroutePartnerAction
    cockpit/
      layout.tsx                        # MODIFY: "Partner panel" nav link
      panel/page.tsx                    # NEW: panel list + scorecards + demote/reinstate
      cases/[caseId]/page.tsx           # MODIFY: named warm intro, referral panel, nudge / re-route controls
    portal/
      cases/[caseId]/page.tsx           # MODIFY: referral disclosure (any tier with referrals) + free DIY directory
  components/
    WarmIntroButton.tsx                 # MODIFY: pick a named panel member
    PanelTable.tsx                      # NEW (client): scorecard table + demote/reinstate
    ReferralPanel.tsx                   # NEW (client): referral list, fee status, advisor mark
    PartnerOpsControls.tsx              # NEW (client): nudge + re-route
    ReferralDisclosure.tsx              # NEW: client-facing disclosure list
    PartnerDirectory.tsx                # NEW: names/categories only + paid CTA
tests/
  domain/panel.test.ts                  # NEW
  domain/referral.test.ts               # NEW
  domain/scorecard.test.ts              # NEW
  domain/partner-ops.test.ts            # NEW
  server/panel.test.ts                  # NEW (DB)
  server/referrals.test.ts              # NEW (DB)
  server/scorecards.test.ts             # NEW (DB)
  server/warm-intro.test.ts             # NEW (DB): ManualPartnerPort payload + participant attach/detach
  server/cockpit-actions.test.ts        # MODIFY: assertReroute
docs/
  superpowers/plans/demo-script-partner-network.md   # NEW
README.md                               # MODIFY: panel, scorecards, referrals, seed table
```

**Attribution rule (used by Tasks 3, 5, 8 — read before implementing):** a partner-owned stage is attributed to a panel member through a `Referral` on that case whose `partnerRole` equals the stage's `ownerRole`. The stage counts if it has `activatedAt`, was not activated after the referral's `supersededAt` (set when the advisor re-routes away from that partner), and was not completed before the referral was created. Time-in-stage is measured from `activatedAt` to the earliest of `completedAt`, `supersededAt`, or `now`. SLA for miss/breach is the **panel member's** `slaDays` (their contracted response SLA), evaluated with the existing `isOverSla` / `escalationLevel` from `src/domain/escalation.ts`.

---

### Task 1: PartnerPanel model, domain panel types, server panel module, seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Create: `src/domain/panel.ts`
- Create: `src/server/panel.ts`
- Test: `tests/domain/panel.test.ts`
- Test: `tests/server/panel.test.ts`

**Interfaces:**
- Consumes: `ActorRole` from `src/domain/types.ts`; `CaseState` from `src/domain/stage-engine.ts`; `prisma` from `src/lib/db.ts`.
- Produces:
  - `type PanelMember = { id: string; roleType: ActorRole; name: string; firm: string | null; active: boolean; slaDays: number; userId: string | null }`
  - `type DirectoryEntry = { roleType: ActorRole; name: string; firm: string | null }`
  - `directoryEntries(members: PanelMember[]): DirectoryEntry[]` — active only, sorted by roleType then name, no ids/SLA/userId
  - `canViewDirectory(caseState: CaseState): boolean` — `true` only for `FREE_DIY`
  - `class PartnerNetworkError extends Error`
  - `toPanelMember(row: PartnerPanel): PanelMember`
  - `listPanel(options?: { activeOnly?: boolean }): Promise<PanelMember[]>`
  - `getPanelMember(id: string): Promise<PanelMember | null>`
  - `findActivePanelMemberForRole(role: ActorRole): Promise<PanelMember | null>` — prefers members linked to a login
  - `setPanelMemberActive(id: string, active: boolean): Promise<PanelMember>`
  - Prisma models `PartnerPanel` and `Referral` (Referral is populated in Task 5; the schema lands here so there is one `db push`).

- [ ] **Step 1: Add the Prisma models**

In `prisma/schema.prisma`, add `panelMember PartnerPanel?` to `User`, `referrals Referral[]` to `Case`, and the two new models at the end of the file:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  role         String
  passwordHash String
  createdAt    DateTime @default(now())
  cases        CaseParticipant[]
  panelMember  PartnerPanel?
}

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
  referrals     Referral[]
}
```

Append after `StageEvent`:

```prisma
model PartnerPanel {
  id        String     @id @default(cuid())
  roleType  String
  name      String
  firm      String?
  active    Boolean    @default(true)
  slaDays   Int
  userId    String?    @unique
  createdAt DateTime   @default(now())
  user      User?      @relation(fields: [userId], references: [id], onDelete: SetNull)
  referrals Referral[]
}

model Referral {
  id             String       @id @default(cuid())
  caseId         String
  partnerId      String
  partnerRole    String
  source         String
  feeStatus      String
  disclosureText String
  disclosedAt    DateTime
  supersededAt   DateTime?
  createdAt      DateTime     @default(now())
  case           Case         @relation(fields: [caseId], references: [id], onDelete: Cascade)
  partner        PartnerPanel @relation(fields: [partnerId], references: [id], onDelete: Cascade)
}
```

`onDelete: Cascade` / `SetNull` keep the existing test suites' `prisma.case.deleteMany()` / `prisma.user.deleteMany()` working without modification.

- [ ] **Step 2: Push the schema and regenerate the client**

Run: `npm run db:push`
Expected: `Your database is now in sync with your Prisma schema.` and `✔ Generated Prisma Client`.

- [ ] **Step 3: Write the failing domain test**

Create `tests/domain/panel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  canViewDirectory,
  directoryEntries,
  type PanelMember,
} from "../../src/domain/panel";
import { createCase } from "../../src/domain/stage-engine";

const members: PanelMember[] = [
  {
    id: "p_conv_b",
    roleType: "CONVEYANCER",
    name: "Lena Okoro",
    firm: "Greenway Conveyancing",
    active: true,
    slaDays: 5,
    userId: null,
  },
  {
    id: "p_mort_inactive",
    roleType: "MORTGAGE_PARTNER",
    name: "Ravi Patel",
    firm: "Ledger Mortgages",
    active: false,
    slaDays: 3,
    userId: null,
  },
  {
    id: "p_mort_a",
    roleType: "MORTGAGE_PARTNER",
    name: "Priya Nair",
    firm: "Northstar Mortgages",
    active: true,
    slaDays: 3,
    userId: "seed_mortgage_partner",
  },
  {
    id: "p_conv_a",
    roleType: "CONVEYANCER",
    name: "Tom Ashby",
    firm: "Harbour Law LLP",
    active: true,
    slaDays: 5,
    userId: "seed_conveyancer",
  },
];

describe("directoryEntries", () => {
  it("lists active members only, sorted by role then name, with names and categories only", () => {
    const entries = directoryEntries(members);
    expect(entries).toEqual([
      { roleType: "CONVEYANCER", name: "Lena Okoro", firm: "Greenway Conveyancing" },
      { roleType: "CONVEYANCER", name: "Tom Ashby", firm: "Harbour Law LLP" },
      { roleType: "MORTGAGE_PARTNER", name: "Priya Nair", firm: "Northstar Mortgages" },
    ]);
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(["firm", "name", "roleType"]);
    }
  });
});

describe("canViewDirectory", () => {
  it("is true for free DIY cases and false for paid cases", () => {
    const free = createCase({ id: "d1", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" });
    const paid = createCase({ id: "d2", entryContext: "RETURNER_IN_UK", tier: "PAID_DWY" });
    expect(canViewDirectory(free)).toBe(true);
    expect(canViewDirectory(paid)).toBe(false);
  });
});
```

- [ ] **Step 4: Run the domain test to verify it fails**

Run: `npx vitest run tests/domain/panel.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/panel"`.

- [ ] **Step 5: Implement `src/domain/panel.ts`**

```ts
import type { CaseState } from "./stage-engine";
import type { ActorRole } from "./types";

export type PanelMember = {
  id: string;
  roleType: ActorRole;
  name: string;
  firm: string | null;
  active: boolean;
  slaDays: number;
  userId: string | null;
};

/** What a Free DIY client may see: names and categories only. No SLA, no ids, no scores. */
export type DirectoryEntry = {
  roleType: ActorRole;
  name: string;
  firm: string | null;
};

export function directoryEntries(members: PanelMember[]): DirectoryEntry[] {
  return members
    .filter((member) => member.active)
    .sort((left, right) =>
      left.roleType !== right.roleType
        ? left.roleType.localeCompare(right.roleType)
        : left.name.localeCompare(right.name),
    )
    .map((member) => ({
      roleType: member.roleType,
      name: member.name,
      firm: member.firm,
    }));
}

/** Spec §5: free gets a partner directory, not a warm intro. Paid gets named intros instead. */
export function canViewDirectory(caseState: CaseState): boolean {
  return caseState.tier === "FREE_DIY";
}
```

- [ ] **Step 6: Run the domain test to verify it passes**

Run: `npx vitest run tests/domain/panel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Write the failing server test**

Create `tests/server/panel.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import {
  findActivePanelMemberForRole,
  getPanelMember,
  listPanel,
  setPanelMemberActive,
} from "../../src/server/panel";

describe("panel persistence", () => {
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
    await prisma.user.create({
      data: {
        id: "panel_mortgage_user",
        email: "panel-mortgage@example.com",
        role: "MORTGAGE_PARTNER",
        passwordHash,
      },
    });
    await prisma.partnerPanel.createMany({
      data: [
        {
          id: "panel_mort_linked",
          roleType: "MORTGAGE_PARTNER",
          name: "Priya Nair",
          firm: "Northstar Mortgages",
          slaDays: 3,
          userId: "panel_mortgage_user",
        },
        {
          id: "panel_mort_unlinked",
          roleType: "MORTGAGE_PARTNER",
          name: "Aaron Blake",
          firm: null,
          slaDays: 3,
        },
        {
          id: "panel_conv_inactive",
          roleType: "CONVEYANCER",
          name: "Zed Legal",
          firm: "Zed Legal LLP",
          slaDays: 5,
          active: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists members ordered by role then name and filters to active", async () => {
    const all = await listPanel();
    expect(all.map((m) => m.id)).toEqual([
      "panel_conv_inactive",
      "panel_mort_unlinked",
      "panel_mort_linked",
    ]);
    const active = await listPanel({ activeOnly: true });
    expect(active.map((m) => m.id)).toEqual(["panel_mort_unlinked", "panel_mort_linked"]);
  });

  it("maps rows to PanelMember with a typed role and nullable link", async () => {
    const member = await getPanelMember("panel_mort_linked");
    expect(member).toEqual({
      id: "panel_mort_linked",
      roleType: "MORTGAGE_PARTNER",
      name: "Priya Nair",
      firm: "Northstar Mortgages",
      active: true,
      slaDays: 3,
      userId: "panel_mortgage_user",
    });
    expect(await getPanelMember("missing")).toBeNull();
  });

  it("prefers an active member with a linked login for a role", async () => {
    const member = await findActivePanelMemberForRole("MORTGAGE_PARTNER");
    expect(member?.id).toBe("panel_mort_linked");
    expect(await findActivePanelMemberForRole("CONVEYANCER")).toBeNull();
  });

  it("demotes and reinstates a member", async () => {
    const demoted = await setPanelMemberActive("panel_mort_linked", false);
    expect(demoted.active).toBe(false);
    expect((await findActivePanelMemberForRole("MORTGAGE_PARTNER"))?.id).toBe(
      "panel_mort_unlinked",
    );
    const reinstated = await setPanelMemberActive("panel_mort_linked", true);
    expect(reinstated.active).toBe(true);
  });
});
```

- [ ] **Step 8: Run the server test to verify it fails**

Run: `npx vitest run tests/server/panel.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/server/panel"`.

- [ ] **Step 9: Implement `src/server/panel.ts`**

```ts
import type { PartnerPanel } from "@prisma/client";
import type { PanelMember } from "../domain/panel";
import type { ActorRole } from "../domain/types";
import { prisma } from "../lib/db";

export class PartnerNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerNetworkError";
  }
}

export function toPanelMember(row: PartnerPanel): PanelMember {
  return {
    id: row.id,
    roleType: row.roleType as ActorRole,
    name: row.name,
    firm: row.firm,
    active: row.active,
    slaDays: row.slaDays,
    userId: row.userId,
  };
}

export async function listPanel(
  options: { activeOnly?: boolean } = {},
): Promise<PanelMember[]> {
  const rows = await prisma.partnerPanel.findMany({
    where: options.activeOnly ? { active: true } : undefined,
    orderBy: [{ roleType: "asc" }, { name: "asc" }],
  });
  return rows.map(toPanelMember);
}

export async function getPanelMember(id: string): Promise<PanelMember | null> {
  const row = await prisma.partnerPanel.findUnique({ where: { id } });
  return row ? toPanelMember(row) : null;
}

/** Active member for a role; members with a portal login come first so intros land in the mini-view. */
export async function findActivePanelMemberForRole(
  role: ActorRole,
): Promise<PanelMember | null> {
  const rows = await prisma.partnerPanel.findMany({
    where: { roleType: role, active: true },
    orderBy: { name: "asc" },
  });
  const members = rows.map(toPanelMember);
  return members.find((m) => m.userId !== null) ?? members[0] ?? null;
}

export async function setPanelMemberActive(
  id: string,
  active: boolean,
): Promise<PanelMember> {
  const existing = await prisma.partnerPanel.findUnique({ where: { id } });
  if (!existing) {
    throw new PartnerNetworkError("Unknown panel member");
  }
  const row = await prisma.partnerPanel.update({ where: { id }, data: { active } });
  return toPanelMember(row);
}
```

- [ ] **Step 10: Run the server test to verify it passes**

Run: `npx vitest run tests/server/panel.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 11: Seed five panel members**

In `prisma/seed.ts`, add the two new tables to the cleanup block at the top of `main()` (before `stageEvent.deleteMany()`):

```ts
  await prisma.referral.deleteMany();
  await prisma.partnerPanel.deleteMany();
```

Then, immediately after the `prisma.user.createMany({ ... })` block that creates the three partner logins, add:

```ts
  await prisma.partnerPanel.createMany({
    data: [
      {
        id: "seed_panel_priya",
        roleType: "MORTGAGE_PARTNER",
        name: "Priya Nair",
        firm: "Northstar Mortgages",
        slaDays: 3,
        userId: "seed_mortgage_partner",
      },
      {
        id: "seed_panel_ravi",
        roleType: "MORTGAGE_PARTNER",
        name: "Ravi Patel",
        firm: "Ledger Mortgages",
        slaDays: 3,
        active: false,
      },
      {
        id: "seed_panel_tom",
        roleType: "CONVEYANCER",
        name: "Tom Ashby",
        firm: "Harbour Law LLP",
        slaDays: 5,
        userId: "seed_conveyancer",
      },
      {
        id: "seed_panel_lena",
        roleType: "CONVEYANCER",
        name: "Lena Okoro",
        firm: "Greenway Conveyancing",
        slaDays: 5,
      },
      {
        id: "seed_panel_dan",
        roleType: "MOVE_PARTNER",
        name: "Dan Whitfield",
        firm: "Compass Removals",
        slaDays: 4,
        userId: "seed_move_partner",
      },
    ],
  });
```

- [ ] **Step 12: Run the seed and the full suite**

Run: `npm run db:seed && npm test`
Expected: seed exits 0; all tests pass (existing suites unaffected because of cascade/set-null).

- [ ] **Step 13: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts src/domain/panel.ts src/server/panel.ts tests/domain/panel.test.ts tests/server/panel.test.ts
git commit -m "feat: curated partner panel model with directory projection and seed"
```

---

### Task 2: Referral domain — fee status, sources, E&W disclosure copy

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/referral.ts`
- Test: `tests/domain/referral.test.ts`

**Interfaces:**
- Consumes: `ActorRole` from `src/domain/types.ts`.
- Produces:
  - `PARTNER_ROLES: readonly ActorRole[]` and `isPartnerActorRole(role: ActorRole): boolean` (in `types.ts`)
  - `FEE_STATUSES = ["NONE","EXPECTED","RECEIVED","WAIVED"] as const`, `type FeeStatus`
  - `REFERRAL_SOURCES = ["WARM_INTRO","ADVISOR_MARK","REROUTE"] as const`, `type ReferralSource`
  - `type ReferralRecord = { id; caseId; partnerId; partnerName; partnerFirm: string | null; partnerRole: ActorRole; source: ReferralSource; feeStatus: FeeStatus; disclosureText: string; disclosedAt: string; supersededAt: string | null; createdAt: string }`
  - `isFeeStatus(value: string): value is FeeStatus`
  - `defaultFeeStatus(role: ActorRole): FeeStatus` — `"EXPECTED"` for partner roles, `"NONE"` otherwise
  - `canTransitionFee(from: FeeStatus, to: FeeStatus): boolean`
  - `disclosureTextFor(input: { role: ActorRole; partnerName: string; partnerFirm: string | null }): string`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/referral.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  canTransitionFee,
  defaultFeeStatus,
  disclosureTextFor,
  FEE_STATUSES,
  isFeeStatus,
} from "../../src/domain/referral";
import { isPartnerActorRole, PARTNER_ROLES } from "../../src/domain/types";

describe("partner roles", () => {
  it("identifies the three typed partner roles", () => {
    expect(PARTNER_ROLES).toEqual(["MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"]);
    expect(isPartnerActorRole("CONVEYANCER")).toBe(true);
    expect(isPartnerActorRole("CLIENT")).toBe(false);
    expect(isPartnerActorRole("ADVISOR")).toBe(false);
  });
});

describe("fee status", () => {
  it("guards the closed set", () => {
    for (const status of FEE_STATUSES) {
      expect(isFeeStatus(status)).toBe(true);
    }
    expect(isFeeStatus("PAID")).toBe(false);
  });

  it("defaults to EXPECTED for partner roles and NONE otherwise", () => {
    expect(defaultFeeStatus("MORTGAGE_PARTNER")).toBe("EXPECTED");
    expect(defaultFeeStatus("CONVEYANCER")).toBe("EXPECTED");
    expect(defaultFeeStatus("MOVE_PARTNER")).toBe("EXPECTED");
    expect(defaultFeeStatus("CLIENT")).toBe("NONE");
  });

  it("only allows forward transitions and treats RECEIVED / WAIVED as terminal", () => {
    expect(canTransitionFee("NONE", "EXPECTED")).toBe(true);
    expect(canTransitionFee("NONE", "WAIVED")).toBe(true);
    expect(canTransitionFee("EXPECTED", "RECEIVED")).toBe(true);
    expect(canTransitionFee("EXPECTED", "WAIVED")).toBe(true);
    expect(canTransitionFee("EXPECTED", "NONE")).toBe(false);
    expect(canTransitionFee("RECEIVED", "WAIVED")).toBe(false);
    expect(canTransitionFee("WAIVED", "EXPECTED")).toBe(false);
    expect(canTransitionFee("EXPECTED", "EXPECTED")).toBe(false);
  });
});

describe("disclosureTextFor (England & Wales)", () => {
  it("states introducer-only and no advice for mortgage partners", () => {
    const text = disclosureTextFor({
      role: "MORTGAGE_PARTNER",
      partnerName: "Priya Nair",
      partnerFirm: "Northstar Mortgages",
    });
    expect(text).toContain("Priya Nair (Northstar Mortgages)");
    expect(text).toMatch(/introducer only/i);
    expect(text).toMatch(/do not give mortgage advice/i);
    expect(text).toMatch(/free to use any mortgage adviser/i);
  });

  it("discloses a referral fee and freedom to instruct for conveyancers", () => {
    const text = disclosureTextFor({
      role: "CONVEYANCER",
      partnerName: "Lena Okoro",
      partnerFirm: null,
    });
    expect(text).toContain("Lena Okoro");
    expect(text).not.toContain("(");
    expect(text).toMatch(/referral fee/i);
    expect(text).toMatch(/free to instruct any conveyancer/i);
  });

  it("discloses commission for move partners", () => {
    const text = disclosureTextFor({
      role: "MOVE_PARTNER",
      partnerName: "Dan Whitfield",
      partnerFirm: "Compass Removals",
    });
    expect(text).toMatch(/commission/i);
    expect(text).toMatch(/free to use any removals/i);
  });

  it("never promises outcomes and rejects non-partner roles", () => {
    for (const role of ["MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"] as const) {
      const text = disclosureTextFor({ role, partnerName: "X", partnerFirm: null });
      expect(text).not.toMatch(/guarantee/i);
    }
    expect(() =>
      disclosureTextFor({ role: "CLIENT", partnerName: "X", partnerFirm: null }),
    ).toThrow(/partner roles/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/domain/referral.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/referral"`.

- [ ] **Step 3: Add partner role helpers to `src/domain/types.ts`**

Append to the end of `src/domain/types.ts`:

```ts
export const PARTNER_ROLES: readonly ActorRole[] = [
  "MORTGAGE_PARTNER",
  "CONVEYANCER",
  "MOVE_PARTNER",
];

export function isPartnerActorRole(role: ActorRole): boolean {
  return PARTNER_ROLES.includes(role);
}
```

- [ ] **Step 4: Implement `src/domain/referral.ts`**

```ts
import { isPartnerActorRole, type ActorRole } from "./types";

export const FEE_STATUSES = ["NONE", "EXPECTED", "RECEIVED", "WAIVED"] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

export const REFERRAL_SOURCES = ["WARM_INTRO", "ADVISOR_MARK", "REROUTE"] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** Spec §8: "Referral event (partner, case, fee status, disclosure record)". Fees are recorded, never paid here. */
export type ReferralRecord = {
  id: string;
  caseId: string;
  partnerId: string;
  partnerName: string;
  partnerFirm: string | null;
  partnerRole: ActorRole;
  source: ReferralSource;
  feeStatus: FeeStatus;
  disclosureText: string;
  disclosedAt: string;
  supersededAt: string | null;
  createdAt: string;
};

export function isFeeStatus(value: string): value is FeeStatus {
  return (FEE_STATUSES as readonly string[]).includes(value);
}

export function isReferralSource(value: string): value is ReferralSource {
  return (REFERRAL_SOURCES as readonly string[]).includes(value);
}

export function defaultFeeStatus(role: ActorRole): FeeStatus {
  return isPartnerActorRole(role) ? "EXPECTED" : "NONE";
}

const FEE_TRANSITIONS: Record<FeeStatus, readonly FeeStatus[]> = {
  NONE: ["EXPECTED", "WAIVED"],
  EXPECTED: ["RECEIVED", "WAIVED"],
  RECEIVED: [],
  WAIVED: [],
};

export function canTransitionFee(from: FeeStatus, to: FeeStatus): boolean {
  return FEE_TRANSITIONS[from].includes(to);
}

function displayName(partnerName: string, partnerFirm: string | null): string {
  return partnerFirm ? `${partnerName} (${partnerFirm})` : partnerName;
}

/**
 * England & Wales disclosure wording. Spec §7: mortgage = introducer only, no advice;
 * conveyancing referrals lawful if disclosed. Keyed by role so a future market pack can override.
 */
export function disclosureTextFor(input: {
  role: ActorRole;
  partnerName: string;
  partnerFirm: string | null;
}): string {
  const who = displayName(input.partnerName, input.partnerFirm);
  switch (input.role) {
    case "MORTGAGE_PARTNER":
      return `Property Concierge introduced you to ${who}. We act as an introducer only and do not give mortgage advice. We may receive an introducer fee from ${who} if you take a mortgage product through them. You are free to use any mortgage adviser.`;
    case "CONVEYANCER":
      return `Property Concierge referred you to ${who}. We may receive a referral fee from ${who} if you instruct them. You are free to instruct any conveyancer or solicitor.`;
    case "MOVE_PARTNER":
      return `Property Concierge referred you to ${who}. We may receive a commission from ${who} if you book with them. You are free to use any removals or relocation provider.`;
    default:
      throw new Error("Disclosure text applies to partner roles only");
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/domain/referral.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/referral.ts tests/domain/referral.test.ts
git commit -m "feat: referral fee status transitions and E&W disclosure copy"
```

---

### Task 3: Scorecard domain — attribution, stage outcomes, quality score, rating

**Files:**
- Create: `src/domain/scorecard.ts`
- Test: `tests/domain/scorecard.test.ts`

**Interfaces:**
- Consumes: `PanelMember` (Task 1); `CaseState`, `StageState` from `src/domain/stage-engine.ts`; `daysInStage`, `isOverSla`, `escalationLevel` from `src/domain/escalation.ts`; event types `EVIDENCE_SUBMITTED` (existing) and `PARTNER_NUDGED` (Task 4 — the scorecard only reads the string).
- Produces:
  - `type ScorecardAttribution = { caseState: CaseState; referralCreatedAt: string; supersededAt: string | null }`
  - `type StageOutcome = { caseId; stageKey; days: number; completed: boolean; missed: boolean; breached: boolean; participated: boolean; nudges: number }`
  - `type ScorecardRating = "NO_DATA" | "STRONG" | "WATCH" | "UNDERPERFORMING"`
  - `type PartnerScorecard = { partnerId; roleType; stagesAssigned; completions; openStages; missed; breaches; nudges; missRate; participationRate; avgDaysInStage: number | null; qualityScore; rating; recommendReroute: boolean }`
  - `type PanelScorecardRow = { member: PanelMember; scorecard: PartnerScorecard }`
  - `attributedStages(member, attribution): StageState[]`
  - `stageOutcome(member, attribution, stage, now: Date): StageOutcome`
  - `computeQualityScore(input: { missRate; participationRate; breaches; nudges }): number` (0–100)
  - `rateScorecard(input: { stagesAssigned; qualityScore; breaches }): ScorecardRating`
  - `summariseOutcomes(member, outcomes): PartnerScorecard`
  - `buildScorecard(member, attributions: ScorecardAttribution[], now: Date): PartnerScorecard`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/scorecard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PanelMember } from "../../src/domain/panel";
import {
  attributedStages,
  buildScorecard,
  computeQualityScore,
  rateScorecard,
  stageOutcome,
} from "../../src/domain/scorecard";
import {
  createCase,
  type CaseState,
  type StageState,
} from "../../src/domain/stage-engine";

const priya: PanelMember = {
  id: "p_priya",
  roleType: "MORTGAGE_PARTNER",
  name: "Priya Nair",
  firm: "Northstar Mortgages",
  active: true,
  slaDays: 3,
  userId: null,
};

function fixtureCase(
  id: string,
  mortgagePatch: Partial<StageState>,
  events: CaseState["events"] = [],
): CaseState {
  const base = createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
    now: new Date("2026-08-20T09:00:00.000Z"),
  });
  return {
    ...base,
    stages: base.stages.map((s) =>
      s.key === "mortgage_path" ? { ...s, ...mortgagePatch } : s,
    ),
    events: [...base.events, ...events],
  };
}

const referral = { referralCreatedAt: "2026-08-21T00:00:00.000Z", supersededAt: null };

describe("attributedStages", () => {
  it("returns only activated stages owned by the member's role", () => {
    const c = fixtureCase("a1", {
      status: "ACTIVE",
      activatedAt: "2026-09-01T10:00:00.000Z",
    });
    const stages = attributedStages(priya, { caseState: c, ...referral });
    expect(stages.map((s) => s.key)).toEqual(["mortgage_path"]);
  });

  it("ignores stages never activated and stages completed before the referral existed", () => {
    const pending = fixtureCase("a2", {});
    expect(attributedStages(priya, { caseState: pending, ...referral })).toEqual([]);

    const earlier = fixtureCase("a3", {
      status: "DONE",
      activatedAt: "2026-08-10T10:00:00.000Z",
      completedAt: "2026-08-15T10:00:00.000Z",
    });
    expect(attributedStages(priya, { caseState: earlier, ...referral })).toEqual([]);
  });

  it("ignores stages activated after the member was re-routed away", () => {
    const c = fixtureCase("a4", {
      status: "ACTIVE",
      activatedAt: "2026-09-10T10:00:00.000Z",
    });
    expect(
      attributedStages(priya, {
        caseState: c,
        referralCreatedAt: "2026-08-21T00:00:00.000Z",
        supersededAt: "2026-09-04T10:00:00.000Z",
      }),
    ).toEqual([]);
  });
});

describe("stageOutcome", () => {
  it("scores a completed stage inside SLA with partner participation", () => {
    const c = fixtureCase(
      "o1",
      {
        status: "DONE",
        activatedAt: "2026-09-01T10:00:00.000Z",
        completedAt: "2026-09-03T10:00:00.000Z",
      },
      [
        {
          type: "EVIDENCE_SUBMITTED",
          stageKey: "mortgage_path",
          actorRole: "MORTGAGE_PARTNER",
          at: "2026-09-02T10:00:00.000Z",
          payload: "dip_aip",
        },
      ],
    );
    const stage = c.stages.find((s) => s.key === "mortgage_path")!;
    const outcome = stageOutcome(
      priya,
      { caseState: c, ...referral },
      stage,
      new Date("2026-09-20T10:00:00.000Z"),
    );
    expect(outcome).toEqual({
      caseId: "o1",
      stageKey: "mortgage_path",
      days: 2,
      completed: true,
      missed: false,
      breached: false,
      participated: true,
      nudges: 0,
    });
  });

  it("marks an open, silent stage as missed and breached using the member SLA and counts nudges", () => {
    const c = fixtureCase(
      "o2",
      { status: "ACTIVE", activatedAt: "2026-09-01T10:00:00.000Z" },
      [
        {
          type: "PARTNER_NUDGED",
          stageKey: "mortgage_path",
          actorRole: "ADVISOR",
          at: "2026-09-05T10:00:00.000Z",
          payload: "MORTGAGE_PARTNER",
        },
      ],
    );
    const stage = c.stages.find((s) => s.key === "mortgage_path")!;
    const outcome = stageOutcome(
      priya,
      { caseState: c, ...referral },
      stage,
      new Date("2026-09-08T10:00:00.000Z"),
    );
    expect(outcome.days).toBe(7);
    expect(outcome.completed).toBe(false);
    expect(outcome.missed).toBe(true);
    expect(outcome.breached).toBe(true);
    expect(outcome.participated).toBe(false);
    expect(outcome.nudges).toBe(1);
  });

  it("caps time-in-stage at supersededAt after a re-route", () => {
    const c = fixtureCase("o3", {
      status: "ACTIVE",
      activatedAt: "2026-09-01T10:00:00.000Z",
    });
    const stage = c.stages.find((s) => s.key === "mortgage_path")!;
    const outcome = stageOutcome(
      priya,
      {
        caseState: c,
        referralCreatedAt: "2026-08-21T00:00:00.000Z",
        supersededAt: "2026-09-04T10:00:00.000Z",
      },
      stage,
      new Date("2026-09-20T10:00:00.000Z"),
    );
    expect(outcome.days).toBe(3);
    expect(outcome.missed).toBe(true);
    expect(outcome.breached).toBe(false);
  });
});

describe("computeQualityScore / rateScorecard", () => {
  it("starts at 100 and deducts for misses, silence, breaches and nudges", () => {
    expect(
      computeQualityScore({ missRate: 0, participationRate: 1, breaches: 0, nudges: 0 }),
    ).toBe(100);
    expect(
      computeQualityScore({ missRate: 1, participationRate: 0, breaches: 1, nudges: 1 }),
    ).toBe(13);
    expect(
      computeQualityScore({ missRate: 0.5, participationRate: 0.5, breaches: 0, nudges: 0 }),
    ).toBe(60);
    expect(
      computeQualityScore({ missRate: 1, participationRate: 0, breaches: 9, nudges: 9 }),
    ).toBe(0);
  });

  it("rates NO_DATA, STRONG, WATCH and UNDERPERFORMING", () => {
    expect(rateScorecard({ stagesAssigned: 0, qualityScore: 100, breaches: 0 })).toBe("NO_DATA");
    expect(rateScorecard({ stagesAssigned: 2, qualityScore: 80, breaches: 0 })).toBe("STRONG");
    expect(rateScorecard({ stagesAssigned: 2, qualityScore: 60, breaches: 0 })).toBe("WATCH");
    expect(rateScorecard({ stagesAssigned: 2, qualityScore: 40, breaches: 0 })).toBe(
      "UNDERPERFORMING",
    );
    expect(rateScorecard({ stagesAssigned: 4, qualityScore: 80, breaches: 2 })).toBe(
      "UNDERPERFORMING",
    );
  });
});

describe("buildScorecard", () => {
  it("returns NO_DATA with neutral rates when nothing is attributed", () => {
    const card = buildScorecard(priya, [], new Date("2026-09-08T10:00:00.000Z"));
    expect(card).toEqual({
      partnerId: "p_priya",
      roleType: "MORTGAGE_PARTNER",
      stagesAssigned: 0,
      completions: 0,
      openStages: 0,
      missed: 0,
      breaches: 0,
      nudges: 0,
      missRate: 0,
      participationRate: 1,
      avgDaysInStage: null,
      qualityScore: 100,
      rating: "NO_DATA",
      recommendReroute: false,
    });
  });

  it("aggregates across cases and recommends a re-route for underperformers", () => {
    const good = fixtureCase(
      "b1",
      {
        status: "DONE",
        activatedAt: "2026-09-01T10:00:00.000Z",
        completedAt: "2026-09-03T10:00:00.000Z",
      },
      [
        {
          type: "EVIDENCE_SUBMITTED",
          stageKey: "mortgage_path",
          actorRole: "MORTGAGE_PARTNER",
          at: "2026-09-02T10:00:00.000Z",
          payload: "dip_aip",
        },
      ],
    );
    const bad = fixtureCase("b2", {
      status: "ACTIVE",
      activatedAt: "2026-09-01T10:00:00.000Z",
    });
    const now = new Date("2026-09-08T10:00:00.000Z");

    const card = buildScorecard(
      priya,
      [
        { caseState: good, ...referral },
        { caseState: bad, ...referral },
      ],
      now,
    );

    expect(card.stagesAssigned).toBe(2);
    expect(card.completions).toBe(1);
    expect(card.openStages).toBe(1);
    expect(card.missed).toBe(1);
    expect(card.breaches).toBe(1);
    expect(card.missRate).toBe(0.5);
    expect(card.participationRate).toBe(0.5);
    expect(card.avgDaysInStage).toBe(4.5);
    expect(card.qualityScore).toBe(55);
    expect(card.rating).toBe("WATCH");
    expect(card.recommendReroute).toBe(false);

    const onlyBad = buildScorecard(priya, [{ caseState: bad, ...referral }], now);
    expect(onlyBad.rating).toBe("UNDERPERFORMING");
    expect(onlyBad.recommendReroute).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/domain/scorecard.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/scorecard"`.

- [ ] **Step 3: Implement `src/domain/scorecard.ts`**

```ts
import { daysInStage, escalationLevel, isOverSla } from "./escalation";
import type { PanelMember } from "./panel";
import type { CaseState, StageState } from "./stage-engine";
import type { ActorRole } from "./types";

/**
 * One referral's view of one case. `supersededAt` is set when the advisor re-routed
 * this role away from the member; attribution and time-in-stage stop there.
 */
export type ScorecardAttribution = {
  caseState: CaseState;
  referralCreatedAt: string;
  supersededAt: string | null;
};

export type StageOutcome = {
  caseId: string;
  stageKey: string;
  days: number;
  completed: boolean;
  missed: boolean;
  breached: boolean;
  participated: boolean;
  nudges: number;
};

export type ScorecardRating = "NO_DATA" | "STRONG" | "WATCH" | "UNDERPERFORMING";

/** Spec §4: "Partner quality = time-in-stage, miss rate, completion rate from the same ledger". */
export type PartnerScorecard = {
  partnerId: string;
  roleType: ActorRole;
  stagesAssigned: number;
  completions: number;
  openStages: number;
  missed: number;
  breaches: number;
  nudges: number;
  missRate: number;
  participationRate: number;
  avgDaysInStage: number | null;
  qualityScore: number;
  rating: ScorecardRating;
  recommendReroute: boolean;
};

export type PanelScorecardRow = {
  member: PanelMember;
  scorecard: PartnerScorecard;
};

export function attributedStages(
  member: PanelMember,
  attribution: ScorecardAttribution,
): StageState[] {
  const { caseState, referralCreatedAt, supersededAt } = attribution;
  return caseState.stages.filter((stage) => {
    if (stage.ownerRole !== member.roleType || stage.activatedAt === null) {
      return false;
    }
    if (supersededAt !== null && stage.activatedAt > supersededAt) {
      return false;
    }
    if (stage.completedAt !== null && stage.completedAt < referralCreatedAt) {
      return false;
    }
    return true;
  });
}

function windowEnd(
  stage: StageState,
  supersededAt: string | null,
  now: Date,
): Date {
  const candidates = [stage.completedAt, supersededAt]
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value).getTime());
  if (candidates.length === 0) {
    return now;
  }
  return new Date(Math.min(...candidates));
}

export function stageOutcome(
  member: PanelMember,
  attribution: ScorecardAttribution,
  stage: StageState,
  now: Date,
): StageOutcome {
  const { caseState, supersededAt } = attribution;
  const end = windowEnd(stage, supersededAt, now);
  const completedInWindow =
    stage.status === "DONE" &&
    stage.completedAt !== null &&
    (supersededAt === null || stage.completedAt <= supersededAt);
  const stageEvents = caseState.events.filter((e) => e.stageKey === stage.key);

  return {
    caseId: caseState.id,
    stageKey: stage.key,
    days: daysInStage(stage, end),
    completed: completedInWindow,
    missed: isOverSla(stage, member.slaDays, end),
    breached: escalationLevel(stage, member.slaDays, end) === "BREACH",
    participated: stageEvents.some(
      (e) => e.type === "EVIDENCE_SUBMITTED" && e.actorRole === member.roleType,
    ),
    nudges: stageEvents.filter((e) => e.type === "PARTNER_NUDGED").length,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeQualityScore(input: {
  missRate: number;
  participationRate: number;
  breaches: number;
  nudges: number;
}): number {
  const raw =
    100 -
    50 * input.missRate -
    30 * (1 - input.participationRate) -
    5 * Math.min(input.breaches, 4) -
    2 * Math.min(input.nudges, 5);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function rateScorecard(input: {
  stagesAssigned: number;
  qualityScore: number;
  breaches: number;
}): ScorecardRating {
  if (input.stagesAssigned === 0) {
    return "NO_DATA";
  }
  if (input.qualityScore < 50 || input.breaches >= 2) {
    return "UNDERPERFORMING";
  }
  if (input.qualityScore < 75) {
    return "WATCH";
  }
  return "STRONG";
}

export function summariseOutcomes(
  member: PanelMember,
  outcomes: StageOutcome[],
): PartnerScorecard {
  const stagesAssigned = outcomes.length;
  const completions = outcomes.filter((o) => o.completed).length;
  const missed = outcomes.filter((o) => o.missed).length;
  const breaches = outcomes.filter((o) => o.breached).length;
  const participated = outcomes.filter((o) => o.participated).length;
  const nudges = outcomes.reduce((sum, o) => sum + o.nudges, 0);

  const missRate = stagesAssigned === 0 ? 0 : round2(missed / stagesAssigned);
  const participationRate =
    stagesAssigned === 0 ? 1 : round2(participated / stagesAssigned);
  const avgDaysInStage =
    stagesAssigned === 0
      ? null
      : Math.round(
          (outcomes.reduce((sum, o) => sum + o.days, 0) / stagesAssigned) * 10,
        ) / 10;

  const qualityScore = computeQualityScore({
    missRate,
    participationRate,
    breaches,
    nudges,
  });
  const rating = rateScorecard({ stagesAssigned, qualityScore, breaches });

  return {
    partnerId: member.id,
    roleType: member.roleType,
    stagesAssigned,
    completions,
    openStages: stagesAssigned - completions,
    missed,
    breaches,
    nudges,
    missRate,
    participationRate,
    avgDaysInStage,
    qualityScore,
    rating,
    recommendReroute: rating === "UNDERPERFORMING",
  };
}

export function buildScorecard(
  member: PanelMember,
  attributions: ScorecardAttribution[],
  now: Date,
): PartnerScorecard {
  const outcomes = attributions.flatMap((attribution) =>
    attributedStages(member, attribution).map((stage) =>
      stageOutcome(member, attribution, stage, now),
    ),
  );
  return summariseOutcomes(member, outcomes);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/domain/scorecard.test.ts`
Expected: PASS (10 tests). If `days` in the "caps time-in-stage" test is off by one, re-check that `windowEnd` picks `supersededAt` (2026-09-04) — `daysInStage` floors to UTC days so 09-01 → 09-04 is 3.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scorecard.ts tests/domain/scorecard.test.ts
git commit -m "feat: partner scorecards derived from the stage ledger"
```

---

### Task 4: Partner ops domain — nudge and re-route ledger events

**Files:**
- Create: `src/domain/partner-ops.ts`
- Test: `tests/domain/partner-ops.test.ts`

**Interfaces:**
- Consumes: `getFocusStage`, `StageEngineError`, `CaseState` from `src/domain/stage-engine.ts`; `isPartnerActorRole` (Task 2).
- Produces:
  - `nudgePartner(caseState, input: { actorRole: ActorRole; now?: Date }): CaseState` — appends `PARTNER_NUDGED` on the focus stage; payload = owner role.
  - `reroutePartner(caseState, input: { roleType: ActorRole; fromPartnerId: string | null; toPartnerId: string; actorRole: ActorRole; now?: Date }): CaseState` — appends `PARTNER_REROUTED`; payload = JSON `{ roleType, fromPartnerId, toPartnerId }`.
  - Event type strings `"PARTNER_NUDGED"` and `"PARTNER_REROUTED"` (read by Task 3 and Task 8).

- [ ] **Step 1: Write the failing test**

Create `tests/domain/partner-ops.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nudgePartner, reroutePartner } from "../../src/domain/partner-ops";
import {
  acceptEvidence,
  advanceStage,
  createCase,
  StageEngineError,
  submitEvidence,
} from "../../src/domain/stage-engine";

function paidCaseAtMortgagePath() {
  let c = createCase({
    id: "ops_1",
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
  });
  c = submitEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "ADVISOR" });
  c = advanceStage(c, { actorRole: "ADVISOR" });
  c = submitEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "ADVISOR" });
  return advanceStage(c, { actorRole: "ADVISOR" });
}

describe("nudgePartner", () => {
  it("appends PARTNER_NUDGED on a partner-owned focus stage", () => {
    const c = paidCaseAtMortgagePath();
    const nudged = nudgePartner(c, {
      actorRole: "ADVISOR",
      now: new Date("2026-09-06T09:00:00.000Z"),
    });
    const event = nudged.events.at(-1);
    expect(event).toEqual({
      type: "PARTNER_NUDGED",
      stageKey: "mortgage_path",
      actorRole: "ADVISOR",
      at: "2026-09-06T09:00:00.000Z",
      payload: "MORTGAGE_PARTNER",
    });
    expect(nudged.stages).toEqual(c.stages);
  });

  it("rejects non-advisors and client-owned focus stages", () => {
    const c = paidCaseAtMortgagePath();
    expect(() => nudgePartner(c, { actorRole: "CLIENT" })).toThrow(StageEngineError);

    const fresh = createCase({ id: "ops_2", entryContext: "RETURNER_IN_UK", tier: "PAID_DWY" });
    expect(() => nudgePartner(fresh, { actorRole: "ADVISOR" })).toThrow(/partner-owned/i);
  });
});

describe("reroutePartner", () => {
  it("appends PARTNER_REROUTED with a JSON payload on the focus stage", () => {
    const c = paidCaseAtMortgagePath();
    const rerouted = reroutePartner(c, {
      roleType: "MORTGAGE_PARTNER",
      fromPartnerId: "p_old",
      toPartnerId: "p_new",
      actorRole: "ADVISOR",
      now: new Date("2026-09-07T09:00:00.000Z"),
    });
    const event = rerouted.events.at(-1)!;
    expect(event.type).toBe("PARTNER_REROUTED");
    expect(event.stageKey).toBe("mortgage_path");
    expect(JSON.parse(event.payload!)).toEqual({
      roleType: "MORTGAGE_PARTNER",
      fromPartnerId: "p_old",
      toPartnerId: "p_new",
    });
  });

  it("allows a first assignment (fromPartnerId null) but rejects same-partner and non-partner roles", () => {
    const c = paidCaseAtMortgagePath();
    expect(() =>
      reroutePartner(c, {
        roleType: "CONVEYANCER",
        fromPartnerId: null,
        toPartnerId: "p_new",
        actorRole: "ADVISOR",
      }),
    ).not.toThrow();
    expect(() =>
      reroutePartner(c, {
        roleType: "MORTGAGE_PARTNER",
        fromPartnerId: "p_same",
        toPartnerId: "p_same",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/same partner/i);
    expect(() =>
      reroutePartner(c, {
        roleType: "CLIENT",
        fromPartnerId: null,
        toPartnerId: "p_new",
        actorRole: "ADVISOR",
      }),
    ).toThrow(/partner role/i);
    expect(() =>
      reroutePartner(c, {
        roleType: "MORTGAGE_PARTNER",
        fromPartnerId: null,
        toPartnerId: "p_new",
        actorRole: "MORTGAGE_PARTNER",
      }),
    ).toThrow(StageEngineError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/domain/partner-ops.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/domain/partner-ops"`.

- [ ] **Step 3: Implement `src/domain/partner-ops.ts`**

```ts
import {
  getFocusStage,
  StageEngineError,
  type CaseState,
} from "./stage-engine";
import { isPartnerActorRole, type ActorRole } from "./types";

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function requireAdvisor(actorRole: ActorRole, what: string): void {
  if (actorRole !== "ADVISOR") {
    throw new StageEngineError("FORBIDDEN_ROLE", `Only advisors may ${what}`);
  }
}

/** Spec §8: "Partner non-response → nudge + scorecard hit + advisor re-route". The nudge is a ledger event. */
export function nudgePartner(
  caseState: CaseState,
  input: { actorRole: ActorRole; now?: Date },
): CaseState {
  requireAdvisor(input.actorRole, "nudge a partner");

  const focus = getFocusStage(caseState);
  if (!focus) {
    throw new StageEngineError("NO_ACTIVE_STAGE", "No focus stage to nudge");
  }
  if (!isPartnerActorRole(focus.ownerRole)) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Nudges apply only to partner-owned stages",
    );
  }

  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: "PARTNER_NUDGED",
        stageKey: focus.key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: focus.ownerRole,
      },
    ],
  };
}

export function reroutePartner(
  caseState: CaseState,
  input: {
    roleType: ActorRole;
    fromPartnerId: string | null;
    toPartnerId: string;
    actorRole: ActorRole;
    now?: Date;
  },
): CaseState {
  requireAdvisor(input.actorRole, "re-route a partner");

  if (!isPartnerActorRole(input.roleType)) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Re-route applies to partner roles only",
    );
  }
  if (input.fromPartnerId === input.toPartnerId) {
    throw new StageEngineError(
      "FORBIDDEN_ROLE",
      "Cannot re-route to the same partner",
    );
  }

  const focus = getFocusStage(caseState);
  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: "PARTNER_REROUTED",
        stageKey: focus?.key ?? caseState.stages[0].key,
        actorRole: input.actorRole,
        at: nowIso(input.now),
        payload: JSON.stringify({
          roleType: input.roleType,
          fromPartnerId: input.fromPartnerId,
          toPartnerId: input.toPartnerId,
        }),
      },
    ],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/domain/partner-ops.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/partner-ops.ts tests/domain/partner-ops.test.ts
git commit -m "feat: partner nudge and re-route as stage ledger events"
```

---

### Task 5: Referral persistence and scorecard aggregator

**Files:**
- Create: `src/server/referrals.ts`
- Create: `src/server/scorecards.ts`
- Test: `tests/server/referrals.test.ts`
- Test: `tests/server/scorecards.test.ts`

**Interfaces:**
- Consumes: `getPanelMember`, `listPanel`, `PartnerNetworkError` (Task 1); `ReferralRecord`, `FeeStatus`, `ReferralSource`, `canTransitionFee`, `defaultFeeStatus`, `disclosureTextFor` (Task 2); `buildScorecard`, `PanelScorecardRow`, `ScorecardAttribution` (Task 3); `loadCase` from `src/server/cases.ts`; `prisma`.
- Produces:
  - `createReferral(input: { caseId: string; partnerId: string; source: ReferralSource; feeStatus?: FeeStatus; now?: Date }): Promise<ReferralRecord>`
  - `listReferralsForCase(caseId: string): Promise<ReferralRecord[]>` — oldest first
  - `activeReferralForRole(caseId: string, role: ActorRole): Promise<ReferralRecord | null>` — latest non-superseded
  - `supersedeActiveReferrals(caseId: string, role: ActorRole, now?: Date): Promise<ReferralRecord | null>` — marks all non-superseded referrals for that role, returns the latest one (pre-update) or null
  - `setReferralFeeStatus(referralId: string, next: FeeStatus): Promise<ReferralRecord>`
  - `loadPanelScorecards(now?: Date): Promise<PanelScorecardRow[]>`

- [ ] **Step 1: Write the failing referrals test**

Create `tests/server/referrals.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { createCaseRecord } from "../../src/server/cases";
import { PartnerNetworkError } from "../../src/server/panel";
import {
  activeReferralForRole,
  createReferral,
  listReferralsForCase,
  setReferralFeeStatus,
  supersedeActiveReferrals,
} from "../../src/server/referrals";

let caseId: string;

describe("referrals persistence", () => {
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
        { id: "ref_client", email: "ref-client@example.com", role: "CLIENT", passwordHash },
        { id: "ref_advisor", email: "ref-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        { id: "ref_conv_a", roleType: "CONVEYANCER", name: "Tom Ashby", firm: "Harbour Law LLP", slaDays: 5 },
        { id: "ref_conv_b", roleType: "CONVEYANCER", name: "Lena Okoro", firm: null, slaDays: 5 },
        { id: "ref_mort_off", roleType: "MORTGAGE_PARTNER", name: "Ravi Patel", firm: null, slaDays: 3, active: false },
      ],
    });
    const created = await createCaseRecord({
      title: "Referral case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "ref_client",
      advisorUserId: "ref_advisor",
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a disclosed referral with the default fee status", async () => {
    const referral = await createReferral({
      caseId,
      partnerId: "ref_conv_a",
      source: "WARM_INTRO",
      now: new Date("2026-09-04T12:00:00.000Z"),
    });
    expect(referral.partnerRole).toBe("CONVEYANCER");
    expect(referral.partnerName).toBe("Tom Ashby");
    expect(referral.partnerFirm).toBe("Harbour Law LLP");
    expect(referral.source).toBe("WARM_INTRO");
    expect(referral.feeStatus).toBe("EXPECTED");
    expect(referral.disclosureText).toMatch(/referral fee/i);
    expect(referral.disclosedAt).toBe("2026-09-04T12:00:00.000Z");
    expect(referral.createdAt).toBe("2026-09-04T12:00:00.000Z");
    expect(referral.supersededAt).toBeNull();
  });

  it("rejects unknown or inactive panel members", async () => {
    await expect(
      createReferral({ caseId, partnerId: "nope", source: "ADVISOR_MARK" }),
    ).rejects.toThrow(PartnerNetworkError);
    await expect(
      createReferral({ caseId, partnerId: "ref_mort_off", source: "ADVISOR_MARK" }),
    ).rejects.toThrow(/not active/i);
  });

  it("enforces fee status transitions", async () => {
    const [referral] = await listReferralsForCase(caseId);
    const received = await setReferralFeeStatus(referral.id, "RECEIVED");
    expect(received.feeStatus).toBe("RECEIVED");
    await expect(setReferralFeeStatus(referral.id, "WAIVED")).rejects.toThrow(
      /RECEIVED to WAIVED/,
    );
  });

  it("supersedes the active referral for a role and records the replacement", async () => {
    const before = await activeReferralForRole(caseId, "CONVEYANCER");
    expect(before?.partnerId).toBe("ref_conv_a");

    const superseded = await supersedeActiveReferrals(
      caseId,
      "CONVEYANCER",
      new Date("2026-09-10T09:00:00.000Z"),
    );
    expect(superseded?.partnerId).toBe("ref_conv_a");

    await createReferral({
      caseId,
      partnerId: "ref_conv_b",
      source: "REROUTE",
      now: new Date("2026-09-10T09:00:01.000Z"),
    });

    const all = await listReferralsForCase(caseId);
    expect(all.map((r) => [r.partnerId, r.supersededAt])).toEqual([
      ["ref_conv_a", "2026-09-10T09:00:00.000Z"],
      ["ref_conv_b", null],
    ]);
    expect((await activeReferralForRole(caseId, "CONVEYANCER"))?.partnerId).toBe("ref_conv_b");
    expect(await activeReferralForRole(caseId, "MORTGAGE_PARTNER")).toBeNull();
    expect(await supersedeActiveReferrals(caseId, "MOVE_PARTNER")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the referrals test to verify it fails**

Run: `npx vitest run tests/server/referrals.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/server/referrals"`.

- [ ] **Step 3: Implement `src/server/referrals.ts`**

```ts
import type { PartnerPanel, Referral } from "@prisma/client";
import {
  canTransitionFee,
  defaultFeeStatus,
  disclosureTextFor,
  type FeeStatus,
  type ReferralRecord,
  type ReferralSource,
} from "../domain/referral";
import type { ActorRole } from "../domain/types";
import { prisma } from "../lib/db";
import { getPanelMember, PartnerNetworkError } from "./panel";

type ReferralRow = Referral & { partner: PartnerPanel };

function toReferralRecord(row: ReferralRow): ReferralRecord {
  return {
    id: row.id,
    caseId: row.caseId,
    partnerId: row.partnerId,
    partnerName: row.partner.name,
    partnerFirm: row.partner.firm,
    partnerRole: row.partnerRole as ActorRole,
    source: row.source as ReferralSource,
    feeStatus: row.feeStatus as FeeStatus,
    disclosureText: row.disclosureText,
    disclosedAt: row.disclosedAt.toISOString(),
    supersededAt: row.supersededAt ? row.supersededAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createReferral(input: {
  caseId: string;
  partnerId: string;
  source: ReferralSource;
  feeStatus?: FeeStatus;
  now?: Date;
}): Promise<ReferralRecord> {
  const member = await getPanelMember(input.partnerId);
  if (!member) {
    throw new PartnerNetworkError("Unknown panel member");
  }
  if (!member.active) {
    throw new PartnerNetworkError("Panel member is not active");
  }

  const at = input.now ?? new Date();
  const row = await prisma.referral.create({
    data: {
      caseId: input.caseId,
      partnerId: member.id,
      partnerRole: member.roleType,
      source: input.source,
      feeStatus: input.feeStatus ?? defaultFeeStatus(member.roleType),
      disclosureText: disclosureTextFor({
        role: member.roleType,
        partnerName: member.name,
        partnerFirm: member.firm,
      }),
      disclosedAt: at,
      createdAt: at,
    },
    include: { partner: true },
  });
  return toReferralRecord(row);
}

export async function listReferralsForCase(caseId: string): Promise<ReferralRecord[]> {
  const rows = await prisma.referral.findMany({
    where: { caseId },
    include: { partner: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toReferralRecord);
}

export async function activeReferralForRole(
  caseId: string,
  role: ActorRole,
): Promise<ReferralRecord | null> {
  const row = await prisma.referral.findFirst({
    where: { caseId, partnerRole: role, supersededAt: null },
    include: { partner: true },
    orderBy: { createdAt: "desc" },
  });
  return row ? toReferralRecord(row) : null;
}

/** Marks every live referral for the role as superseded; returns the one that was current. */
export async function supersedeActiveReferrals(
  caseId: string,
  role: ActorRole,
  now: Date = new Date(),
): Promise<ReferralRecord | null> {
  const current = await activeReferralForRole(caseId, role);
  if (!current) {
    return null;
  }
  await prisma.referral.updateMany({
    where: { caseId, partnerRole: role, supersededAt: null },
    data: { supersededAt: now },
  });
  return current;
}

export async function setReferralFeeStatus(
  referralId: string,
  next: FeeStatus,
): Promise<ReferralRecord> {
  const existing = await prisma.referral.findUnique({
    where: { id: referralId },
    include: { partner: true },
  });
  if (!existing) {
    throw new PartnerNetworkError("Unknown referral");
  }
  const from = existing.feeStatus as FeeStatus;
  if (!canTransitionFee(from, next)) {
    throw new PartnerNetworkError(`Cannot move fee status from ${from} to ${next}`);
  }
  const row = await prisma.referral.update({
    where: { id: referralId },
    data: { feeStatus: next },
    include: { partner: true },
  });
  return toReferralRecord(row);
}
```

- [ ] **Step 4: Run the referrals test to verify it passes**

Run: `npx vitest run tests/server/referrals.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing scorecards aggregator test**

Create `tests/server/scorecards.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import {
  acceptEvidence,
  advanceStage,
  submitEvidence,
} from "../../src/domain/stage-engine";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase, saveCase } from "../../src/server/cases";
import { createReferral } from "../../src/server/referrals";
import { loadPanelScorecards } from "../../src/server/scorecards";

describe("loadPanelScorecards", () => {
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
        { id: "sc_client", email: "sc-client@example.com", role: "CLIENT", passwordHash },
        { id: "sc_advisor", email: "sc-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        { id: "sc_priya", roleType: "MORTGAGE_PARTNER", name: "Priya Nair", firm: null, slaDays: 3 },
        { id: "sc_tom", roleType: "CONVEYANCER", name: "Tom Ashby", firm: null, slaDays: 5 },
      ],
    });

    const created = await createCaseRecord({
      title: "Scorecard case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "sc_client",
      advisorUserId: "sc_advisor",
    });

    let c = await loadCase(created.id);
    const t = (iso: string) => new Date(iso);
    c = submitEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "CLIENT", now: t("2026-08-25T10:00:00.000Z") });
    c = acceptEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "ADVISOR", now: t("2026-08-25T11:00:00.000Z") });
    c = advanceStage(c, { actorRole: "ADVISOR", now: t("2026-08-25T12:00:00.000Z") });
    c = submitEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "CLIENT", now: t("2026-08-30T10:00:00.000Z") });
    c = acceptEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "ADVISOR", now: t("2026-08-30T11:00:00.000Z") });
    c = advanceStage(c, { actorRole: "ADVISOR", now: t("2026-09-01T10:00:00.000Z") });
    await saveCase(c);

    await createReferral({
      caseId: created.id,
      partnerId: "sc_priya",
      source: "WARM_INTRO",
      now: t("2026-08-26T10:00:00.000Z"),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("builds one row per panel member with ledger-derived metrics", async () => {
    const rows = await loadPanelScorecards(new Date("2026-09-08T10:00:00.000Z"));
    expect(rows.map((r) => r.member.id)).toEqual(["sc_tom", "sc_priya"]);

    const priya = rows.find((r) => r.member.id === "sc_priya")!.scorecard;
    expect(priya.stagesAssigned).toBe(1);
    expect(priya.openStages).toBe(1);
    expect(priya.missed).toBe(1);
    expect(priya.breaches).toBe(1);
    expect(priya.participationRate).toBe(0);
    expect(priya.rating).toBe("UNDERPERFORMING");
    expect(priya.recommendReroute).toBe(true);

    const tom = rows.find((r) => r.member.id === "sc_tom")!.scorecard;
    expect(tom.rating).toBe("NO_DATA");
  });
});
```

- [ ] **Step 6: Run the scorecards test to verify it fails**

Run: `npx vitest run tests/server/scorecards.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/server/scorecards"`.

- [ ] **Step 7: Implement `src/server/scorecards.ts`**

```ts
import type { PanelMember } from "../domain/panel";
import {
  buildScorecard,
  type PanelScorecardRow,
  type ScorecardAttribution,
} from "../domain/scorecard";
import type { CaseState } from "../domain/stage-engine";
import { prisma } from "../lib/db";
import { loadCase } from "./cases";
import { listPanel } from "./panel";

async function attributionsByPartner(): Promise<Map<string, ScorecardAttribution[]>> {
  const referrals = await prisma.referral.findMany({
    select: { partnerId: true, caseId: true, createdAt: true, supersededAt: true },
    orderBy: { createdAt: "asc" },
  });

  const caseCache = new Map<string, CaseState>();
  const byPartner = new Map<string, ScorecardAttribution[]>();

  for (const referral of referrals) {
    let caseState = caseCache.get(referral.caseId);
    if (!caseState) {
      caseState = await loadCase(referral.caseId);
      caseCache.set(referral.caseId, caseState);
    }
    const list = byPartner.get(referral.partnerId) ?? [];
    list.push({
      caseState,
      referralCreatedAt: referral.createdAt.toISOString(),
      supersededAt: referral.supersededAt ? referral.supersededAt.toISOString() : null,
    });
    byPartner.set(referral.partnerId, list);
  }

  return byPartner;
}

export async function loadPanelScorecards(
  now: Date = new Date(),
): Promise<PanelScorecardRow[]> {
  const [members, attributions] = await Promise.all([
    listPanel(),
    attributionsByPartner(),
  ]);

  return members.map((member: PanelMember) => ({
    member,
    scorecard: buildScorecard(member, attributions.get(member.id) ?? [], now),
  }));
}
```

- [ ] **Step 8: Run the scorecards test to verify it passes**

Run: `npx vitest run tests/server/scorecards.test.ts`
Expected: PASS (1 test).

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/server/referrals.ts src/server/scorecards.ts tests/server/referrals.test.ts tests/server/scorecards.test.ts
git commit -m "feat: persist disclosed referrals and aggregate panel scorecards"
```

---

### Task 6: Warm intro to a named panel member creates a referral

**Files:**
- Modify: `src/lib/partner-port.ts`
- Modify: `src/server/case-access.ts`
- Modify: `src/server/cockpit-policy.ts`
- Modify: `src/app/actions/cockpit.ts`
- Modify: `src/components/WarmIntroButton.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx` (warm intro wiring only; the rest of the page changes land in Task 8)
- Test: `tests/server/warm-intro.test.ts`
- Test: `tests/server/cockpit-actions.test.ts`

**Interfaces:**
- Consumes: `getPanelMember`, `listPanel` (Task 1); `createReferral` (Task 5); `PanelMember` (Task 1); `canUseWarmIntro` from `src/domain/freemium.ts`.
- Produces:
  - `PartnerPort.requestWarmIntro(input: { caseId; partnerType: ActorRole; note: string; panelMemberId: string; panelMemberName: string }): Promise<{ ticketId: string }>` — payload JSON gains `panelMemberId`, `panelMemberName`.
  - `attachPartnerParticipant(caseId: string, partnerRole: ActorRole, preferredUserId?: string | null): Promise<void>`
  - `detachPartnerParticipant(caseId: string, userId: string): Promise<void>`
  - `assertReroute(caseState: CaseState): void` — throws `CockpitPolicyError("Re-routing a partner requires a paid tier")` on free.
  - `warmIntroAction(caseId: string, panelMemberId: string, note: string): Promise<CockpitActionResult>`
  - `WarmIntroButton` props: `{ caseId: string; enabled: boolean; panel: PanelMember[] }`

- [ ] **Step 1: Write the failing policy test**

Append to `tests/server/cockpit-actions.test.ts`:

```ts
import { assertReroute } from "../../src/server/cockpit-policy";

describe("assertReroute", () => {
  it("rejects free cases with a re-route specific message", () => {
    const c = createCase({ id: "rr1", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" });
    expect(() => assertReroute(c)).toThrow(/re-rout/i);
  });

  it("allows paid cases", () => {
    const c = createCase({ id: "rr2", entryContext: "RETURNER_IN_UK", tier: "PAID_DWY" });
    expect(() => assertReroute(c)).not.toThrow();
  });
});
```

Move the new `import` line to the top of the file next to the existing `assertWarmIntro` import (combine into `import { assertReroute, assertWarmIntro } from "../../src/server/cockpit-policy";`).

- [ ] **Step 2: Write the failing warm-intro persistence test**

Create `tests/server/warm-intro.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { ManualPartnerPort } from "../../src/lib/partner-port";
import { prisma } from "../../src/lib/db";
import {
  attachPartnerParticipant,
  detachPartnerParticipant,
} from "../../src/server/case-access";
import { createCaseRecord, loadCase } from "../../src/server/cases";

let caseId: string;

describe("warm intro plumbing", () => {
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
        { id: "wi_client", email: "wi-client@example.com", role: "CLIENT", passwordHash },
        { id: "wi_advisor", email: "wi-advisor@example.com", role: "ADVISOR", passwordHash },
        { id: "wi_mort_a", email: "wi-mort-a@example.com", role: "MORTGAGE_PARTNER", passwordHash },
        { id: "wi_mort_b", email: "wi-mort-b@example.com", role: "MORTGAGE_PARTNER", passwordHash },
      ],
    });
    const created = await createCaseRecord({
      title: "Warm intro case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "wi_client",
      advisorUserId: "wi_advisor",
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("logs the named panel member in the WARM_INTRO_REQUESTED payload", async () => {
    const port = new ManualPartnerPort();
    const { ticketId } = await port.requestWarmIntro({
      caseId,
      partnerType: "MORTGAGE_PARTNER",
      note: "Returner, needs DIP quickly",
      panelMemberId: "seed_panel_priya",
      panelMemberName: "Priya Nair",
    });
    expect(ticketId).toMatch(/^warm-/);

    const reloaded = await loadCase(caseId);
    const event = reloaded.events.at(-1)!;
    expect(event.type).toBe("WARM_INTRO_REQUESTED");
    expect(event.actorRole).toBe("ADVISOR");
    expect(JSON.parse(event.payload!)).toEqual({
      partnerType: "MORTGAGE_PARTNER",
      note: "Returner, needs DIP quickly",
      ticketId,
      panelMemberId: "seed_panel_priya",
      panelMemberName: "Priya Nair",
    });
  });

  it("attaches the preferred partner login, falls back to any user of the role, and detaches", async () => {
    await attachPartnerParticipant(caseId, "MORTGAGE_PARTNER", "wi_mort_b");
    let participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants.map((p) => p.userId)).toEqual(["wi_mort_b"]);

    await detachPartnerParticipant(caseId, "wi_mort_b");
    participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants).toEqual([]);

    await attachPartnerParticipant(caseId, "MORTGAGE_PARTNER", null);
    participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants).toHaveLength(1);
    expect(["wi_mort_a", "wi_mort_b"]).toContain(participants[0].userId);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/server/cockpit-actions.test.ts tests/server/warm-intro.test.ts`
Expected: FAIL — `assertReroute` is not exported; `detachPartnerParticipant` is not exported; TypeScript/Vitest complains about unknown `panelMemberId` property (or payload mismatch at runtime).

- [ ] **Step 4: Add `assertReroute` to `src/server/cockpit-policy.ts`**

Append:

```ts
export function assertReroute(caseState: CaseState): void {
  if (!canUseWarmIntro(caseState)) {
    throw new CockpitPolicyError("Re-routing a partner requires a paid tier");
  }
}
```

- [ ] **Step 5: Update `src/server/case-access.ts`**

Replace `attachPartnerParticipant` and add `detachPartnerParticipant`:

```ts
export async function attachPartnerParticipant(
  caseId: string,
  partnerRole: ActorRole,
  preferredUserId?: string | null,
): Promise<void> {
  const user = preferredUserId
    ? await prisma.user.findFirst({
        where: { id: preferredUserId, role: partnerRole },
      })
    : await prisma.user.findFirst({ where: { role: partnerRole } });
  if (!user) {
    return;
  }

  await prisma.caseParticipant.upsert({
    where: {
      caseId_userId: {
        caseId,
        userId: user.id,
      },
    },
    create: {
      caseId,
      userId: user.id,
      role: partnerRole,
    },
    update: {},
  });
}

export async function detachPartnerParticipant(
  caseId: string,
  userId: string,
): Promise<void> {
  await prisma.caseParticipant.deleteMany({ where: { caseId, userId } });
}
```

Also re-export it from `src/server/cases.ts` next to the existing line:

```ts
export { attachPartnerParticipant, detachPartnerParticipant } from "./case-access";
```

- [ ] **Step 6: Update `src/lib/partner-port.ts`**

Replace the file contents:

```ts
import type { CaseState } from "@/domain/stage-engine";
import { getFocusStage } from "@/domain/stage-engine";
import type { ActorRole } from "@/domain/types";
import { loadCase, saveCase } from "@/server/cases";

export type WarmIntroRequest = {
  caseId: string;
  partnerType: ActorRole;
  note: string;
  panelMemberId: string;
  panelMemberName: string;
};

/**
 * Spec §7: "Manual partner ops in v1 behind clean APIs/interfaces". A real integration
 * implements this same port; the ledger event shape stays identical.
 */
export type PartnerPort = {
  requestWarmIntro(input: WarmIntroRequest): Promise<{ ticketId: string }>;
};

export class ManualPartnerPort implements PartnerPort {
  async requestWarmIntro(input: WarmIntroRequest): Promise<{ ticketId: string }> {
    const caseState = await loadCase(input.caseId);
    const focus = getFocusStage(caseState);
    const stageKey =
      focus?.key ??
      caseState.stages.find((s) => s.status === "ACTIVE")?.key ??
      caseState.stages[0]?.key ??
      "unknown";

    const ticketId = `warm-${input.caseId}-${Date.now()}`;
    const at = new Date().toISOString();

    const updated: CaseState = {
      ...caseState,
      events: [
        ...caseState.events,
        {
          type: "WARM_INTRO_REQUESTED",
          stageKey,
          actorRole: "ADVISOR",
          at,
          payload: JSON.stringify({
            partnerType: input.partnerType,
            note: input.note,
            ticketId,
            panelMemberId: input.panelMemberId,
            panelMemberName: input.panelMemberName,
          }),
        },
      ],
    };

    await saveCase(updated);
    return { ticketId };
  }
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npx vitest run tests/server/cockpit-actions.test.ts tests/server/warm-intro.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Rewrite `warmIntroAction` in `src/app/actions/cockpit.ts`**

Add imports at the top of the file:

```ts
import { getPanelMember, PartnerNetworkError } from "@/server/panel";
import { createReferral } from "@/server/referrals";
```

Extend `mapError` so panel errors surface their message:

```ts
function mapError(err: unknown): string {
  if (
    err instanceof CockpitPolicyError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError ||
    err instanceof PartnerNetworkError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}
```

Replace `warmIntroAction`:

```ts
export async function warmIntroAction(
  caseId: string,
  panelMemberId: string,
  note: string,
): Promise<CockpitActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    const caseState = await loadCaseForUser(
      authResult.userId,
      "ADVISOR",
      caseId,
    );
    assertWarmIntro(caseState);

    const member = await getPanelMember(panelMemberId);
    if (!member || !member.active) {
      return { ok: false, error: "Panel member is not available for warm intros" };
    }

    await partnerPort.requestWarmIntro({
      caseId,
      partnerType: member.roleType,
      note,
      panelMemberId: member.id,
      panelMemberName: member.name,
    });
    await createReferral({ caseId, partnerId: member.id, source: "WARM_INTRO" });
    await attachPartnerParticipant(caseId, member.roleType, member.userId);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

Remove the now-unused `import type { ActorRole } from "@/domain/types";` line if nothing else in the file uses it.

- [ ] **Step 9: Rewrite `src/components/WarmIntroButton.tsx` to pick a named panel member**

```tsx
"use client";

import { useState } from "react";
import { warmIntroAction } from "@/app/actions/cockpit";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelMember } from "@/domain/panel";

type Props = {
  caseId: string;
  enabled: boolean;
  panel: PanelMember[];
};

function label(role: string): string {
  return role.replace(/_/g, " ").toLowerCase();
}

export function WarmIntroButton({ caseId, enabled, panel }: Props) {
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-medium text-amber-900">Warm intro</h2>
        <p className="mt-1 text-sm text-amber-800">
          Warm intros are available on paid Done-With-You cases only.
        </p>
      </div>
    );
  }

  const active = panel.filter((member) => member.active);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Warm intro</h2>
      <p className="mt-1 text-sm text-slate-600">
        Introduce a named panel partner. Logged as a stage event and a disclosed
        referral the client can see.
      </p>
      <ActionErrorBanner error={error} />
      {active.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No active panel members. Reinstate one from the Partner panel.
        </p>
      ) : (
        <form
          action={async (formData) => {
            setError(null);
            const panelMemberId = String(formData.get("panelMemberId") ?? "");
            const note = String(formData.get("note") ?? "");
            const result = await warmIntroAction(caseId, panelMemberId, note);
            if (!result.ok) {
              setError(result.error ?? "Warm intro failed");
            }
          }}
          className="mt-4 space-y-3"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Panel partner</span>
            <select
              name="panelMemberId"
              defaultValue={active[0].id}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {active.map((member) => (
                <option key={member.id} value={member.id}>
                  {label(member.roleType)} — {member.name}
                  {member.firm ? ` (${member.firm})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Note</span>
            <textarea
              name="note"
              rows={2}
              placeholder="Context for the partner…"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Request warm intro
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Wire the panel into the cockpit case page**

In `src/app/cockpit/cases/[caseId]/page.tsx`:

Add import:

```ts
import { listPanel } from "@/server/panel";
```

After `const now = new Date();` add:

```ts
  const panel = await listPanel({ activeOnly: true });
```

Replace the `<WarmIntroButton ... />` block with:

```tsx
      <div className="mt-8">
        <WarmIntroButton
          caseId={caseId}
          enabled={canUseWarmIntro(caseState)}
          panel={panel}
        />
      </div>
```

- [ ] **Step 11: Type-check and run the suite**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: no type errors (the only caller of `warmIntroAction` is the button); all tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/lib/partner-port.ts src/server/case-access.ts src/server/cases.ts src/server/cockpit-policy.ts src/app/actions/cockpit.ts src/components/WarmIntroButton.tsx "src/app/cockpit/cases/[caseId]/page.tsx" tests/server/warm-intro.test.ts tests/server/cockpit-actions.test.ts
git commit -m "feat: warm intro to a named panel member records a disclosed referral"
```

---

### Task 7: Advisor cockpit — partner panel page with scorecards, demote / reinstate

**Files:**
- Create: `src/app/actions/partner-network.ts` (panel action only in this task; Task 8 adds the rest)
- Create: `src/components/PanelTable.tsx`
- Create: `src/app/cockpit/panel/page.tsx`
- Modify: `src/app/cockpit/layout.tsx`

**Interfaces:**
- Consumes: `loadPanelScorecards` (Task 5); `setPanelMemberActive`, `PartnerNetworkError` (Task 1); `PanelScorecardRow` (Task 3); `auth` from `src/lib/auth.ts`.
- Produces:
  - `type PartnerNetworkActionResult = { ok: true } | { ok: false; error: string }`
  - `setPanelActiveAction(panelMemberId: string, active: boolean): Promise<PartnerNetworkActionResult>`
  - `PanelTable` props: `{ rows: PanelScorecardRow[] }`
  - Route `/cockpit/panel`

- [ ] **Step 1: Create `src/app/actions/partner-network.ts` with the panel action**

```ts
"use server";

import { StageEngineError } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError } from "@/server/cases";
import { CockpitPolicyError } from "@/server/cockpit-policy";
import { PartnerNetworkError, setPanelMemberActive } from "@/server/panel";
import { revalidatePath } from "next/cache";

export type PartnerNetworkActionResult =
  | { ok: true }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof PartnerNetworkError ||
    err instanceof CockpitPolicyError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Action failed";
}

async function requireAdvisor(): Promise<
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
  revalidatePath("/cockpit/panel");
  revalidatePath(`/portal/cases/${caseId}`);
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
}

export async function setPanelActiveAction(
  panelMemberId: string,
  active: boolean,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    await setPanelMemberActive(panelMemberId, active);
    revalidatePath("/cockpit/panel");
    revalidatePath("/cockpit/cases");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

`requireAdvisor`, `mapError` and `revalidateCasePaths` are used by the case-scoped actions added in Task 8; keep them here.

- [ ] **Step 2: Create `src/components/PanelTable.tsx`**

```tsx
"use client";

import { useState } from "react";
import { setPanelActiveAction } from "@/app/actions/partner-network";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelScorecardRow, ScorecardRating } from "@/domain/scorecard";

type Props = {
  rows: PanelScorecardRow[];
};

const RATING_CLASS: Record<ScorecardRating, string> = {
  STRONG: "bg-emerald-100 text-emerald-800",
  WATCH: "bg-amber-100 text-amber-800",
  UNDERPERFORMING: "bg-red-100 text-red-800",
  NO_DATA: "bg-slate-100 text-slate-600",
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function PanelTable({ rows }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function toggle(panelMemberId: string, active: boolean) {
    setError(null);
    const result = await setPanelActiveAction(panelMemberId, active);
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <ActionErrorBanner error={error} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Stages</th>
              <th className="px-3 py-2">Done</th>
              <th className="px-3 py-2">Avg days</th>
              <th className="px-3 py-2">Miss rate</th>
              <th className="px-3 py-2">Breaches</th>
              <th className="px-3 py-2">Portal</th>
              <th className="px-3 py-2">Nudges</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, scorecard }) => (
              <tr
                key={member.id}
                className={`border-t border-slate-100 ${member.active ? "" : "text-slate-400"}`}
              >
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-900">{member.name}</span>
                  {member.firm && (
                    <span className="block text-xs text-slate-500">{member.firm}</span>
                  )}
                  {!member.userId && (
                    <span className="block text-xs text-slate-400">no portal login</span>
                  )}
                </td>
                <td className="px-3 py-2">{label(member.roleType)}</td>
                <td className="px-3 py-2">{member.slaDays}d</td>
                <td className="px-3 py-2">{scorecard.stagesAssigned}</td>
                <td className="px-3 py-2">{scorecard.completions}</td>
                <td className="px-3 py-2">{scorecard.avgDaysInStage ?? "—"}</td>
                <td className="px-3 py-2">{percent(scorecard.missRate)}</td>
                <td className="px-3 py-2">{scorecard.breaches}</td>
                <td className="px-3 py-2">{percent(scorecard.participationRate)}</td>
                <td className="px-3 py-2">{scorecard.nudges}</td>
                <td className="px-3 py-2 font-medium">{scorecard.qualityScore}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${RATING_CLASS[scorecard.rating]}`}
                  >
                    {label(scorecard.rating)}
                  </span>
                  {scorecard.recommendReroute && member.active && (
                    <span className="mt-1 block text-xs text-red-700">
                      re-route recommended
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <form
                    action={async () => {
                      await toggle(member.id, !member.active);
                    }}
                  >
                    <button
                      type="submit"
                      className={
                        member.active
                          ? "rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          : "rounded border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      }
                    >
                      {member.active ? "Demote" : "Reinstate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Miss = time-in-stage reached the partner&apos;s SLA; breach = 1.5× SLA
        (same escalation rules as the case banner). Portal = share of assigned
        stages where the partner submitted evidence through the portal.
        Demoted partners keep their history but cannot receive intros.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/cockpit/panel/page.tsx`**

```tsx
import { PanelTable } from "@/components/PanelTable";
import { loadPanelScorecards } from "@/server/scorecards";

export default async function PanelPage() {
  const rows = await loadPanelScorecards(new Date());
  const active = rows.filter((row) => row.member.active).length;
  const flagged = rows.filter(
    (row) => row.member.active && row.scorecard.recommendReroute,
  ).length;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Partner panel</h1>
      <p className="mt-1 text-sm text-slate-600">
        Curated panel scored from the stage ledger. Speed credibility is earned
        here before any chain-free or hard SLA promise.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Active partners</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {active}
            <span className="text-base font-normal text-slate-500"> / {rows.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Re-route recommended</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{flagged}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Stages attributed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {rows.reduce((sum, row) => sum + row.scorecard.stagesAssigned, 0)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-slate-500">No panel members yet. Run the seed.</p>
      ) : (
        <PanelTable rows={rows} />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add the nav link in `src/app/cockpit/layout.tsx`**

Inside the `<nav>` after the "Validation funnel" link:

```tsx
        <a href="/cockpit/panel" className="text-slate-700 hover:text-slate-900">
          Partner panel
        </a>
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run db:seed` (if not already seeded with panel members) and `npm run dev`. Sign in as `advisor@example.com` / `password`, open `/cockpit/panel`.
Expected: five rows (Ravi Patel greyed out with "Reinstate"), all ratings `no data`, three summary cards. Click **Demote** on Lena Okoro → row greys, active count drops to 3. Click **Reinstate** → restored.

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/partner-network.ts src/components/PanelTable.tsx src/app/cockpit/panel/page.tsx src/app/cockpit/layout.tsx
git commit -m "feat: cockpit partner panel with ledger scorecards and demote/reinstate"
```

---

### Task 8: Cockpit case page — referral panel, fee status, nudge and re-route

**Files:**
- Modify: `src/app/actions/partner-network.ts`
- Create: `src/components/ReferralPanel.tsx`
- Create: `src/components/PartnerOpsControls.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx`

**Interfaces:**
- Consumes: `nudgePartner`, `reroutePartner` (Task 4); `assertReroute` (Task 6); `createReferral`, `listReferralsForCase`, `activeReferralForRole`, `supersedeActiveReferrals`, `setReferralFeeStatus` (Task 5); `getPanelMember`, `listPanel` (Task 1); `attachPartnerParticipant`, `detachPartnerParticipant`, `loadCaseForUser`, `saveCase` (existing + Task 6); `isFeeStatus`, `FEE_STATUSES`, `ReferralRecord` (Task 2); `isPartnerActorRole` (Task 2).
- Produces:
  - `markReferralAction(caseId: string, panelMemberId: string, feeStatus: string): Promise<PartnerNetworkActionResult>` — any tier; source `ADVISOR_MARK`.
  - `setFeeStatusAction(caseId: string, referralId: string, feeStatus: string): Promise<PartnerNetworkActionResult>`
  - `nudgePartnerAction(caseId: string): Promise<PartnerNetworkActionResult>`
  - `reroutePartnerAction(caseId: string, panelMemberId: string): Promise<PartnerNetworkActionResult>` — paid only; supersedes the live referral for that role, appends `PARTNER_REROUTED`, creates a `REROUTE` referral, swaps the partner participant.
  - `ReferralPanel` props: `{ caseId: string; referrals: ReferralRecord[]; panel: PanelMember[] }`
  - `PartnerOpsControls` props: `{ caseId: string; paid: boolean; focusOwnerRole: ActorRole | null; currentPartner: { id: string; name: string } | null; rerouteOptions: PanelMember[] }`

- [ ] **Step 1: Add the four case-scoped actions to `src/app/actions/partner-network.ts`**

Add imports (extend the existing `@/server/cases`, `@/server/cockpit-policy` and `@/server/panel` import lines rather than duplicating them):

```ts
import { nudgePartner, reroutePartner } from "@/domain/partner-ops";
import { isFeeStatus } from "@/domain/referral";
import { CaseAccessError, loadCaseForUser, saveCase } from "@/server/cases";
import {
  attachPartnerParticipant,
  detachPartnerParticipant,
} from "@/server/case-access";
import { assertReroute, CockpitPolicyError } from "@/server/cockpit-policy";
import {
  getPanelMember,
  PartnerNetworkError,
  setPanelMemberActive,
} from "@/server/panel";
import {
  createReferral,
  setReferralFeeStatus,
  supersedeActiveReferrals,
} from "@/server/referrals";
```

Append the actions:

```ts
export async function markReferralAction(
  caseId: string,
  panelMemberId: string,
  feeStatus: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }
  if (!isFeeStatus(feeStatus)) {
    return { ok: false, error: "Unknown fee status" };
  }

  try {
    await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    await createReferral({
      caseId,
      partnerId: panelMemberId,
      source: "ADVISOR_MARK",
      feeStatus,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function setFeeStatusAction(
  caseId: string,
  referralId: string,
  feeStatus: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }
  if (!isFeeStatus(feeStatus)) {
    return { ok: false, error: "Unknown fee status" };
  }

  try {
    await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    await setReferralFeeStatus(referralId, feeStatus);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function nudgePartnerAction(
  caseId: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    caseState = nudgePartner(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function reroutePartnerAction(
  caseId: string,
  panelMemberId: string,
): Promise<PartnerNetworkActionResult> {
  const authResult = await requireAdvisor();
  if (!authResult.ok) {
    return authResult;
  }

  try {
    let caseState = await loadCaseForUser(authResult.userId, "ADVISOR", caseId);
    assertReroute(caseState);

    const next = await getPanelMember(panelMemberId);
    if (!next || !next.active) {
      return { ok: false, error: "Panel member is not available for re-route" };
    }

    const previous = await supersedeActiveReferrals(caseId, next.roleType);
    caseState = reroutePartner(caseState, {
      roleType: next.roleType,
      fromPartnerId: previous?.partnerId ?? null,
      toPartnerId: next.id,
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);
    await createReferral({ caseId, partnerId: next.id, source: "REROUTE" });

    if (previous) {
      const previousMember = await getPanelMember(previous.partnerId);
      if (previousMember?.userId && previousMember.userId !== next.userId) {
        await detachPartnerParticipant(caseId, previousMember.userId);
      }
    }
    await attachPartnerParticipant(caseId, next.roleType, next.userId);

    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

- [ ] **Step 2: Create `src/components/ReferralPanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  markReferralAction,
  setFeeStatusAction,
} from "@/app/actions/partner-network";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelMember } from "@/domain/panel";
import { FEE_STATUSES, type ReferralRecord } from "@/domain/referral";

type Props = {
  caseId: string;
  referrals: ReferralRecord[];
  panel: PanelMember[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export function ReferralPanel({ caseId, referrals, panel }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  const active = panel.filter((member) => member.active);

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Referrals & disclosure</h2>
      <p className="mt-1 text-sm text-slate-600">
        Every partner referral is recorded with its disclosure and fee status.
        Fees are recorded here, never paid from this system.
      </p>
      <ActionErrorBanner error={error} />

      {referrals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No referrals on this case yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {referrals.map((referral) => (
            <li
              key={referral.id}
              className={`rounded border px-3 py-2 text-sm ${
                referral.supersededAt
                  ? "border-slate-100 bg-slate-50 text-slate-500"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium text-slate-900">{referral.partnerName}</span>
                  {referral.partnerFirm && ` (${referral.partnerFirm})`}
                  {" · "}
                  {label(referral.partnerRole)}
                  {" · "}
                  {label(referral.source)}
                  {referral.supersededAt && " · superseded"}
                </span>
                <span className="text-xs text-slate-500">
                  disclosed {new Date(referral.disclosedAt).toLocaleDateString("en-GB")}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{referral.disclosureText}</p>
              <form
                action={async (formData) => {
                  const next = String(formData.get("feeStatus") ?? "");
                  await run(() => setFeeStatusAction(caseId, referral.id, next));
                }}
                className="mt-2 flex items-center gap-2"
              >
                <label className="text-xs text-slate-600">
                  Fee status
                  <select
                    name="feeStatus"
                    defaultValue={referral.feeStatus}
                    className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {FEE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {label(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <form
          action={async (formData) => {
            const panelMemberId = String(formData.get("panelMemberId") ?? "");
            const feeStatus = String(formData.get("feeStatus") ?? "EXPECTED");
            await run(() => markReferralAction(caseId, panelMemberId, feeStatus));
          }}
          className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="text-sm font-medium text-slate-700">
              Mark a referral (client chose a panel partner)
            </span>
            <select
              name="panelMemberId"
              defaultValue={active[0].id}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {active.map((member) => (
                <option key={member.id} value={member.id}>
                  {label(member.roleType)} — {member.name}
                  {member.firm ? ` (${member.firm})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Fee</span>
            <select
              name="feeStatus"
              defaultValue="EXPECTED"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {FEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Record referral
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/PartnerOpsControls.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  nudgePartnerAction,
  reroutePartnerAction,
} from "@/app/actions/partner-network";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelMember } from "@/domain/panel";
import type { ActorRole } from "@/domain/types";

type Props = {
  caseId: string;
  paid: boolean;
  focusOwnerRole: ActorRole | null;
  currentPartner: { id: string; name: string } | null;
  rerouteOptions: PanelMember[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export function PartnerOpsControls({
  caseId,
  paid,
  focusOwnerRole,
  currentPartner,
  rerouteOptions,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  if (!focusOwnerRole) {
    return null;
  }

  const options = rerouteOptions.filter(
    (member) => member.active && member.id !== currentPartner?.id,
  );

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Partner ops</h2>
      <p className="mt-1 text-sm text-slate-600">
        Focus stage is owned by <span className="font-medium">{label(focusOwnerRole)}</span>
        {currentPartner ? ` — ${currentPartner.name}` : " — no named partner yet"}.
        Non-response: nudge (scorecard hit), then re-route.
      </p>
      <ActionErrorBanner error={error} />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <form
          action={async () => {
            await run(() => nudgePartnerAction(caseId));
          }}
        >
          <button
            type="submit"
            className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Nudge partner
          </button>
        </form>

        {paid ? (
          options.length > 0 ? (
            <form
              action={async (formData) => {
                const panelMemberId = String(formData.get("panelMemberId") ?? "");
                await run(() => reroutePartnerAction(caseId, panelMemberId));
              }}
              className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
            >
              <label className="flex-1">
                <span className="text-sm font-medium text-slate-700">Re-route to</span>
                <select
                  name="panelMemberId"
                  defaultValue={options[0].id}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {options.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.firm ? ` (${member.firm})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Re-route
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">
              No other active panel member for this role.
            </p>
          )
        ) : (
          <p className="text-sm text-amber-800">
            Re-route is a paid Done-With-You control.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Integrate into `src/app/cockpit/cases/[caseId]/page.tsx`**

Add imports:

```ts
import { PartnerOpsControls } from "@/components/PartnerOpsControls";
import { ReferralPanel } from "@/components/ReferralPanel";
import { isPartnerActorRole } from "@/domain/types";
import { activeReferralForRole, listReferralsForCase } from "@/server/referrals";
```

After `const panel = await listPanel({ activeOnly: true });` (added in Task 6) add:

```ts
  const referrals = await listReferralsForCase(caseId);
  const focusOwnerRole =
    focus && isPartnerActorRole(focus.ownerRole) ? focus.ownerRole : null;
  const currentReferral = focusOwnerRole
    ? await activeReferralForRole(caseId, focusOwnerRole)
    : null;
  const rerouteOptions = focusOwnerRole
    ? panel.filter((member) => member.roleType === focusOwnerRole)
    : [];
```

Note `focus` is declared before this block (`const focus = getFocusStage(caseState);`) — place the new block after it.

Immediately after the `<WarmIntroButton ... />` wrapper `<div>` add:

```tsx
      <PartnerOpsControls
        caseId={caseId}
        paid={caseState.tier === "PAID_DWY"}
        focusOwnerRole={focusOwnerRole}
        currentPartner={
          currentReferral
            ? { id: currentReferral.partnerId, name: currentReferral.partnerName }
            : null
        }
        rerouteOptions={rerouteOptions}
      />

      <ReferralPanel caseId={caseId} referrals={referrals} panel={panel} />
```

Extend the existing warm-intro history filter so partner ops appear in the same ledger list. Replace:

```ts
  const warmIntroEvents = caseState.events.filter(
    (e) => e.type === "WARM_INTRO_REQUESTED",
  );
```

with:

```ts
  const partnerEvents = caseState.events.filter((e) =>
    ["WARM_INTRO_REQUESTED", "PARTNER_NUDGED", "PARTNER_REROUTED"].includes(e.type),
  );
```

and in the JSX replace `warmIntroEvents` with `partnerEvents`, the heading text `Warm intro history` with `Partner history`, and render the event type before the stage key:

```tsx
                <span className="font-medium">{event.type.replace(/_/g, " ").toLowerCase()}</span>
                {" · "}
                {event.stageKey}
                {" · "}
                {new Date(event.at).toLocaleString()}
```

- [ ] **Step 5: Verify in the browser**

`npm run dev`, sign in as advisor, open **Bloggs return (paid)**:
1. Warm intro → pick `mortgage partner — Priya Nair (Northstar Mortgages)` → submit. **Referrals & disclosure** shows Priya, `warm intro`, fee `expected`, disclosure text containing "introducer only". **Partner history** shows `warm intro requested`.
2. Change fee status to `received` → Save → persists. Try `waived` → error banner `Cannot move fee status from RECEIVED to WAIVED`.
3. Advance the case to `mortgage_path` (client submits profile + money evidence, advisor accepts + advances). **Partner ops** appears: nudge → `partner nudged` in history. Re-route to **Ravi Patel** is not offered (inactive); reinstate Ravi on `/cockpit/panel`, come back, re-route → Priya's referral shows `superseded`, new `reroute` referral for Ravi, `partner rerouted` in history.
4. `/cockpit/panel`: Priya now has 1 stage attributed; sign in as `mortgage@example.com` → case no longer listed after re-route if Ravi has no login (Priya detached).
5. Open **Smith DIY journey** (free): re-route shows "paid Done-With-You control"; **Record referral** still works (advisor mark with disclosure).

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/partner-network.ts src/components/ReferralPanel.tsx src/components/PartnerOpsControls.tsx "src/app/cockpit/cases/[caseId]/page.tsx"
git commit -m "feat: cockpit referral ledger, fee status, partner nudge and re-route"
```

---

### Task 9: Client portal — referral disclosure and Free DIY partner directory

**Files:**
- Create: `src/components/ReferralDisclosure.tsx`
- Create: `src/components/PartnerDirectory.tsx`
- Modify: `src/app/portal/cases/[caseId]/page.tsx`

**Interfaces:**
- Consumes: `listReferralsForCase` (Task 5); `listPanel` (Task 1); `directoryEntries`, `canViewDirectory`, `DirectoryEntry` (Task 1); `ReferralRecord` (Task 2).
- Produces:
  - `ReferralDisclosure` props: `{ referrals: ReferralRecord[] }` — renders non-superseded referrals: partner, role, disclosure text, disclosed date. **Never** renders fee status values, SLA or scores.
  - `PartnerDirectory` props: `{ entries: DirectoryEntry[] }` — names/categories only, with the paid CTA.

- [ ] **Step 1: Create `src/components/ReferralDisclosure.tsx`**

```tsx
import type { ReferralRecord } from "@/domain/referral";

type Props = {
  referrals: ReferralRecord[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

/** Client-facing disclosure. Spec §7: conveyancing referrals lawful if disclosed; mortgage introducer only. */
export function ReferralDisclosure({ referrals }: Props) {
  const live = referrals.filter((referral) => referral.supersededAt === null);
  if (live.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Your introduced partners</h2>
      <p className="mt-1 text-sm text-slate-600">
        How we are paid when we introduce a partner. You are always free to use
        someone else.
      </p>
      <ul className="mt-3 space-y-3">
        {live.map((referral) => (
          <li
            key={referral.id}
            className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
          >
            <p className="font-medium text-slate-900">
              {referral.partnerName}
              {referral.partnerFirm && ` (${referral.partnerFirm})`}
              <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">
                {label(referral.partnerRole)}
              </span>
            </p>
            <p className="mt-1 text-slate-700">{referral.disclosureText}</p>
            <p className="mt-1 text-xs text-slate-500">
              Disclosed {new Date(referral.disclosedAt).toLocaleDateString("en-GB")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/PartnerDirectory.tsx`**

```tsx
import Link from "next/link";
import type { DirectoryEntry } from "@/domain/panel";

type Props = {
  entries: DirectoryEntry[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

/** Spec §5: Free DIY gets a "Partner directory (not warm intro)". Names and categories only. */
export function PartnerDirectory({ entries }: Props) {
  const byRole = new Map<string, DirectoryEntry[]>();
  for (const entry of entries) {
    const list = byRole.get(entry.roleType) ?? [];
    list.push(entry);
    byRole.set(entry.roleType, list);
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Partner directory</h2>
      <p className="mt-1 text-sm text-slate-600">
        Our curated England &amp; Wales panel. On Done-With-You your advisor makes
        the introduction, stays in the thread, and chases on your behalf.
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Directory coming soon.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[...byRole.entries()].map(([roleType, list]) => (
            <div key={roleType}>
              <p className="text-xs uppercase text-slate-500">{label(roleType)}</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-800">
                {list.map((entry) => (
                  <li key={`${roleType}-${entry.name}`}>
                    {entry.name}
                    {entry.firm && (
                      <span className="text-slate-500"> · {entry.firm}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Link
        href="/pricing"
        className="mt-4 inline-block rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
      >
        Upgrade for a warm introduction
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Integrate into `src/app/portal/cases/[caseId]/page.tsx`**

Add imports:

```ts
import { PartnerDirectory } from "@/components/PartnerDirectory";
import { ReferralDisclosure } from "@/components/ReferralDisclosure";
import { canViewDirectory, directoryEntries } from "@/domain/panel";
import { listPanel } from "@/server/panel";
import { listReferralsForCase } from "@/server/referrals";
```

After `const now = new Date();` add:

```ts
  const referrals = await listReferralsForCase(caseId);
  const directory = canViewDirectory(caseState)
    ? directoryEntries(await listPanel({ activeOnly: true }))
    : null;
```

At the end of the returned `<section>`, after the **Submit evidence** block, add:

```tsx
      <ReferralDisclosure referrals={referrals} />

      {directory && <PartnerDirectory entries={directory} />}
```

- [ ] **Step 4: Verify in the browser**

Sign in as `client@example.com`:
- **Bloggs return (paid)** (after the Task 8 walkthrough): **Your introduced partners** lists the live referral(s) with disclosure text and date; no fee status, no SLA, no score anywhere on the page; no directory.
- **Smith DIY journey** (free): **Partner directory** lists four active names grouped by role with the violet **Upgrade for a warm introduction** button; no SLA days shown. If the advisor recorded a referral on this free case, the disclosure block appears above the directory.

- [ ] **Step 5: Guard against IP leakage with a grep**

Run: `rg -n "slaDays|qualityScore|missRate|recommendReroute" src/app/portal src/app/partner src/components/ReferralDisclosure.tsx src/components/PartnerDirectory.tsx`
Expected: no matches.

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReferralDisclosure.tsx src/components/PartnerDirectory.tsx "src/app/portal/cases/[caseId]/page.tsx"
git commit -m "feat: client portal referral disclosure and free DIY partner directory"
```

---

### Task 10: Demo script, README, final verification

**Files:**
- Create: `docs/superpowers/plans/demo-script-partner-network.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything shipped in Tasks 1–9.
- Produces: founder-runnable click script and README sections for the panel, scorecards, referrals and directory.

- [ ] **Step 1: Write `docs/superpowers/plans/demo-script-partner-network.md`**

```markdown
# Partner network demo script

Founder validation script for the **curated panel + ledger scorecards + disclosed referrals** thesis: partners are scored from the same stage ledger the client sees, every intro is disclosed, and non-response has a visible consequence (nudge → scorecard hit → re-route).

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The panel is curated, not a marketplace

1. Sign in as **`advisor@example.com`** → `/cockpit/panel`.
2. Confirm five rows: Priya Nair (mortgage), Ravi Patel (mortgage, **inactive**), Tom Ashby and Lena Okoro (conveyancers), Dan Whitfield (move).
3. Every rating reads **no data** — the ledger has not yet attributed a partner-owned stage.
4. Click **Demote** on Lena → she greys out; **Reinstate** restores her. There is no partner self-signup anywhere.

## 2. A warm intro names a partner and records a disclosure

1. `/cockpit/cases` → **Bloggs return (paid)**.
2. **Warm intro** → choose `mortgage partner — Priya Nair (Northstar Mortgages)` → note → **Request warm intro**.
3. Confirm **Referrals & disclosure** shows Priya, source `warm intro`, fee `expected`, and the disclosure text containing "introducer only" and "do not give mortgage advice".
4. **Partner history** shows `warm intro requested` with `panelMemberName` in the payload.

## 3. The client sees the disclosure (and nothing else)

1. Sign in as **`client@example.com`** → **Bloggs return (paid)**.
2. **Your introduced partners** shows Priya with the disclosure text and date.
3. Confirm the page shows no SLA days, no scores, no fee status.

## 4. Drive the case to the partner-owned stage

1. As client: submit `profile_complete`. As advisor: accept → **Advance stage**.
2. As client: submit `source_of_funds` and `fx_plan`. As advisor: accept both → **Advance stage**.
3. Focus is now **mortgage_path**, owner **MORTGAGE_PARTNER**. **Partner ops** appears on the cockpit case page naming Priya.

## 5. Partner participation earns credit

1. Sign in as **`mortgage@example.com`** (Priya's login) → `/partner` lists the Bloggs case → open → submit `dip_aip`.
2. Sign in as advisor → `/cockpit/panel`: Priya shows **Stages 1**, **Portal 100%**.

## 6. Non-response: nudge → scorecard hit → re-route

1. On the cockpit case page, click **Nudge partner** → **Partner history** shows `partner nudged`; `/cockpit/panel` shows **Nudges 1** and the score dips.
2. `/cockpit/panel` → **Reinstate** Ravi Patel.
3. Back on the case → **Re-route to Ravi Patel (Ledger Mortgages)** → **Re-route**.
4. **Referrals & disclosure**: Priya's referral is marked `superseded`; a new `reroute` referral exists for Ravi. **Partner history** shows `partner rerouted`.
5. Sign in as **`mortgage@example.com`** → `/partner` no longer lists the Bloggs case (Priya was detached; Ravi has no portal login).
6. Sign in as client → **Your introduced partners** now shows Ravi's disclosure only.

## 7. Fee status is recorded, never paid

1. As advisor, on Ravi's referral set fee status to **received** → Save.
2. Try **waived** → error: `Cannot move fee status from RECEIVED to WAIVED`.

## 8. Free DIY gets a directory, not an intro

1. Sign in as client → **Smith DIY journey**.
2. **Partner directory** lists names grouped by role with **Upgrade for a warm introduction**. No SLA, no scores.
3. Sign in as advisor → open the free case → **Re-route** reads "paid Done-With-You control"; **Warm intro** is disabled.
4. **Record referral** (advisor mark, e.g. Tom Ashby, fee `expected`) still works — free self-selection is still disclosed. Sign in as client → the disclosure appears above the directory.

---

## Thesis checklist

| Claim | Where to verify |
|-------|-----------------|
| Curated panel, advisor-managed | `/cockpit/panel` demote / reinstate; no partner signup |
| Scorecards derived from the ledger | Panel metrics change only via stage events (submit, nudge, advance) |
| SLA breach feeds the scorecard | Miss / breach columns use the partner SLA with the case escalation rules |
| Every intro disclosed | Referral row + client **Your introduced partners** |
| Mortgage = introducer only | Disclosure text on any mortgage referral |
| Non-response has consequences | Nudge → nudges count; re-route → superseded referral + participant swap |
| Fees recorded, not paid | Fee status transitions only; no payout UI |
| Free = directory, paid = named intro | Free case shows directory; paid case shows named referral |
| No partner IP in client/partner surfaces | `rg -n "slaDays|qualityScore|missRate" src/app/portal src/app/partner` → empty |

---

## Automated verification

```bash
npm test
npm run build
```
```

- [ ] **Step 2: Update `README.md`**

Add the panel members to the **Seed logins** section, after the seeded cases list:

```markdown
Seeded partner panel (`PartnerPanel`):

| Panel member | Role | SLA | Login |
|--------------|------|-----|-------|
| Priya Nair — Northstar Mortgages | `MORTGAGE_PARTNER` | 3d | `mortgage@example.com` |
| Ravi Patel — Ledger Mortgages | `MORTGAGE_PARTNER` | 3d | none (seeded **inactive**) |
| Tom Ashby — Harbour Law LLP | `CONVEYANCER` | 5d | `conveyancer@example.com` |
| Lena Okoro — Greenway Conveyancing | `CONVEYANCER` | 5d | none |
| Dan Whitfield — Compass Removals | `MOVE_PARTNER` | 4d | `move@example.com` |
```

Add a new section after **Acquisition funnel** and before **Advisor operating IP**:

```markdown
## Partner panel, scorecards and referrals

The partner network is a **curated panel**, not a marketplace. Advisors manage it at
`/cockpit/panel`, where each member is scored from the stage ledger alone
(`src/domain/scorecard.ts`): stages attributed, completions, average days in stage,
miss rate and breaches against the member's own SLA (reusing
`src/domain/escalation.ts`), portal participation, nudges, and a 0–100 quality
score with a `STRONG / WATCH / UNDERPERFORMING / NO_DATA` rating. Demoted members
keep their history but cannot receive intros.

Every warm intro (paid) or advisor-marked referral (any tier) creates a
`Referral` with a fee status (`NONE → EXPECTED → RECEIVED | WAIVED`, recorded only —
nothing is paid from this system) and an England & Wales disclosure text
(`src/domain/referral.ts`). Mortgage disclosures state introducer-only / no advice.
Clients see live disclosures on their case page; they never see SLA days, scores or
fee status.

Partner non-response follows the spec: **nudge** (`PARTNER_NUDGED` event, counts
against the scorecard) → **re-route** (`PARTNER_REROUTED` event, previous referral
superseded, partner participant swapped). Free DIY cases get a names-only
**partner directory** with a paid CTA instead of a warm intro.

Walkthrough: [`docs/superpowers/plans/demo-script-partner-network.md`](docs/superpowers/plans/demo-script-partner-network.md).
```

Update the **Happy-path demo** step 3 to read:

```markdown
3. Advisor requests warm intro to a **named panel member** (event + disclosed referral logged on case).
```

- [ ] **Step 3: Final verification**

Run: `npm run db:seed && npm test && npm run build`
Expected: seed exits 0; all Vitest suites pass; `next build` completes with `/cockpit/panel` in the route list and no type errors.

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/plans/demo-script-partner-network.md README.md
git commit -m "docs: partner network demo script and README"
git push -u origin feat/plan-3-partner-scorecards
```

---

## Self-review

**1. Spec coverage (Plan 3 deliverables → tasks)**

| Deliverable | Task(s) |
|-------------|---------|
| PartnerPanel model (role type, name, active, slaDays, optional userId), seed 3–5 members | Task 1 (5 seeded; 3 linked to partner logins, 1 inactive) |
| Scorecards from StageEvent + Stage timing for partner-owned stages (pure domain + server aggregator) | Task 3 (pure), Task 5 (`loadPanelScorecards`) |
| Advisor cockpit: panel list + scorecard view; re-route / demote underperformers | Task 7 (list, ratings, demote/reinstate), Task 8 (re-route) |
| Referral records on warm intro / advisor mark: fee status + disclosure timestamp/text; client portal shows disclosure | Task 2 (domain), Task 5 (persistence), Task 6 (warm intro), Task 8 (advisor mark, fee status), Task 9 (portal) |
| Free DIY partner directory (names/categories only); paid keeps warm intro via existing port | Task 1 (`directoryEntries`, `canViewDirectory`), Task 9 (UI), Task 6 (port deepened, not replaced) |
| Partner SLA breach from escalation feeds scorecard | Task 3 (`isOverSla`, `escalationLevel` from `escalation.ts` with member `slaDays`) |
| Partner non-response → nudge + scorecard hit + advisor re-route | Task 4 (events), Task 3 (nudges in score), Task 8 (actions/UI) |
| Conveyancing referral fees lawful if disclosed; mortgage introducer only | Task 2 disclosure copy + tests |
| Manual PartnerPort deepened without third-party APIs | Task 6 |
| Demo script + README | Task 10 |
| Lead attribution not rebuilt | No task touches `leadSource/leadCampaign/leadReferrer` |

Non-goals respected: no partner APIs, no chain-free, no client-facing SLA numbers (portal shows disclosure only; grep guard in Task 9 Step 5), no document vault, no market-pack config UI, no FCA AR, no payouts (fee status is a recorded enum).

**2. Placeholder scan** — no TBD/TODO; every code step has full code; every test step has exact commands and expected outcomes; UI verification steps list concrete clicks and expected text.

**3. Type consistency**
- `PanelMember` defined in `src/domain/panel.ts` (Task 1) and imported by `scorecard.ts` (3), `server/panel.ts` (1), `WarmIntroButton` (6), `ReferralPanel` / `PartnerOpsControls` (8).
- `ReferralRecord` fields (`partnerName`, `partnerFirm`, `partnerRole`, `source`, `feeStatus`, `disclosureText`, `disclosedAt`, `supersededAt`, `createdAt`) match `toReferralRecord` (5), `ReferralPanel` (8) and `ReferralDisclosure` (9).
- `ScorecardAttribution = { caseState, referralCreatedAt, supersededAt }` used identically in Task 3 tests and Task 5 aggregator.
- `PanelScorecardRow` lives in `domain/scorecard.ts` and is consumed by `server/scorecards.ts` (5), `PanelTable` (7), `panel/page.tsx` (7).
- `attachPartnerParticipant(caseId, role, preferredUserId?)` / `detachPartnerParticipant(caseId, userId)` signatures match between Task 6 implementation, Task 6 test, and Task 8 `reroutePartnerAction`.
- `warmIntroAction(caseId, panelMemberId, note)` matches the rewritten `WarmIntroButton`.
- Event type strings `PARTNER_NUDGED` / `PARTNER_REROUTED` are identical in `partner-ops.ts` (4), `scorecard.ts` (3), the Task 3 test fixture, and the cockpit history filter (8).
- `assertReroute` is defined in Task 6 and used in Task 8; `PartnerNetworkError` is defined in Task 1 and mapped in Tasks 6 and 7/8 actions.
