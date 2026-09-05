# Deep Partner Integrations — Speed Rails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `PartnerPort` from a one-method warm-intro hook into a real partner integration surface — `acknowledgeCase`, `syncStatus`, `submitPartnerEvidence`, `reportMilestone` alongside the frozen `requestWarmIntro` — implemented by role-specific **stub adapters** (mortgage, conveyancer, FX/move) that simulate vendor turnaround deterministically and write to the same stage ledger. Add an inbound update path (parse → map partner status to an orchestration intent → execute through the port) reachable from a stub webhook endpoint, a substantially stronger partner mini-view (case context, required-evidence inbox, acknowledge / submit / milestone), and advisor cockpit visibility into integration tickets and adapter activity. All of it gated behind the `partner_speed_rails` module flag: on for `ew`, off for the disabled `au` stub. No live vendor HTTP, no OAuth, no client-facing guarantees.

**Architecture:** Four layers, no cycles.

1. **Pure domain** (`src/domain/partner-integration.ts`, `src/domain/partner-activity.ts`) — the vendor-neutral vocabulary (`PartnerStatus`, integration event types), a stable JSON payload envelope with codec, `intentForStatus` (partner status → what the orchestrator is allowed to do), the required-evidence inbox, and ledger-derived ticket/activity view models. No Prisma, no Next.js, no jurisdiction literals.
2. **Market-local data** (`src/domain/market-packs/ew-milestones.ts` + `MarketPack.partnerMilestones`) — milestone vocabulary ("searches ordered", "DIP submitted") is conveyancing/mortgage process language, therefore pack data, not engine data. Spec §10: "mortgage rules, conveyancing … always local".
3. **Ports and adapters** (`src/lib/case-store.ts`, `src/lib/partner-port.ts`, `src/lib/partner-adapters/*`) — the port interface, a `CaseStore` seam so adapters are unit-testable without a database, `ManualPartnerPort` (the v1 manual-ops implementation, `adapterId: "manual"`), and three `StubPartnerAdapter` profiles. `partnerPortForCase` picks stub vs manual from the pack flag.
4. **Server + surfaces** (`src/server/partner-integration.ts`, actions, route handler, pages) — policy gate, inbound apply, server actions, partner mini-view, cockpit panel.

**The invariant that makes this a rail and not a rewrite:** adapters and the inbound path may only *submit evidence* and *append events*. They never accept evidence, never advance, block, resume or re-route a stage, and never mint a referral. Every state transition that moves a case forward stays with the advisor. Event shapes already in the ledger (`WARM_INTRO_REQUESTED`, `EVIDENCE_SUBMITTED`, `PARTNER_NUDGED`, `PARTNER_REROUTED`) are frozen byte-for-byte; the four new types are purely additive.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§7 partner model + "manual partner ops in v1 behind clean APIs/interfaces", §8 architecture stance + failure/pressure behaviour, §9 Phase 2 speed rails + dependency rule, §10 what travels / what doesn't, §13 sub-project 5).

**Builds on (already shipped, do not rebuild):**
- `docs/superpowers/plans/2026-09-04-core-stage-portal.md` — stage engine (`src/domain/stage-engine.ts`: `CaseState`, `StageState`, `submitPartnerEvidence`, `acceptEvidence`, `advanceStage`, `blockStage`), `src/domain/escalation.ts`, `src/domain/freemium.ts`, portal / cockpit / partner surfaces, `src/server/mappers.ts` + `src/server/cases.ts` persistence, `src/server/partner-policy.ts`.
- `docs/superpowers/plans/2026-09-04-acquisition-ops-playbook.md` — intake, attribution, `/start` funnel, advisor playbooks, `assertPlaybookVisible`.
- `docs/superpowers/plans/2026-09-04-partner-scorecards-referrals.md` — `PartnerPanel` + `Referral` models, `src/domain/panel.ts`, `src/domain/referral.ts`, `src/domain/scorecard.ts`, `src/domain/partner-ops.ts` (`nudgePartner`, `reroutePartner`), `src/server/panel.ts`, `src/server/referrals.ts`, `src/server/scorecards.ts`, warm intro / nudge / re-route actions, `PartnerOpsControls`.
- `docs/superpowers/plans/2026-09-04-market-pack-config.md` — `MarketPack` interface, `MarketFlags` + `isModuleEnabled`, fail-closed `registry.ts`, `src/lib/case-pack.ts` (`casePack`, `stageSlaDays`), market-local panel (`assertPanelMemberInMarket`), `marketPackSummary` inspector, `tests/support/fixture-pack.ts`, the country-agnostic guard test.

**Follow-on plans (not this plan):** chain-free certification and matching (Plan 6), additional corridor market packs AU↔UK / US↔UK (Plan 7), document vault, hard client-facing SLAs, FCA Appointed Representative status, open partner marketplace.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include this section.

- **Clean interfaces, manual fulfilment acceptable:** §7 "Manual partner ops in v1 behind clean APIs/interfaces so deeper integrations can land without rewrite"; §8 "Clean partner interfaces from day one; manual fulfilment acceptable in v1". `ManualPartnerPort` must implement the *whole* expanded port, not a subset — the manual path stays first-class, and a future real vendor client is a fourth implementation of the same type.
- **Ledger event shapes are stable:** `WARM_INTRO_REQUESTED` keeps its exact payload keys (`partnerType`, `note`, `ticketId`, `panelMemberId`, `panelMemberName`) and its `ADVISOR` actor role; `EVIDENCE_SUBMITTED` keeps its bare-string `kind` payload; `PARTNER_NUDGED` and `PARTNER_REROUTED` are untouched. `tests/server/warm-intro.test.ts` must pass unmodified.
- **Adapters do not own the case:** no adapter, action or inbound update may call `acceptEvidence`, `advanceStage`, `blockStage`, `resumeStage`, `reroutePartner` or `createReferral`. Guarded by a source-scanning test.
- **Dependency rule:** §9 "Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real." `chain_free_inventory` and `hard_client_sla` stay off in every pack. Nothing in this plan renders a promised or guaranteed date to a client; partner status is advisor-facing and partner-facing only.
- **What travels vs what doesn't:** §10. Statuses, tickets, the port and the activity model are engine-global. Milestone vocabulary, partner role labels and panel membership are pack-local.
- **Fail closed:** speed rails are off unless the case's resolved pack enables `partner_speed_rails`. A disabled or unknown pack still throws `MarketPackError`; the inbound path must never create a case, never invent a ticket and never fall back to `ew`.
- **Freemium discipline:** §5/§11 "IP behind paid". Speed-rail actions require `PAID_DWY`. Free DIY cases keep the directory-only experience with no partner integration surface.
- **Partner sees only their own lane:** the partner mini-view must never render playbook prose, scorecards, quality scores, SLA-adherence data, referral fee status, other partners' tickets, or client attribution.
- **No live vendors:** no `fetch`/`axios`/HTTP client to any third party, no OAuth, no API keys for vendors, no webhooks *out*. The inbound route handler is a local loopback for the demo, authenticated by one shared secret, documented as a stub.
- **Determinism:** simulated latency is a pure function of injected `now` and stage timestamps. No `Math.random()` anywhere in adapters — tests must be able to assert exact statuses.
- **Engineering:** TDD per task (failing test → minimal implementation → passing test → commit); pure domain modules import no framework, Next.js or Prisma code; server actions keep the existing `{ ok: true } | { ok: false; error: string }` shape; existing tests keep passing (`npm test`); `npm run build` passes at the end; DRY, YAGNI.

## File structure (locked)

```
.env.example                                   # MODIFY (Task 7): PARTNER_WEBHOOK_SECRET
src/
  domain/
    partner-integration.ts                     # NEW (Task 1): statuses, event types, codec, intents, evidence inbox
    partner-activity.ts                        # NEW (Task 1): partnerActivity / partnerTickets view models
    market-packs/
      types.ts                                 # MODIFY (Task 2): PartnerMilestone + MarketPack.partnerMilestones
      ew-milestones.ts                         # NEW (Task 2): E&W milestone vocabulary
      ew.ts                                    # MODIFY (Task 2): assemble partnerMilestones
      ew-config.ts                             # MODIFY (Task 3): partner_speed_rails: true
      au-stub.ts                               # MODIFY (Task 2): partnerMilestones -> []
      inspector.ts                             # MODIFY (Task 2): milestone keys in the summary
  lib/
    case-store.ts                              # NEW (Task 4): CaseStore seam + prismaCaseStore
    partner-port.ts                            # MODIFY (Task 4): full port surface + ManualPartnerPort
    partner-adapters/
      profiles.ts                              # NEW (Task 5): AdapterProfile + the three role profiles
      stub-adapter.ts                          # NEW (Task 5): StubPartnerAdapter
      registry.ts                              # NEW (Task 5): partnerPortForCase / partnerPortForRole
  server/
    partner-policy.ts                          # MODIFY (Task 3): canUseSpeedRails / assertSpeedRails
    partner-integration.ts                     # NEW (Task 6): parseInboundUpdate / applyPartnerUpdate
  app/
    actions/
      partner.ts                               # MODIFY (Task 7): evidence submit routes through the port
      partner-integration.ts                   # NEW (Task 7): acknowledge / milestone / sync actions
    api/partner-updates/route.ts               # NEW (Task 7): stub inbound webhook (shared secret)
    partner/cases/[caseId]/page.tsx            # MODIFY (Task 8): context, inbox, integration controls
    cockpit/cases/[caseId]/page.tsx            # MODIFY (Task 9): integration panel replaces ad-hoc history
  components/
    PartnerIntegrationControls.tsx             # NEW (Task 8): partner-side acknowledge / milestone
    PartnerCaseContext.tsx                     # NEW (Task 8): partner-side case context card
    PartnerIntegrationPanel.tsx                # NEW (Task 9): advisor ticket + activity panel
tests/
  domain/partner-integration.test.ts           # NEW (Task 1)
  domain/partner-activity.test.ts              # NEW (Task 1)
  domain/partner-milestones.test.ts            # NEW (Task 2)
  domain/market-pack-flags.test.ts             # MODIFY (Task 3): speed rails on for ew only
  domain/market-pack-inspector.test.ts         # MODIFY (Task 2): milestone keys
  domain/engine-country-agnostic.test.ts       # MODIFY (Task 1): guard the new domain files
  support/fixture-pack.ts                      # MODIFY (Task 2): partnerMilestones
  support/memory-case-store.ts                 # NEW (Task 4): in-memory CaseStore for adapter tests
  lib/partner-port.test.ts                     # NEW (Task 4)
  lib/partner-adapters.test.ts                 # NEW (Task 5)
  server/speed-rails-policy.test.ts            # NEW (Task 3)
  server/partner-inbound.test.ts               # NEW (Task 6)
  server/partner-webhook.test.ts               # NEW (Task 7)
  server/adapter-authority.test.ts             # NEW (Task 5): adapters never advance/accept/block
docs/
  superpowers/plans/demo-script-speed-rails.md # NEW (Task 10)
  superpowers/plans/demo-script-market-packs.md# MODIFY (Task 10): speed-rails flag is now on
README.md                                      # MODIFY (Task 10)
```

**Layering rule (read before implementing any task):** `src/domain/partner-integration.ts` imports only `./stage-engine` and `./types`. `src/domain/partner-activity.ts` imports `./partner-integration`, `./stage-engine`, `./escalation`, `./types`. `src/lib/partner-port.ts` imports the domain + `./case-store` (type-only where possible). `src/lib/partner-adapters/*` imports the port, the domain and `@/lib/case-pack`. `src/server/partner-integration.ts` is the only module that combines the adapters registry with Prisma-backed loading. Route handlers and actions never touch the engine directly — they go through the port or through `applyPartnerUpdate`.

---

### Task 1: Partner integration vocabulary, payload codec and ledger-derived activity

**Files:**
- Create: `src/domain/partner-integration.ts`
- Create: `src/domain/partner-activity.ts`
- Create: `tests/domain/partner-integration.test.ts`
- Create: `tests/domain/partner-activity.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts:11-24` (add both new files to `ENGINE_GLOBAL_FILES`)

**Interfaces:**
- Consumes: `CaseState`, `StageState`, `getFocusStage` from `src/domain/stage-engine.ts`; `ActorRole`, `isPartnerActorRole` from `src/domain/types.ts`; `daysInStage` from `src/domain/escalation.ts`.
- Produces from `partner-integration.ts`: `PartnerStatus`, `PARTNER_STATUSES`, `isPartnerStatus`, `PartnerIntegrationEventType`, `PARTNER_INTEGRATION_EVENT_TYPES`, `PartnerEventPayload`, `encodePartnerEventPayload`, `decodePartnerEventPayload`, `mintTicketId`, `PartnerUpdateIntent`, `intentForStatus`, `EvidenceInbox`, `partnerEvidenceInbox`.
- Produces from `partner-activity.ts`: `PartnerActivityRow`, `partnerActivity`, `PartnerTicketSummary`, `partnerTickets`, `openTicketForRole`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/partner-integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  decodePartnerEventPayload,
  encodePartnerEventPayload,
  intentForStatus,
  isPartnerStatus,
  mintTicketId,
  partnerEvidenceInbox,
  PARTNER_INTEGRATION_EVENT_TYPES,
} from "../../src/domain/partner-integration";
import type { StageState } from "../../src/domain/stage-engine";

function stage(overrides: Partial<StageState> = {}): StageState {
  return {
    key: "mortgage_path",
    title: "Mortgage path",
    sortOrder: 2,
    status: "ACTIVE",
    ownerRole: "MORTGAGE_PARTNER",
    dueAt: null,
    activatedAt: "2026-09-01T09:00:00.000Z",
    completedAt: null,
    blockedReason: null,
    requiredEvidenceKinds: ["dip_aip", "lender_pack"],
    freeVisible: true,
    freeCanSelfAdvance: false,
    acceptedEvidenceKinds: [],
    submittedEvidenceKinds: [],
    ...overrides,
  };
}

describe("integration vocabulary", () => {
  it("closes the status set and the additive event-type set", () => {
    expect(isPartnerStatus("EVIDENCE_READY")).toBe(true);
    expect(isPartnerStatus("SHIPPED")).toBe(false);
    expect(PARTNER_INTEGRATION_EVENT_TYPES).toEqual([
      "PARTNER_CASE_ACKNOWLEDGED",
      "PARTNER_STATUS_SYNCED",
      "PARTNER_MILESTONE_REPORTED",
      "PARTNER_UPDATE_REJECTED",
    ]);
  });

  it("mints stable, prefixed, collision-resistant ticket ids", () => {
    const id = mintTicketId({ prefix: "ack", caseId: "c1", at: "2026-09-01T09:00:00.000Z" });
    expect(id).toBe("ack-c1-1756717200000");
    expect(mintTicketId({ prefix: "warm", caseId: "c1", at: "2026-09-01T09:00:00.000Z" })).toBe(
      "warm-c1-1756717200000",
    );
  });
});

describe("payload codec", () => {
  it("round-trips the envelope", () => {
    const envelope = {
      ticketId: "ack-c1-1",
      adapterId: "stub-mortgage",
      role: "MORTGAGE_PARTNER" as const,
      panelMemberId: "seed_panel_priya",
      status: "IN_PROGRESS" as const,
      note: "Fact find booked",
    };
    expect(decodePartnerEventPayload(encodePartnerEventPayload(envelope))).toEqual(envelope);
  });

  it("normalises the frozen warm-intro payload into the same envelope", () => {
    const legacy = JSON.stringify({
      partnerType: "CONVEYANCER",
      note: "Needs instructing this week",
      ticketId: "warm-c1-99",
      panelMemberId: "seed_panel_tom",
      panelMemberName: "Tom Ashby",
    });
    expect(decodePartnerEventPayload(legacy)).toMatchObject({
      ticketId: "warm-c1-99",
      role: "CONVEYANCER",
      adapterId: "manual",
      panelMemberName: "Tom Ashby",
    });
  });

  it("returns null for a bare string payload or malformed JSON", () => {
    expect(decodePartnerEventPayload("dip_aip")).toBeNull();
    expect(decodePartnerEventPayload(undefined)).toBeNull();
    expect(decodePartnerEventPayload("{oops")).toBeNull();
  });
});

describe("intentForStatus", () => {
  it("acknowledges receipt without touching evidence", () => {
    expect(intentForStatus({ status: "RECEIVED", role: "MORTGAGE_PARTNER", stage: stage() })).toEqual({
      kind: "ACKNOWLEDGE",
    });
  });

  it("records progress and client-blocked as notes, never as engine blocks", () => {
    expect(intentForStatus({ status: "IN_PROGRESS", role: "MORTGAGE_PARTNER", stage: stage() }).kind).toBe(
      "NOTE_ONLY",
    );
    expect(
      intentForStatus({ status: "BLOCKED_ON_CLIENT", role: "MORTGAGE_PARTNER", stage: stage() }),
    ).toEqual({ kind: "NOTE_ONLY", note: "Partner is waiting on the client" });
  });

  it("submits only the outstanding kinds for EVIDENCE_READY and COMPLETE alike", () => {
    expect(
      intentForStatus({
        status: "EVIDENCE_READY",
        role: "MORTGAGE_PARTNER",
        stage: stage({ acceptedEvidenceKinds: ["dip_aip"] }),
      }),
    ).toEqual({ kind: "SUBMIT_EVIDENCE", kinds: ["lender_pack"] });
    expect(intentForStatus({ status: "COMPLETE", role: "MORTGAGE_PARTNER", stage: stage() })).toEqual({
      kind: "SUBMIT_EVIDENCE",
      kinds: ["dip_aip", "lender_pack"],
    });
  });

  it("rejects a wrong-role update and any update on a closed stage", () => {
    expect(
      intentForStatus({ status: "EVIDENCE_READY", role: "CONVEYANCER", stage: stage() }),
    ).toEqual({ kind: "REJECT", reason: "Stage owner is MORTGAGE_PARTNER, not CONVEYANCER" });
    expect(
      intentForStatus({
        status: "IN_PROGRESS",
        role: "MORTGAGE_PARTNER",
        stage: stage({ status: "DONE" }),
      }),
    ).toEqual({ kind: "REJECT", reason: "Stage is not open for partner updates" });
  });

  it("notes rather than resubmits when nothing is outstanding", () => {
    expect(
      intentForStatus({
        status: "EVIDENCE_READY",
        role: "MORTGAGE_PARTNER",
        stage: stage({ acceptedEvidenceKinds: ["dip_aip"], submittedEvidenceKinds: ["lender_pack"] }),
      }),
    ).toEqual({ kind: "NOTE_ONLY", note: "All required evidence is already with the advisor" });
  });
});

describe("partnerEvidenceInbox", () => {
  it("splits required kinds into to-submit, awaiting acceptance and accepted", () => {
    expect(
      partnerEvidenceInbox(
        stage({ acceptedEvidenceKinds: ["dip_aip"], requiredEvidenceKinds: ["dip_aip", "lender_pack", "id_check"], submittedEvidenceKinds: ["lender_pack"] }),
      ),
    ).toEqual({
      toSubmit: ["id_check"],
      awaitingAcceptance: ["lender_pack"],
      accepted: ["dip_aip"],
      complete: false,
    });
  });

  it("reports complete when every required kind is accepted", () => {
    expect(
      partnerEvidenceInbox(
        stage({ requiredEvidenceKinds: ["dip_aip"], acceptedEvidenceKinds: ["dip_aip"] }),
      ).complete,
    ).toBe(true);
  });
});
```

Create `tests/domain/partner-activity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { openTicketForRole, partnerActivity, partnerTickets } from "../../src/domain/partner-activity";
import { encodePartnerEventPayload } from "../../src/domain/partner-integration";
import type { CaseState } from "../../src/domain/stage-engine";

const NOW = new Date("2026-09-06T09:00:00.000Z");

function caseWithEvents(events: CaseState["events"]): CaseState {
  return {
    id: "c1",
    marketPackId: "ew",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    attribution: { leadSource: "DIRECT", leadCampaign: null, leadReferrer: null },
    stages: [],
    events,
  };
}

const WARM = {
  type: "WARM_INTRO_REQUESTED",
  stageKey: "mortgage_path",
  actorRole: "ADVISOR" as const,
  at: "2026-09-01T09:00:00.000Z",
  payload: JSON.stringify({
    partnerType: "MORTGAGE_PARTNER",
    note: "Returner, needs DIP quickly",
    ticketId: "warm-c1-1",
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
  }),
};

/** The new envelope, varying only the fields under test. */
function integrationEvent(
  type: string,
  at: string,
  extra: Record<string, unknown> = {},
): CaseState["events"][number] {
  return {
    type,
    stageKey: "mortgage_path",
    actorRole: "MORTGAGE_PARTNER",
    at,
    payload: encodePartnerEventPayload({
      ticketId: "warm-c1-1",
      adapterId: "stub-mortgage",
      role: "MORTGAGE_PARTNER",
      panelMemberId: "seed_panel_priya",
      ...extra,
    }),
  };
}

function evidenceEvent(actorRole: CaseState["events"][number]["actorRole"], at: string, kind: string) {
  return { type: "EVIDENCE_SUBMITTED", stageKey: "mortgage_path", actorRole, at, payload: kind };
}

const ACK = integrationEvent("PARTNER_CASE_ACKNOWLEDGED", "2026-09-02T09:00:00.000Z", {
  status: "RECEIVED",
});

describe("partnerActivity", () => {
  it("decodes both the new envelope and the frozen warm-intro shape", () => {
    const rows = partnerActivity(caseWithEvents([WARM, ACK]));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: "WARM_INTRO_REQUESTED",
      ticketId: "warm-c1-1",
      adapterId: "manual",
      role: "MORTGAGE_PARTNER",
    });
    expect(rows[1]).toMatchObject({ type: "PARTNER_CASE_ACKNOWLEDGED", status: "RECEIVED" });
  });

  it("attaches partner evidence to the open ticket and ignores client events", () => {
    const rows = partnerActivity(
      caseWithEvents([
        { type: "CASE_CREATED", stageKey: "purchase_profile", actorRole: "CLIENT", at: "2026-08-30T09:00:00.000Z" },
        WARM,
        evidenceEvent("CLIENT", "2026-08-31T09:00:00.000Z", "profile_complete"),
        evidenceEvent("MORTGAGE_PARTNER", "2026-09-03T09:00:00.000Z", "dip_aip"),
      ]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ type: "EVIDENCE_SUBMITTED", detail: "dip_aip", ticketId: "warm-c1-1" });
  });
});

describe("partnerTickets", () => {
  it("summarises a ticket with acknowledgement latency and last status", () => {
    const tickets = partnerTickets(
      caseWithEvents([
        WARM,
        ACK,
        integrationEvent("PARTNER_STATUS_SYNCED", "2026-09-04T09:00:00.000Z", { status: "IN_PROGRESS" }),
        integrationEvent("PARTNER_MILESTONE_REPORTED", "2026-09-05T09:00:00.000Z", {
          milestoneKey: "dip_submitted",
        }),
        evidenceEvent("MORTGAGE_PARTNER", "2026-09-05T10:00:00.000Z", "dip_aip"),
      ]),
      NOW,
    );

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      ticketId: "warm-c1-1",
      role: "MORTGAGE_PARTNER",
      adapterId: "stub-mortgage",
      panelMemberName: "Priya Nair",
      acknowledgedAt: "2026-09-02T09:00:00.000Z",
      ackLatencyDays: 1,
      lastStatus: "IN_PROGRESS",
      milestoneKeys: ["dip_submitted"],
      evidenceSubmitted: 1,
      closedAt: null,
    });
  });

  it("leaves ackLatencyDays null while a ticket is unacknowledged, and counts nudges", () => {
    const [ticket] = partnerTickets(
      caseWithEvents([
        WARM,
        {
          type: "PARTNER_NUDGED",
          stageKey: "mortgage_path",
          actorRole: "ADVISOR",
          at: "2026-09-03T09:00:00.000Z",
          payload: "MORTGAGE_PARTNER",
        },
      ]),
      NOW,
    );
    expect(ticket.acknowledgedAt).toBeNull();
    expect(ticket.ackLatencyDays).toBeNull();
    expect(ticket.openDays).toBe(5);
    expect(ticket.nudges).toBe(1);
  });

  it("closes the role's ticket on re-route and opens no new one until the next intro", () => {
    const tickets = partnerTickets(
      caseWithEvents([
        WARM,
        ACK,
        {
          type: "PARTNER_REROUTED",
          stageKey: "mortgage_path",
          actorRole: "ADVISOR",
          at: "2026-09-05T09:00:00.000Z",
          payload: JSON.stringify({
            roleType: "MORTGAGE_PARTNER",
            fromPartnerId: "seed_panel_priya",
            toPartnerId: "seed_panel_ravi",
          }),
        },
      ]),
      NOW,
    );
    expect(tickets[0].closedAt).toBe("2026-09-05T09:00:00.000Z");
    expect(tickets[0].closeReason).toBe("REROUTED");
    expect(openTicketForRole(caseWithEvents([WARM, ACK]), "MORTGAGE_PARTNER")?.ticketId).toBe("warm-c1-1");
    expect(openTicketForRole(caseWithEvents([]), "MORTGAGE_PARTNER")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/partner-integration.test.ts tests/domain/partner-activity.test.ts`
Expected: FAIL — `Cannot find module '../../src/domain/partner-integration'`.

- [ ] **Step 3: Create `src/domain/partner-integration.ts`**

```ts
import type { StageState } from "./stage-engine";
import type { ActorRole } from "./types";

/**
 * Spec §7: partner ops sit behind a clean interface. This is the vendor-neutral
 * vocabulary every adapter — manual, stub or a future real client — must speak.
 */
export const PARTNER_STATUSES = [
  "RECEIVED",
  "IN_PROGRESS",
  "BLOCKED_ON_CLIENT",
  "EVIDENCE_READY",
  "COMPLETE",
] as const;

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export function isPartnerStatus(value: string): value is PartnerStatus {
  return (PARTNER_STATUSES as readonly string[]).includes(value);
}

/** Additive only. The Plan 1-3 event types keep their exact shapes. */
export const PARTNER_INTEGRATION_EVENT_TYPES = [
  "PARTNER_CASE_ACKNOWLEDGED",
  "PARTNER_STATUS_SYNCED",
  "PARTNER_MILESTONE_REPORTED",
  "PARTNER_UPDATE_REJECTED",
] as const;

export type PartnerIntegrationEventType = (typeof PARTNER_INTEGRATION_EVENT_TYPES)[number];

export function mintTicketId(input: { prefix: string; caseId: string; at: string }): string {
  return `${input.prefix}-${input.caseId}-${new Date(input.at).getTime()}`;
}

/** The stable JSON envelope for every integration event payload. */
export type PartnerEventPayload = {
  ticketId: string;
  adapterId: string;
  role: ActorRole;
  panelMemberId: string | null;
  panelMemberName?: string;
  status?: PartnerStatus;
  milestoneKey?: string;
  note?: string;
  reason?: string;
  simulatedLatencyDays?: number;
};

export function encodePartnerEventPayload(payload: PartnerEventPayload): string {
  return JSON.stringify(payload);
}

/**
 * Reads both the new envelope and the frozen WARM_INTRO_REQUESTED shape, so the
 * activity view never needs a second parser. Bare-string payloads (EVIDENCE_SUBMITTED
 * carries only the kind) decode to null by design.
 */
export function decodePartnerEventPayload(raw: string | undefined): PartnerEventPayload | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const role = (record.role ?? record.partnerType) as ActorRole | undefined;
  if (typeof record.ticketId !== "string" || role === undefined) {
    return null;
  }

  const str = (key: string) => (typeof record[key] === "string" ? { [key]: record[key] } : {});

  return {
    ticketId: record.ticketId,
    adapterId: typeof record.adapterId === "string" ? record.adapterId : "manual",
    role,
    panelMemberId: typeof record.panelMemberId === "string" ? record.panelMemberId : null,
    ...str("panelMemberName"),
    ...str("milestoneKey"),
    ...str("note"),
    ...str("reason"),
    ...(typeof record.status === "string" && isPartnerStatus(record.status)
      ? { status: record.status }
      : {}),
    ...(typeof record.simulatedLatencyDays === "number"
      ? { simulatedLatencyDays: record.simulatedLatencyDays }
      : {}),
  };
}

export type EvidenceInbox = {
  toSubmit: string[];
  awaitingAcceptance: string[];
  accepted: string[];
  complete: boolean;
};

export function partnerEvidenceInbox(stage: StageState): EvidenceInbox {
  const accepted = stage.requiredEvidenceKinds.filter((k) => stage.acceptedEvidenceKinds.includes(k));
  const awaitingAcceptance = stage.requiredEvidenceKinds.filter(
    (k) => stage.submittedEvidenceKinds.includes(k) && !stage.acceptedEvidenceKinds.includes(k),
  );
  const toSubmit = stage.requiredEvidenceKinds.filter(
    (k) => !stage.submittedEvidenceKinds.includes(k) && !stage.acceptedEvidenceKinds.includes(k),
  );
  return {
    toSubmit,
    awaitingAcceptance,
    accepted,
    complete: stage.requiredEvidenceKinds.length > 0 && toSubmit.length === 0 && awaitingAcceptance.length === 0,
  };
}

/**
 * What a partner status entitles the orchestrator to do. Deliberately narrow: a partner
 * can add evidence and add facts to the ledger. Accepting, advancing, blocking and
 * re-routing remain advisor powers (spec §8 "stage engine is source of truth").
 */
export type PartnerUpdateIntent =
  | { kind: "ACKNOWLEDGE" }
  | { kind: "NOTE_ONLY"; note?: string }
  | { kind: "SUBMIT_EVIDENCE"; kinds: string[] }
  | { kind: "REJECT"; reason: string };

export function intentForStatus(input: {
  status: PartnerStatus;
  role: ActorRole;
  stage: StageState;
}): PartnerUpdateIntent {
  const { status, role, stage } = input;

  if (stage.ownerRole !== role) {
    return { kind: "REJECT", reason: `Stage owner is ${stage.ownerRole}, not ${role}` };
  }
  if (stage.status !== "ACTIVE" && stage.status !== "BLOCKED") {
    return { kind: "REJECT", reason: "Stage is not open for partner updates" };
  }

  if (status === "RECEIVED") {
    return { kind: "ACKNOWLEDGE" };
  }
  if (status === "IN_PROGRESS") {
    return { kind: "NOTE_ONLY" };
  }
  if (status === "BLOCKED_ON_CLIENT") {
    return { kind: "NOTE_ONLY", note: "Partner is waiting on the client" };
  }

  const outstanding = partnerEvidenceInbox(stage).toSubmit;
  if (outstanding.length === 0) {
    return { kind: "NOTE_ONLY", note: "All required evidence is already with the advisor" };
  }
  return { kind: "SUBMIT_EVIDENCE", kinds: outstanding };
}
```

- [ ] **Step 4: Create `src/domain/partner-activity.ts`**

Implementation notes (write it to satisfy the tests exactly):

- `PARTNER_LEDGER_TYPES` = the four integration types plus `WARM_INTRO_REQUESTED`, `PARTNER_NUDGED`, `PARTNER_REROUTED`, and `EVIDENCE_SUBMITTED` **only when `isPartnerActorRole(event.actorRole)`**.
- `partnerActivity(caseState)` maps those events, in ledger order, to `PartnerActivityRow`:

```ts
export type PartnerActivityRow = {
  at: string;
  type: string;
  stageKey: string;
  actorRole: ActorRole;
  role: ActorRole | null;
  ticketId: string | null;
  adapterId: string | null;
  status: PartnerStatus | null;
  milestoneKey: string | null;
  detail: string | null;
};
```

  For decodable payloads take `ticketId`/`adapterId`/`role`/`status`/`milestoneKey` from the envelope and set `detail` to `note ?? reason ?? null`. For `EVIDENCE_SUBMITTED` set `role = actorRole`, `detail = payload`, and attach `ticketId` from the role's currently-open ticket (walk the rows already produced). For `PARTNER_NUDGED` the payload is the owner role string: set `role` from it, `detail = null`. For `PARTNER_REROUTED` parse `roleType` for `role` and `detail = "rerouted to <toPartnerId>"`.

- `partnerTickets(caseState, now)` folds the same rows into one summary per `ticketId`, in open order:

```ts
export type PartnerTicketSummary = {
  ticketId: string;
  role: ActorRole;
  adapterId: string;
  panelMemberId: string | null;
  panelMemberName: string | null;
  openedAt: string;
  openDays: number;
  acknowledgedAt: string | null;
  ackLatencyDays: number | null;
  lastStatus: PartnerStatus | null;
  lastUpdateAt: string;
  milestoneKeys: string[];
  evidenceSubmitted: number;
  nudges: number;
  closedAt: string | null;
  closeReason: "REROUTED" | null;
};
```

  A ticket opens on the first row carrying a `ticketId` for a role (`WARM_INTRO_REQUESTED`, or `PARTNER_CASE_ACKNOWLEDGED` when the partner acknowledged without a warm intro). `adapterId` takes the most recent non-`manual` value seen on that ticket so a stub adapter's identity survives a manual open. `PARTNER_REROUTED` for a role closes that role's open ticket with `closeReason: "REROUTED"`. Day counts reuse `daysInStage`-style UTC day flooring — export a small local `daysBetweenUtc(from, to)` rather than importing a stage-shaped helper.
- `openTicketForRole(caseState, role)` returns the last summary for that role with `closedAt === null`, else `null`. Takes no `now`; compute with `new Date(lastUpdateAt)` so it stays cheap for the mini-view.

- [ ] **Step 5: Extend the country-agnostic guard**

In `tests/domain/engine-country-agnostic.test.ts`, add to `ENGINE_GLOBAL_FILES`:

```ts
  "src/domain/partner-integration.ts",
  "src/domain/partner-activity.ts",
```

This is the reason milestone vocabulary must not live in these files — Task 2 puts it in the pack.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/domain`
Expected: PASS, including the extended guard test.

- [ ] **Step 7: Commit**

```bash
git add src/domain/partner-integration.ts src/domain/partner-activity.ts tests/domain/partner-integration.test.ts tests/domain/partner-activity.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: vendor-neutral partner integration vocabulary and ledger activity model"
```

---

### Task 2: Partner milestones are market-pack data

**Files:**
- Modify: `src/domain/market-packs/types.ts` (add `PartnerMilestone`, `MarketPack.partnerMilestones`, `milestonesForRole`, `isMilestoneForRole`)
- Create: `src/domain/market-packs/ew-milestones.ts`
- Modify: `src/domain/market-packs/ew.ts` (assemble)
- Modify: `src/domain/market-packs/au-stub.ts` (`partnerMilestones: () => []`)
- Modify: `src/domain/market-packs/inspector.ts` (`partnerMilestoneKeys` on the summary)
- Modify: `tests/support/fixture-pack.ts` (fixture milestones)
- Create: `tests/domain/partner-milestones.test.ts`
- Modify: `tests/domain/market-pack-inspector.test.ts` (assert the new summary field)

**Interfaces:**
- Produces: `PartnerMilestone = { key: string; label: string; role: ActorRole }`; `MarketPack.partnerMilestones: (role: ActorRole) => PartnerMilestone[]`; `milestonesForRole(pack, role): PartnerMilestone[]`; `isMilestoneForRole(pack, role, key): boolean`; `ewPartnerMilestones(role)`.
- Consumed by: Task 5 adapters, Task 6 inbound validation, Task 8 mini-view.

**Why this is pack data, not engine data:** "searches ordered", "enquiries raised", "DIP submitted" are England & Wales conveyancing and UK mortgage process language. Spec §10 puts conveyancing and mortgage rules firmly in the local layer, and the Task 1 guard test would reject those strings in an engine-global file.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/partner-milestones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { auStubPack } from "../../src/domain/market-packs/au-stub";
import { ewMarketPack } from "../../src/domain/market-packs/ew";
import { isMilestoneForRole, milestonesForRole } from "../../src/domain/market-packs/types";
import { makeFixturePack } from "../support/fixture-pack";

describe("partner milestones come from the pack", () => {
  it("gives England & Wales its own conveyancing and mortgage vocabulary", () => {
    expect(milestonesForRole(ewMarketPack, "CONVEYANCER").map((m) => m.key)).toEqual([
      "client_care_sent",
      "searches_ordered",
      "enquiries_raised",
      "report_issued",
    ]);
    expect(milestonesForRole(ewMarketPack, "MORTGAGE_PARTNER").map((m) => m.key)).toEqual([
      "fact_find_booked",
      "dip_submitted",
      "lender_decision",
    ]);
    expect(milestonesForRole(ewMarketPack, "MOVE_PARTNER").map((m) => m.key)).toEqual([
      "survey_booked",
      "quote_issued",
      "date_held",
    ]);
  });

  it("gives no milestones to non-partner roles or to the disabled stub pack", () => {
    expect(milestonesForRole(ewMarketPack, "CLIENT")).toEqual([]);
    expect(milestonesForRole(ewMarketPack, "ADVISOR")).toEqual([]);
    expect(milestonesForRole(auStubPack, "CONVEYANCER")).toEqual([]);
  });

  it("validates a milestone against the role in that pack only, and labels it locally", () => {
    expect(isMilestoneForRole(ewMarketPack, "CONVEYANCER", "searches_ordered")).toBe(true);
    expect(isMilestoneForRole(ewMarketPack, "MORTGAGE_PARTNER", "searches_ordered")).toBe(false);
    expect(isMilestoneForRole(makeFixturePack(), "CONVEYANCER", "searches_ordered")).toBe(false);
    expect(isMilestoneForRole(makeFixturePack(), "CONVEYANCER", "settlement_lodged")).toBe(true);
    expect(milestonesForRole(ewMarketPack, "CONVEYANCER")[1].label).toBe("Searches ordered");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/partner-milestones.test.ts`
Expected: FAIL — `milestonesForRole is not a function`.

- [ ] **Step 3: Extend `types.ts`**

```ts
export type PartnerMilestone = {
  /** Stable key stored in the ledger payload. */
  key: string;
  /** Rendered in the partner mini-view and the cockpit, in the pack's own words. */
  label: string;
  role: ActorRole;
};
```

Add to `MarketPack`:

```ts
  /** Spec §10: conveyancing and mortgage process language is always local. */
  partnerMilestones: (role: ActorRole) => PartnerMilestone[];
```

Add the two helpers next to `partnerRoleLabel`:

```ts
export function milestonesForRole(pack: MarketPack, role: ActorRole): PartnerMilestone[] {
  return pack.partnerMilestones(role);
}

export function isMilestoneForRole(pack: MarketPack, role: ActorRole, key: string): boolean {
  return milestonesForRole(pack, role).some((milestone) => milestone.key === key);
}
```

- [ ] **Step 4: Create `src/domain/market-packs/ew-milestones.ts`**

```ts
import { isPartnerActorRole, type ActorRole } from "../types";
import type { PartnerMilestone } from "./types";

/** England & Wales partner process language. Reported by partners, never promised to clients. */
const EW_MILESTONES: Record<string, Array<[string, string]>> = {
  MORTGAGE_PARTNER: [
    ["fact_find_booked", "Fact find booked"],
    ["dip_submitted", "Decision in principle submitted"],
    ["lender_decision", "Lender decision received"],
  ],
  CONVEYANCER: [
    ["client_care_sent", "Client care pack sent"],
    ["searches_ordered", "Searches ordered"],
    ["enquiries_raised", "Enquiries raised"],
    ["report_issued", "Report on title issued"],
  ],
  MOVE_PARTNER: [
    ["survey_booked", "Pre-move survey booked"],
    ["quote_issued", "Move quote issued"],
    ["date_held", "Move date provisionally held"],
  ],
};

export function ewPartnerMilestones(role: ActorRole): PartnerMilestone[] {
  if (!isPartnerActorRole(role)) {
    return [];
  }
  return (EW_MILESTONES[role] ?? []).map(([key, label]) => ({ key, label, role }));
}
```

- [ ] **Step 5: Wire the packs, the fixture and the inspector**

- `ew.ts`: import `ewPartnerMilestones` and add `partnerMilestones: ewPartnerMilestones`.
- `au-stub.ts`: add `partnerMilestones: () => []` next to `buildPlaybooks: () => []`, with a one-line comment that AU partner process language is Plan 7.
- `tests/support/fixture-pack.ts`: add

```ts
    partnerMilestones: (role) =>
      role === "CONVEYANCER"
        ? [{ key: "settlement_lodged", label: "Settlement lodged", role }]
        : [],
```

- `inspector.ts`: add `partnerMilestoneKeys: Array<{ role: ActorRole; keys: string[] }>` to `MarketPackSummary`, built from `PARTNER_ROLES` (import from `../types`) via `milestonesForRole`. Keys only — the labels are process IP shown on case surfaces, and the inspector stays a configuration view.

Add to `tests/domain/market-pack-inspector.test.ts`:

```ts
  it("lists partner milestone keys per role without leaking process prose", () => {
    const summary = marketPackSummary(ewMarketPack, "RETURNER_OVERSEAS");
    const conveyancer = summary.partnerMilestoneKeys.find((r) => r.role === "CONVEYANCER");
    expect(conveyancer?.keys).toContain("searches_ordered");
    expect(JSON.stringify(summary)).not.toContain("Searches ordered");
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/domain`
Expected: PASS. If `market-pack-types.test.ts` or `ew-pack.test.ts` fail to typecheck because a pack literal is missing `partnerMilestones`, add it there too — every registered pack and every fixture must satisfy the interface.

- [ ] **Step 7: Commit**

```bash
git add src/domain/market-packs tests/support/fixture-pack.ts tests/domain/partner-milestones.test.ts tests/domain/market-pack-inspector.test.ts
git commit -m "feat: partner milestone vocabulary is market-pack data"
```

---

### Task 3: The `partner_speed_rails` module flag and its policy gate

**Files:**
- Modify: `src/domain/market-packs/ew-config.ts:19-21` (`EW_FLAGS`)
- Modify: `tests/domain/market-pack-flags.test.ts:12-35` (move speed rails out of the gated set)
- Modify: `src/server/partner-policy.ts` (add `canUseSpeedRails`, `assertSpeedRails`)
- Create: `tests/server/speed-rails-policy.test.ts`

**Interfaces:**
- Consumes: `casePack` from `src/lib/case-pack.ts`; `isModuleEnabled` from `src/domain/market-packs/types.ts`; `canUseWarmIntro` from `src/domain/freemium.ts`.
- Produces: `canUseSpeedRails(caseState): boolean`, `assertSpeedRails(caseState): void` (throws `PartnerPolicyError`).

**Gate semantics:** speed rails require **both** the pack module flag and `PAID_DWY`. The flag answers "does this market have rails at all"; the tier answers "is this household paying for orchestration". `hard_client_sla` stays off — nothing here produces a client-facing guarantee.

- [ ] **Step 1: Write the failing test**

Create `tests/server/speed-rails-policy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { assertSpeedRails, canUseSpeedRails } from "../../src/server/partner-policy";

function paid() {
  return createCase({ id: "sr1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("speed rails gate", () => {
  it("is open for a paid case on the England & Wales pack", () => {
    expect(canUseSpeedRails(paid())).toBe(true);
    expect(() => assertSpeedRails(paid())).not.toThrow();
  });

  it("is closed on free DIY", () => {
    const free = createCase({ id: "sr2", entryContext: "UK_RESIDENT_SPEED", tier: "FREE_DIY" });
    expect(canUseSpeedRails(free)).toBe(false);
    expect(() => assertSpeedRails(free)).toThrow(/paid/i);
  });

  it("is closed for a pack with the module off", () => {
    const other = { ...paid(), marketPackId: "au" };
    expect(canUseSpeedRails(other)).toBe(false);
    expect(() => assertSpeedRails(other)).toThrow();
  });
});
```

Extend `tests/domain/market-pack-flags.test.ts`: remove `"partner_speed_rails"` from `GATED_MODULES` and add

```ts
  it("runs partner speed rails in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "partner_speed_rails"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
  });
```

Keep `chain_free_inventory` and `hard_client_sla` in `GATED_MODULES` — that guard is the spec's dependency rule and must not weaken.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/speed-rails-policy.test.ts tests/domain/market-pack-flags.test.ts`
Expected: FAIL on both — `assertSpeedRails` missing, and `enabled` is `[]`.

- [ ] **Step 3: Turn the flag on for E&W**

In `src/domain/market-packs/ew-config.ts`:

```ts
/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are deep
 * partner integrations — on here as adapter plumbing only. Chain-free inventory and
 * hard client SLAs stay off until the ledger proves speed.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
};
```

- [ ] **Step 4: Add the policy gate**

Append to `src/server/partner-policy.ts`:

```ts
import { canUseWarmIntro } from "../domain/freemium";
import { isModuleEnabled } from "../domain/market-packs/types";
import { casePack } from "../lib/case-pack";

/**
 * Spec §9 Phase 2. Rails need the market to have them (pack flag) and the household
 * to be paying for orchestration (tier). Nothing here produces a client guarantee.
 */
export function canUseSpeedRails(caseState: CaseState): boolean {
  if (!canUseWarmIntro(caseState)) {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "partner_speed_rails");
  } catch {
    return false;
  }
}

export function assertSpeedRails(caseState: CaseState): void {
  if (!canUseWarmIntro(caseState)) {
    throw new PartnerPolicyError("Partner speed rails require a paid Done-With-You case");
  }
  if (!isModuleEnabled(casePack(caseState).flags, "partner_speed_rails")) {
    throw new PartnerPolicyError(
      `Partner speed rails are not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}
```

Note `assertSpeedRails` lets `MarketPackError` from `casePack` propagate for an unknown pack — fail closed, distinguishable from a policy refusal.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. `tests/domain/market-pack-inspector.test.ts` may assert the `ew` module rows — update the expected `partner_speed_rails` value to `true` there if it pins it.

- [ ] **Step 6: Commit**

```bash
git add src/domain/market-packs/ew-config.ts src/server/partner-policy.ts tests/domain/market-pack-flags.test.ts tests/server/speed-rails-policy.test.ts
git commit -m "feat: partner_speed_rails module flag with a paid-tier policy gate"
```

---

### Task 4: `PartnerPort` becomes a real integration surface

**Files:**
- Create: `src/lib/case-store.ts`
- Modify: `src/lib/partner-port.ts` (expand the port; `ManualPartnerPort` implements all five methods)
- Create: `tests/support/memory-case-store.ts`
- Create: `tests/lib/partner-port.test.ts`

**Interfaces:**
- Produces from `case-store.ts`: `CaseStore = { load(caseId): Promise<CaseState>; save(caseState): Promise<void> }`, `prismaCaseStore`.
- Produces from `partner-port.ts`: `WarmIntroRequest` (unchanged), `PartnerPortContext`, `PartnerPortResult`, `PartnerPort`, `PartnerPortError`, `ManualPartnerPort`.
- Produces from `tests/support/memory-case-store.ts`: `makeMemoryCaseStore(initial: CaseState)`.

**Frozen surface:** `requestWarmIntro(input: WarmIntroRequest): Promise<{ ticketId: string }>` keeps its exact signature, its `warm-` ticket prefix, its `ADVISOR` actor role and its five payload keys. `tests/server/warm-intro.test.ts` is not edited by this plan and must still pass.

- [ ] **Step 1: Write the failing test**

Create `tests/support/memory-case-store.ts`:

```ts
import {
  acceptEvidence,
  advanceStage,
  createCase,
  submitEvidence,
  type CaseState,
} from "../../src/domain/stage-engine";
import type { CaseStore } from "../../src/lib/case-store";

/** DB-free CaseStore so port and adapter behaviour is unit-testable. */
export function makeMemoryCaseStore(initial: CaseState): CaseStore & { current(): CaseState } {
  let state = initial;
  return {
    async load() {
      return state;
    },
    async save(next: CaseState) {
      state = next;
    },
    current() {
      return state;
    },
  };
}

/** A paid case walked to mortgage_path, the first stage a partner role owns. */
export function atMortgagePath(): CaseState {
  let c = createCase({ id: "pp1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
  c = submitEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "ADVISOR" });
  c = advanceStage(c, { actorRole: "ADVISOR" });
  c = submitEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "ADVISOR" });
  return advanceStage(c, { actorRole: "ADVISOR" });
}
```

Create `tests/lib/partner-port.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decodePartnerEventPayload } from "../../src/domain/partner-integration";
import { ManualPartnerPort, PartnerPortError } from "../../src/lib/partner-port";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

const NOW = new Date("2026-09-10T09:00:00.000Z");

function context() {
  return {
    caseId: "pp1",
    role: "MORTGAGE_PARTNER" as const,
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
    now: NOW,
  };
}

describe("ManualPartnerPort implements the whole integration surface", () => {
  it("acknowledges as the partner, then reuses that ticket id for later calls", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store);

    const { ticketId } = await port.acknowledgeCase({ ...context(), note: "Called the client" });

    expect(port.adapterId).toBe("manual");
    expect(ticketId).toMatch(/^ack-pp1-/);
    const event = store.current().events.at(-1)!;
    expect(event).toMatchObject({
      type: "PARTNER_CASE_ACKNOWLEDGED",
      actorRole: "MORTGAGE_PARTNER",
      stageKey: "mortgage_path",
    });
    expect(decodePartnerEventPayload(event.payload)).toMatchObject({
      adapterId: "manual",
      status: "RECEIVED",
      note: "Called the client",
    });

    const milestone = await port.reportMilestone({ ...context(), milestoneKey: "dip_submitted" });
    expect(milestone.ticketId).toBe(ticketId);
    expect(store.current().events.at(-1)!.type).toBe("PARTNER_MILESTONE_REPORTED");
  });

  it("submits partner evidence through the engine with the frozen bare-kind payload", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store);

    await port.submitPartnerEvidence({ ...context(), stageKey: "mortgage_path", kind: "dip_aip" });

    const event = store.current().events.at(-1)!;
    expect(event.type).toBe("EVIDENCE_SUBMITTED");
    expect(event.payload).toBe("dip_aip");
    expect(store.current().stages.find((s) => s.key === "mortgage_path")!.submittedEvidenceKinds).toEqual([
      "dip_aip",
    ]);
  });

  it("reports the last known status on sync without inventing progress", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store);

    const before = await port.syncStatus(context());
    expect(before.status).toBe("RECEIVED");

    await port.acknowledgeCase(context());
    await port.submitPartnerEvidence({ ...context(), stageKey: "mortgage_path", kind: "dip_aip" });
    const after = await port.syncStatus(context());
    expect(after.status).toBe("EVIDENCE_READY");
    expect(store.current().events.at(-1)!.type).toBe("PARTNER_STATUS_SYNCED");
  });

  it("refuses a non-owning role and a milestone that is not this role's in this pack", async () => {
    const port = new ManualPartnerPort(makeMemoryCaseStore(atMortgagePath()));

    await expect(port.acknowledgeCase({ ...context(), role: "CONVEYANCER" })).rejects.toBeInstanceOf(
      PartnerPortError,
    );
    await expect(
      port.reportMilestone({ ...context(), milestoneKey: "searches_ordered" }),
    ).rejects.toThrow(/milestone/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/partner-port.test.ts`
Expected: FAIL — `port.acknowledgeCase is not a function`.

- [ ] **Step 3: Create `src/lib/case-store.ts`**

```ts
import type { CaseState } from "@/domain/stage-engine";
import { loadCase, saveCase } from "@/server/cases";

/** Persistence seam. Adapters depend on this, never on Prisma, so they unit-test clean. */
export type CaseStore = {
  load(caseId: string): Promise<CaseState>;
  save(caseState: CaseState): Promise<void>;
};

export const prismaCaseStore: CaseStore = {
  load: loadCase,
  save: saveCase,
};
```

- [ ] **Step 4: Expand `src/lib/partner-port.ts`**

Keep the existing `WarmIntroRequest` and the existing `requestWarmIntro` body verbatim (it is the frozen shape), but move persistence onto the injected store. Add:

```ts
export class PartnerPortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerPortError";
  }
}

export type PartnerPortContext = {
  caseId: string;
  role: ActorRole;
  panelMemberId: string | null;
  panelMemberName: string | null;
  now?: Date;
};

export type PartnerPortResult = {
  ticketId: string;
  eventType: PartnerIntegrationEventType | "EVIDENCE_SUBMITTED";
};

/**
 * Spec §7: "Manual partner ops in v1 behind clean APIs/interfaces so deeper integrations
 * can land without rewrite". Manual ops, the stub adapters and any future real vendor
 * client are all implementations of this one type, and all write identical ledger events.
 *
 * Deliberately absent: accept, advance, block, resume, re-route, create referral.
 * Those are advisor powers and stay in the cockpit.
 */
export type PartnerPort = {
  readonly adapterId: string;
  requestWarmIntro(input: WarmIntroRequest): Promise<{ ticketId: string }>;
  acknowledgeCase(input: PartnerPortContext & { note?: string }): Promise<PartnerPortResult>;
  syncStatus(input: PartnerPortContext): Promise<PartnerPortResult & { status: PartnerStatus }>;
  submitPartnerEvidence(
    input: PartnerPortContext & { stageKey: string; kind: string },
  ): Promise<PartnerPortResult>;
  reportMilestone(
    input: PartnerPortContext & { milestoneKey: string; note?: string },
  ): Promise<PartnerPortResult>;
};
```

Then implement the shared mechanics once, in module-level helpers `ManualPartnerPort` and (Task 5) `StubPartnerAdapter` both use:

- `requirePartnerFocusStage(caseState, role)` → the focus stage, or throw `PartnerPortError` when there is none, when `ownerRole !== role`, or when the status is not `ACTIVE`/`BLOCKED`. Same rules as `assertPartnerSubmit`, expressed once at the port layer.
- `resolveTicketId(caseState, role, prefix, at)` → `openTicketForRole(caseState, role)?.ticketId ?? mintTicketId({ prefix, caseId, at })`.
- `appendIntegrationEvent(caseState, { type, stageKey, role, payload, at })` → returns a new `CaseState` with the event appended, payload encoded through `encodePartnerEventPayload`. Actor role is always the **partner** role for the four new types.
- `derivedStatus(caseState, stage, role)` → `COMPLETE` when `partnerEvidenceInbox(stage).complete`; `EVIDENCE_READY` when anything is awaiting acceptance; `IN_PROGRESS` when the ticket has an acknowledgement or a milestone; otherwise `RECEIVED`. This is what `ManualPartnerPort.syncStatus` reports: it reads the ledger, it does not simulate.
- `assertMilestone(caseState, role, milestoneKey)` → `isMilestoneForRole(casePack(caseState), role, milestoneKey)` or throw `PartnerPortError("Unknown milestone for <role> in pack <id>: <key>")`.

`ManualPartnerPort`:

```ts
export class ManualPartnerPort implements PartnerPort {
  readonly adapterId = "manual";
  constructor(private readonly store: CaseStore = prismaCaseStore) {}
  // ...five methods, each: load -> validate -> mutate -> save -> return
}
```

`submitPartnerEvidence` delegates to the engine's `submitPartnerEvidence` (import it aliased, e.g. `applyPartnerEvidence`) so the `EVIDENCE_SUBMITTED` payload stays the bare kind string. It appends no second event.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/partner-port.test.ts tests/server/warm-intro.test.ts tests/server/warm-intro-action.test.ts`
Expected: PASS on all three. The warm-intro tests are the regression proof that the frozen shape survived.

- [ ] **Step 6: Commit**

```bash
git add src/lib/case-store.ts src/lib/partner-port.ts tests/support/memory-case-store.ts tests/lib/partner-port.test.ts
git commit -m "feat: expand PartnerPort into a full integration surface behind a case store seam"
```

---

### Task 5: Role-specific stub adapters with deterministic simulated latency

**Files:**
- Create: `src/lib/partner-adapters/profiles.ts`
- Create: `src/lib/partner-adapters/stub-adapter.ts`
- Create: `src/lib/partner-adapters/registry.ts`
- Create: `tests/lib/partner-adapters.test.ts`
- Create: `tests/server/adapter-authority.test.ts`

**Interfaces:**
- Produces: `AdapterProfile`, `MORTGAGE_STUB_PROFILE`, `CONVEYANCER_STUB_PROFILE`, `MOVE_STUB_PROFILE`, `profileForRole(role)`; `StubPartnerAdapter`; `partnerPortForCase(caseState, role, store?)`, `partnerPortForRole(role, store?)`.
- Consumes: everything from Task 4, plus `casePack` and `isModuleEnabled`.

**What "simulated" means here:** the only thing the stub simulates is **vendor turnaround** — how long a real mortgage adviser or conveyancer would take to move from received to in-progress to evidence-ready. It is a pure function of the focus stage's `activatedAt`, the injected `now` and the profile's cadence. No randomness, no timers, no HTTP. The rail being proved is the *shape* of the integration, not a fake vendor.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/partner-adapters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decodePartnerEventPayload } from "../../src/domain/partner-integration";
import { profileForRole } from "../../src/lib/partner-adapters/profiles";
import { partnerPortForCase, partnerPortForRole } from "../../src/lib/partner-adapters/registry";
import { ManualPartnerPort } from "../../src/lib/partner-port";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

/**
 * mortgage_path activates at case creation + 0 days in these fixtures; the tests move
 * `now` forward instead of moving the clock.
 */
function daysAfterActivation(state: ReturnType<typeof atMortgagePath>, days: number): Date {
  const activatedAt = state.stages.find((s) => s.key === "mortgage_path")!.activatedAt!;
  const at = new Date(activatedAt);
  at.setUTCDate(at.getUTCDate() + days);
  return at;
}

describe("stub adapter selection", () => {
  it("picks the role's stub adapter when the pack runs speed rails", () => {
    const state = atMortgagePath();
    expect(partnerPortForCase(state, "MORTGAGE_PARTNER").adapterId).toBe("stub-mortgage");
    expect(partnerPortForCase(state, "CONVEYANCER").adapterId).toBe("stub-conveyancer");
    expect(partnerPortForCase(state, "MOVE_PARTNER").adapterId).toBe("stub-move");
  });

  it("falls back to manual ops when the module is off or the case is free", () => {
    const noModule = { ...atMortgagePath(), marketPackId: "au" };
    const free = { ...atMortgagePath(), tier: "FREE_DIY" as const };
    expect(partnerPortForCase(noModule, "MORTGAGE_PARTNER")).toBeInstanceOf(ManualPartnerPort);
    expect(partnerPortForCase(free, "MORTGAGE_PARTNER").adapterId).toBe("manual");
  });

  it("exposes a role-only lookup for the inbound path", () => {
    expect(partnerPortForRole("CONVEYANCER").adapterId).toBe("stub-conveyancer");
  });

  it("gives each role its own cadence — removals fastest, conveyancing slowest", () => {
    expect(profileForRole("MOVE_PARTNER")!.cadenceDays).toBeLessThan(
      profileForRole("MORTGAGE_PARTNER")!.cadenceDays,
    );
    expect(profileForRole("MORTGAGE_PARTNER")!.cadenceDays).toBeLessThan(
      profileForRole("CONVEYANCER")!.cadenceDays,
    );
    expect(profileForRole("CLIENT")).toBeNull();
  });
});

describe("simulated vendor turnaround is deterministic", () => {
  const context = {
    caseId: "pp1",
    role: "MORTGAGE_PARTNER" as const,
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
  };

  it("walks the mortgage ladder as simulated days pass", async () => {
    const state = atMortgagePath();
    const store = makeMemoryCaseStore(state);
    const port = partnerPortForCase(state, "MORTGAGE_PARTNER", store);

    const day0 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 0) });
    const day3 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 3) });
    const day6 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 6) });
    const day30 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 30) });

    expect([day0.status, day3.status, day6.status, day30.status]).toEqual([
      "RECEIVED",
      "IN_PROGRESS",
      "BLOCKED_ON_CLIENT",
      "EVIDENCE_READY",
    ]);
    // Same inputs, same answer: the ladder is arithmetic on days-in-stage, not a roll.
    expect((await port.syncStatus({ ...context, now: daysAfterActivation(state, 3) })).status).toBe(
      "IN_PROGRESS",
    );
  });

  it("refuses a role that does not own the focus stage", async () => {
    const state = atMortgagePath();
    const port = partnerPortForCase(state, "CONVEYANCER", makeMemoryCaseStore(state));
    await expect(
      port.syncStatus({ ...context, role: "CONVEYANCER", now: daysAfterActivation(state, 3) }),
    ).rejects.toThrow(/owner/i);
  });

  it("records the simulated latency it used in the ledger payload", async () => {
    const state = atMortgagePath();
    const store = makeMemoryCaseStore(state);
    const port = partnerPortForCase(state, "MORTGAGE_PARTNER", store);
    await port.syncStatus({ ...context, now: daysAfterActivation(state, 3) });
    const payload = decodePartnerEventPayload(store.current().events.at(-1)!.payload);
    expect(payload).toMatchObject({ adapterId: "stub-mortgage", status: "IN_PROGRESS" });
    expect(payload!.simulatedLatencyDays).toBe(3);
  });

  it("reports COMPLETE once every required kind is accepted, and still does not advance", async () => {
    const state = atMortgagePath();
    const withEvidence = {
      ...state,
      stages: state.stages.map((s) =>
        s.key === "mortgage_path" ? { ...s, acceptedEvidenceKinds: [...s.requiredEvidenceKinds] } : s,
      ),
    };
    const store = makeMemoryCaseStore(withEvidence);
    const port = partnerPortForCase(withEvidence, "MORTGAGE_PARTNER", store);
    const result = await port.syncStatus({ ...context, now: daysAfterActivation(state, 1) });
    expect(result.status).toBe("COMPLETE");
    expect(store.current().stages.find((s) => s.key === "mortgage_path")!.status).toBe("ACTIVE");
  });
});
```

Create `tests/server/adapter-authority.test.ts` — the structural guard that keeps rails from becoming a second engine:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ADAPTER_FILES = [
  "src/lib/partner-port.ts",
  "src/lib/partner-adapters/profiles.ts",
  "src/lib/partner-adapters/stub-adapter.ts",
  "src/lib/partner-adapters/registry.ts",
  "src/server/partner-integration.ts",
];

/** Spec §8: the stage engine is the source of truth and the advisor drives it. */
const ADVISOR_ONLY_POWERS = [
  "acceptEvidence",
  "advanceStage",
  "blockStage",
  "resumeStage",
  "reroutePartner",
  "createReferral",
];

const LIVE_VENDOR_CALL = /\bfetch\s*\(|\baxios\b|https?:\/\/(?!localhost)/;

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("adapters never take advisor powers", () => {
  it("references no state transition the advisor owns, and no randomness", () => {
    for (const file of ADAPTER_FILES) {
      const source = read(file);
      for (const power of [...ADVISOR_ONLY_POWERS, "Math.random"]) {
        expect(source.includes(power), `${file} references ${power}`).toBe(false);
      }
    }
  });

  it("makes no outbound call to a third party", () => {
    const dir = "src/lib/partner-adapters";
    for (const entry of readdirSync(path.resolve(process.cwd(), dir))) {
      expect(LIVE_VENDOR_CALL.test(read(`${dir}/${entry}`)), `${dir}/${entry} calls out`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/partner-adapters.test.ts tests/server/adapter-authority.test.ts`
Expected: FAIL — the adapter modules do not exist.

- [ ] **Step 3: Create `src/lib/partner-adapters/profiles.ts`**

```ts
import type { PartnerStatus } from "@/domain/partner-integration";
import type { ActorRole } from "@/domain/types";

/**
 * A stub vendor's shape: how fast it acknowledges, how fast it works, and the status
 * ladder it walks. Everything here is a simulation parameter, not a service contract.
 */
export type AdapterProfile = {
  adapterId: string;
  role: ActorRole;
  /** Simulated turnaround per rung of the ladder, in whole days. */
  cadenceDays: number;
  statusLadder: PartnerStatus[];
};

export const MORTGAGE_STUB_PROFILE: AdapterProfile = {
  adapterId: "stub-mortgage",
  role: "MORTGAGE_PARTNER",
  cadenceDays: 3,
  statusLadder: ["RECEIVED", "IN_PROGRESS", "BLOCKED_ON_CLIENT", "EVIDENCE_READY"],
};

export const CONVEYANCER_STUB_PROFILE: AdapterProfile = {
  adapterId: "stub-conveyancer",
  role: "CONVEYANCER",
  cadenceDays: 5,
  statusLadder: ["RECEIVED", "IN_PROGRESS", "IN_PROGRESS", "EVIDENCE_READY"],
};

/** Removals and FX quotes come back in hours, so this is the fastest rail. */
export const MOVE_STUB_PROFILE: AdapterProfile = {
  adapterId: "stub-move",
  role: "MOVE_PARTNER",
  cadenceDays: 2,
  statusLadder: ["RECEIVED", "IN_PROGRESS", "EVIDENCE_READY"],
};

const BY_ROLE: Partial<Record<ActorRole, AdapterProfile>> = {
  MORTGAGE_PARTNER: MORTGAGE_STUB_PROFILE,
  CONVEYANCER: CONVEYANCER_STUB_PROFILE,
  MOVE_PARTNER: MOVE_STUB_PROFILE,
};

export function profileForRole(role: ActorRole): AdapterProfile | null {
  return BY_ROLE[role] ?? null;
}
```

The cadence ordering — removals fastest, conveyancing slowest — is the whole reason for having three profiles rather than one.

- [ ] **Step 4: Create `src/lib/partner-adapters/stub-adapter.ts`**

`StubPartnerAdapter implements PartnerPort`, constructed with `(profile: AdapterProfile, store: CaseStore)`. It reuses every shared helper from `partner-port.ts` (export them from there rather than duplicating) and differs from `ManualPartnerPort` in exactly one method — `syncStatus`:

```ts
  private simulatedStatus(stage: StageState, now: Date): { status: PartnerStatus; latencyDays: number } {
    const inbox = partnerEvidenceInbox(stage);
    const elapsedDays = daysInStage(stage, now);
    if (inbox.complete) {
      return { status: "COMPLETE", latencyDays: elapsedDays };
    }
    if (inbox.awaitingAcceptance.length > 0) {
      return { status: "EVIDENCE_READY", latencyDays: elapsedDays };
    }
    const rung = Math.min(
      Math.floor(elapsedDays / this.profile.cadenceDays),
      this.profile.statusLadder.length - 1,
    );
    return { status: this.profile.statusLadder[rung], latencyDays: elapsedDays };
  }
```

`syncStatus` then appends `PARTNER_STATUS_SYNCED` with `{ status, simulatedLatencyDays: latencyDays, adapterId }` and returns `{ ticketId, eventType: "PARTNER_STATUS_SYNCED", status }`. `acknowledgeCase`, `submitPartnerEvidence`, `reportMilestone` and `requestWarmIntro` behave identically to the manual port apart from carrying the profile's `adapterId` in the payload — implement them by extending `ManualPartnerPort` and overriding `adapterId` + `syncStatus`, so there is one copy of the ledger-writing code.

- [ ] **Step 5: Create `src/lib/partner-adapters/registry.ts`**

```ts
export function partnerPortForRole(role: ActorRole, store: CaseStore = prismaCaseStore): PartnerPort {
  const profile = profileForRole(role);
  return profile ? new StubPartnerAdapter(profile, store) : new ManualPartnerPort(store);
}

/**
 * Rails are opt-in per market and per tier. A pack without partner_speed_rails, a free
 * case, or an unresolvable pack all fall back to manual ops — the v1 behaviour.
 */
export function partnerPortForCase(
  caseState: CaseState,
  role: ActorRole,
  store: CaseStore = prismaCaseStore,
): PartnerPort {
  return railsEnabled(caseState) ? partnerPortForRole(role, store) : new ManualPartnerPort(store);
}
```

`railsEnabled` mirrors `canUseSpeedRails` but lives here to keep `src/lib` free of `src/server` imports: `caseState.tier === "PAID_DWY"` and `isModuleEnabled(casePack(caseState).flags, "partner_speed_rails")`, wrapped in try/catch returning `false`. Add a one-line comment cross-referencing `canUseSpeedRails` so the duplication is deliberate and findable; the server gate stays the one that throws.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/lib tests/server/adapter-authority.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/partner-adapters tests/lib/partner-adapters.test.ts tests/server/adapter-authority.test.ts tests/support/memory-case-store.ts
git commit -m "feat: role-specific stub partner adapters with deterministic simulated turnaround"
```

---

### Task 6: Inbound partner update path

**Files:**
- Create: `src/server/partner-integration.ts`
- Create: `tests/server/partner-inbound.test.ts`

**Interfaces:**
- Produces: `PartnerIntegrationError`, `InboundPartnerUpdate`, `parseInboundUpdate(raw: unknown): InboundPartnerUpdate`, `applyPartnerUpdate(update, options?): Promise<InboundResult>`.
- `InboundPartnerUpdate = { caseId: string; ticketId: string; role: ActorRole; status: PartnerStatus; milestoneKey?: string; note?: string }`.
- `InboundResult = { applied: PartnerUpdateIntent["kind"]; ticketId: string; eventTypes: string[] }`.
- Consumes: `parse` helpers from Task 1, `assertSpeedRails` from Task 3, `partnerPortForCase` from Task 5, `prismaCaseStore`.

**Behaviour contract:**
1. `parseInboundUpdate` validates shape strictly and throws `PartnerIntegrationError` on anything unknown — it never coerces.
2. `applyPartnerUpdate` loads the case (unknown case → throw; it must never create one), runs `assertSpeedRails`, then requires the ticket to already exist and be open for that role via `openTicketForRole` (unknown ticket → throw; the rails do not accept a self-declared ticket).
3. It computes `intentForStatus` against the focus stage and executes it **through the port**, so an inbound update and an in-app partner action produce byte-identical ledger events.
4. A `REJECT` intent is not an error: it appends one `PARTNER_UPDATE_REJECTED` event with the reason and returns `applied: "REJECT"`. Silent drops are worse than an audit trail.
5. A `milestoneKey` on the update is reported after the status is applied, and only if it is valid for the role in the case's pack.

- [ ] **Step 1: Write the failing test**

Create `tests/server/partner-inbound.test.ts` as a DB-free test by injecting a memory store:

```ts
import { describe, it, expect } from "vitest";
import { PartnerIntegrationError, applyPartnerUpdate, parseInboundUpdate } from "../../src/server/partner-integration";
import { decodePartnerEventPayload } from "../../src/domain/partner-integration";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

const NOW = new Date("2026-09-12T09:00:00.000Z");

async function storeWithOpenTicket() {
  const store = makeMemoryCaseStore(atMortgagePath());
  const { partnerPortForCase } = await import("../../src/lib/partner-adapters/registry");
  const port = partnerPortForCase(await store.load(), "MORTGAGE_PARTNER", store);
  const { ticketId } = await port.acknowledgeCase({
    caseId: "pp1",
    role: "MORTGAGE_PARTNER",
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
    now: new Date("2026-09-11T09:00:00.000Z"),
  });
  return { store, ticketId };
}

describe("parseInboundUpdate", () => {
  it("accepts a well-formed update", () => {
    expect(
      parseInboundUpdate({
        caseId: "pp1",
        ticketId: "ack-pp1-1",
        role: "MORTGAGE_PARTNER",
        status: "EVIDENCE_READY",
      }),
    ).toMatchObject({ caseId: "pp1", status: "EVIDENCE_READY" });
  });

  it("rejects unknown statuses, non-partner roles and missing fields", () => {
    const base = { caseId: "pp1", ticketId: "t", role: "MORTGAGE_PARTNER", status: "RECEIVED" };
    expect(() => parseInboundUpdate({ ...base, status: "SHIPPED" })).toThrow(PartnerIntegrationError);
    expect(() => parseInboundUpdate({ ...base, role: "ADVISOR" })).toThrow(PartnerIntegrationError);
    expect(() => parseInboundUpdate({ ...base, caseId: undefined })).toThrow(PartnerIntegrationError);
    expect(() => parseInboundUpdate("nope")).toThrow(PartnerIntegrationError);
  });
});

describe("applyPartnerUpdate", () => {
  it("turns EVIDENCE_READY into submitted evidence through the port", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const result = await applyPartnerUpdate(
      { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER", status: "EVIDENCE_READY" },
      { now: NOW, store },
    );

    expect(result.applied).toBe("SUBMIT_EVIDENCE");
    expect(result.eventTypes).toEqual(["EVIDENCE_SUBMITTED"]);
    const stage = (await store.load()).stages.find((s) => s.key === "mortgage_path")!;
    expect(stage.submittedEvidenceKinds).toEqual(["dip_aip"]);
    expect(stage.status).toBe("ACTIVE");
  });

  it("records a note for BLOCKED_ON_CLIENT without blocking the stage", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const result = await applyPartnerUpdate(
      { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER", status: "BLOCKED_ON_CLIENT" },
      { now: NOW, store },
    );

    expect(result.applied).toBe("NOTE_ONLY");
    const state = await store.load();
    expect(state.stages.find((s) => s.key === "mortgage_path")!.status).toBe("ACTIVE");
    expect(state.events.at(-1)!.type).toBe("PARTNER_STATUS_SYNCED");
  });

  it("audits a wrong-role update instead of dropping it", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const result = await applyPartnerUpdate(
      { caseId: "pp1", ticketId, role: "CONVEYANCER", status: "EVIDENCE_READY" },
      { now: NOW, store },
    );

    expect(result.applied).toBe("REJECT");
    const event = (await store.load()).events.at(-1)!;
    expect(event.type).toBe("PARTNER_UPDATE_REJECTED");
    expect(decodePartnerEventPayload(event.payload)!.reason).toMatch(/owner/i);
  });

  it("refuses an unknown ticket and never invents one", async () => {
    const { store } = await storeWithOpenTicket();
    const before = (await store.load()).events.length;
    await expect(
      applyPartnerUpdate(
        { caseId: "pp1", ticketId: "not-a-ticket", role: "MORTGAGE_PARTNER", status: "RECEIVED" },
        { now: NOW, store },
      ),
    ).rejects.toThrow(/ticket/i);
    expect((await store.load()).events).toHaveLength(before);
  });

  it("refuses a free case even with a valid ticket", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    await store.save({ ...(await store.load()), tier: "FREE_DIY" });
    await expect(
      applyPartnerUpdate(
        { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER", status: "RECEIVED" },
        { now: NOW, store },
      ),
    ).rejects.toThrow(/paid/i);
  });

  it("reports a valid milestone alongside the status, and refuses another role's", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const base = { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER" as const, status: "IN_PROGRESS" as const };

    const result = await applyPartnerUpdate({ ...base, milestoneKey: "dip_submitted" }, { now: NOW, store });
    expect(result.eventTypes).toEqual(["PARTNER_STATUS_SYNCED", "PARTNER_MILESTONE_REPORTED"]);

    await expect(
      applyPartnerUpdate({ ...base, milestoneKey: "searches_ordered" }, { now: NOW, store }),
    ).rejects.toThrow(/milestone/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/partner-inbound.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/partner-integration.ts`**

Sketch:

```ts
export class PartnerIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerIntegrationError";
  }
}

export async function applyPartnerUpdate(
  update: InboundPartnerUpdate,
  options: { now?: Date; store?: CaseStore } = {},
): Promise<InboundResult> {
  const store = options.store ?? prismaCaseStore;
  const now = options.now ?? new Date();

  const caseState = await store.load(update.caseId); // throws for an unknown case
  assertSpeedRails(caseState);

  const ticket = openTicketForRole(caseState, update.role);
  if (!ticket || ticket.ticketId !== update.ticketId) {
    throw new PartnerIntegrationError(`No open ticket ${update.ticketId} for ${update.role}`);
  }

  const focus = getFocusStage(caseState);
  if (!focus) {
    throw new PartnerIntegrationError("Case has no focus stage");
  }

  const port = partnerPortForCase(caseState, update.role, store);
  const context = {
    caseId: update.caseId,
    role: update.role,
    panelMemberId: ticket.panelMemberId,
    panelMemberName: ticket.panelMemberName,
    now,
  };

  if (update.milestoneKey && !isMilestoneForRole(casePack(caseState), update.role, update.milestoneKey)) {
    throw new PartnerIntegrationError(`Unknown milestone for ${update.role}: ${update.milestoneKey}`);
  }

  const intent = intentForStatus({ status: update.status, role: update.role, stage: focus });
  const eventTypes: string[] = [];
  // ACKNOWLEDGE -> port.acknowledgeCase
  // NOTE_ONLY   -> port.syncStatus (records PARTNER_STATUS_SYNCED)
  // SUBMIT_EVIDENCE -> port.submitPartnerEvidence for each kind, sequentially, reloading between calls
  // REJECT      -> appendRejection(store, caseState, focus, context, intent.reason)
  // then, if update.milestoneKey -> port.reportMilestone
  return { applied: intent.kind, ticketId: ticket.ticketId, eventTypes };
}
```

Two details that matter:
- `SUBMIT_EVIDENCE` iterates kinds **sequentially** and lets the port reload the case each time; batching would lose events because `saveCase` diffs by event count.
- The `REJECT` branch writes its event directly via the port's exported `appendIntegrationEvent` helper rather than through a port method — the port's methods all validate the role owns the stage, which is precisely what failed here.

`parseInboundUpdate` checks: object, `caseId`/`ticketId` non-empty strings, `role` in `PARTNER_ROLES`, `status` passes `isPartnerStatus`, optional `milestoneKey`/`note` strings.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/partner-integration.ts tests/server/partner-inbound.test.ts
git commit -m "feat: inbound partner update path maps partner status to ledger events through the port"
```

---

### Task 7: Stub webhook endpoint and integration server actions

**Files:**
- Create: `src/app/api/partner-updates/route.ts`
- Create: `src/app/actions/partner-integration.ts`
- Modify: `src/app/actions/partner.ts` (route evidence submit through the port)
- Modify: `.env.example`
- Create: `tests/server/partner-webhook.test.ts`

**Interfaces:**
- Produces: `POST(request: Request): Promise<Response>`; `acknowledgeCaseAction(caseId)`, `reportMilestoneAction(caseId, milestoneKey, note)`, `syncPartnerStatusAction(caseId)`; `verifyWebhookSecret(header: string | null): boolean` (exported from the route module for the test).
- All actions return the shared `PartnerActionResult` shape.

**Webhook posture:** this is a **loopback stub**, not a vendor contract. It exists so the demo can show an update arriving from outside the app and landing as a stage event. One shared secret in `x-partner-signature`, compared with a length-safe constant-time comparison. No vendor-specific signing scheme, no replay window, no retries. Documented as such in the README.

- [ ] **Step 1: Write the failing test**

Create `tests/server/partner-webhook.test.ts` covering `verifyWebhookSecret` and the request-level contract:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { verifyWebhookSecret } from "../../src/app/api/partner-updates/route";

describe("webhook secret", () => {
  beforeEach(() => {
    process.env.PARTNER_WEBHOOK_SECRET = "dev-partner-secret";
  });

  it("accepts the configured secret and rejects everything else", () => {
    expect(verifyWebhookSecret("dev-partner-secret")).toBe(true);
    expect(verifyWebhookSecret("dev-partner-secre")).toBe(false);
    expect(verifyWebhookSecret("")).toBe(false);
    expect(verifyWebhookSecret(null)).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    delete process.env.PARTNER_WEBHOOK_SECRET;
    expect(verifyWebhookSecret("anything")).toBe(false);
  });
});
```

Add a second describe hitting `POST` directly with a `Request`, asserting `401` for a bad secret, `400` for a malformed body, `409` for a `PartnerIntegrationError` (unknown ticket / rails off) and `200` with `{ ok: true, applied }` on success. Use the seeded `ew` case created inside the test with `createCaseRecord`, following the DB setup pattern in `tests/server/warm-intro.test.ts` (clear tables in `beforeAll`, `prisma.$disconnect()` in `afterAll`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/partner-webhook.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Create the route handler**

```ts
/**
 * Stub inbound rail. Spec §7: partner ops sit behind a clean interface so a real
 * integration can land later without a rewrite. This endpoint is a local loopback for
 * the demo — one shared secret, no vendor signing scheme, no live partner calls out.
 */
export function verifyWebhookSecret(header: string | null): boolean {
  const expected = process.env.PARTNER_WEBHOOK_SECRET;
  if (!expected || !header || header.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request): Promise<Response> {
  if (!verifyWebhookSecret(request.headers.get("x-partner-signature"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let update: InboundPartnerUpdate;
  try {
    update = parseInboundUpdate(await request.json());
  } catch (err) {
    return Response.json({ ok: false, error: message(err) }, { status: 400 });
  }
  try {
    const result = await applyPartnerUpdate(update);
    return Response.json({ ok: true, applied: result.applied, eventTypes: result.eventTypes });
  } catch (err) {
    return Response.json({ ok: false, error: message(err) }, { status: 409 });
  }
}
```

Add `PARTNER_WEBHOOK_SECRET="dev-partner-secret"` to `.env.example` (and note in the README that it must be replaced outside development).

- [ ] **Step 4: Create `src/app/actions/partner-integration.ts`**

Three actions, following the existing action patterns in `src/app/actions/partner.ts` and `partner-network.ts` exactly (session check → `loadCaseForUser` → policy assert → port call → `revalidatePath` → `{ ok: true }`; errors mapped through a local `mapError`):

- `acknowledgeCaseAction(caseId, note?)` — partner roles only; `assertSpeedRails`; `partnerPortForCase(caseState, role).acknowledgeCase(...)`.
- `reportMilestoneAction(caseId, milestoneKey, note?)` — partner roles only; `assertSpeedRails`; port `reportMilestone`.
- `syncPartnerStatusAction(caseId)` — **advisor only**; `assertSpeedRails`; resolves the focus stage's owner role, refuses when it is not a partner role, then calls `syncStatus` for that role. This is the cockpit's "pull the latest from the adapter" button.

Revalidate `/partner`, `/partner/cases/<id>`, `/cockpit/cases/<id>` and `/portal/cases/<id>` from one shared helper, as the existing actions do.

The panel member on the context comes from `activeReferralForRole(caseId, role)` when there is one, else `openTicketForRole(...)`, else `{ panelMemberId: null, panelMemberName: null }` — a partner acknowledging before any referral exists must still work.

- [ ] **Step 5: Route the existing evidence submit through the port**

In `src/app/actions/partner.ts`, keep `assertPartnerSubmit` as the policy check, then replace the direct engine call and `saveCase` with:

```ts
    const port = partnerPortForCase(caseState, role);
    await port.submitPartnerEvidence({
      caseId,
      role,
      panelMemberId: ticket?.panelMemberId ?? null,
      panelMemberName: ticket?.panelMemberName ?? null,
      stageKey,
      kind,
    });
```

The emitted event is byte-identical to before (bare `kind` payload) — `tests/server/partner-actions.test.ts` and the portal/cockpit renderings must not change.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/partner-updates src/app/actions/partner-integration.ts src/app/actions/partner.ts .env.example tests/server/partner-webhook.test.ts
git commit -m "feat: stub partner webhook and integration server actions on the port"
```

---

### Task 8: Stronger partner mini-view — case context, evidence inbox, port actions

**Files:**
- Modify: `src/app/partner/cases/[caseId]/page.tsx`
- Create: `src/components/PartnerCaseContext.tsx`
- Create: `src/components/PartnerIntegrationControls.tsx`

**Interfaces:**
- Consumes: `partnerEvidenceInbox`, `openTicketForRole`, `partnerActivity`, `milestonesForRole`, `partnerRoleLabel`, `stageSlaDays`, `canUseSpeedRails`, `acknowledgeCaseAction`, `reportMilestoneAction`, `submitPartnerEvidenceAction`.
- Produces: two components; no new domain or server modules.

**UI direction:** follow the existing partner/cockpit patterns — server component page, `"use client"` control components taking action callbacks, `ActionErrorBanner` for failures, the same Tailwind vocabulary as `PartnerOpsControls` and `EvidenceSubmitForm`. Do not invent a new design system and do not restructure the page shell.

**What the page gains:**
1. **`PartnerCaseContext`** above the timeline: market pack name, this partner's role label from the pack, stage title, the pack's SLA days for the stage, days in stage, blocked reason when present, and — when there is an open ticket — the ticket id, adapter id, acknowledgement state and last known status. Presented as facts, never as a promise: no due date is shown to anyone downstream of this component, and the component takes no scorecard, fee or attribution props.
2. **Required evidence inbox** driven by `partnerEvidenceInbox(focusStage)` instead of the three inline `filter` expressions currently in the page: a to-submit list (existing `EvidenceSubmitForm`), an awaiting-acceptance list, and an accepted list.
3. **`PartnerIntegrationControls`** (rendered only when `canUseSpeedRails(caseState)`): an **Acknowledge case** button, disabled with an explanatory line once the ticket is acknowledged, and a **Report milestone** select populated from `milestonesForRole(pack, role)` with an optional note field.
4. **Your activity**: `partnerActivity(caseState).filter((row) => row.role === role)` rendered as a compact list. Scoping by role is the privacy boundary — a conveyancer must not see the mortgage adviser's ticket.

- [ ] **Step 1: Write the failing test**

There is no component test harness in this repo, so assert the two things that can regress silently, in `tests/domain/partner-activity.test.ts`:

```ts
  it("scopes activity to one role so a partner cannot see another partner's ticket", () => {
    const rows = partnerActivity(caseWithEvents([WARM, ACK, CONVEYANCER_ACK]));
    expect(rows.filter((r) => r.role === "MORTGAGE_PARTNER")).toHaveLength(2);
    expect(rows.filter((r) => r.role === "CONVEYANCER")).toHaveLength(1);
  });
```

(define `CONVEYANCER_ACK` alongside the other fixtures). Then rely on Step 5's manual smoke check for rendering.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/partner-activity.test.ts`
Expected: FAIL on the new case only.

- [ ] **Step 3: Build the two components**

`PartnerCaseContext` is a presentational server-safe component taking a flat props object (`packName`, `roleLabel`, `stageTitle`, `slaDays`, `daysInStage`, `blockedReason`, `ticket`), rendering a definition list in the emerald palette the partner area already uses.

`PartnerIntegrationControls` is `"use client"`, mirrors `PartnerOpsControls`'s structure (local `error` state, `run(action)` helper, `<form action={...}>` per control), and takes `{ caseId, acknowledged, milestones, onAcknowledge, onReportMilestone }`.

- [ ] **Step 4: Rewire the page**

Replace the inline evidence filtering with `partnerEvidenceInbox`, add the context card and the controls, and add the role-scoped activity list. Keep the existing "No assigned stage" early return and the existing `notFound()` access handling exactly as they are.

- [ ] **Step 5: Verify**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: compiled successfully.
Manual: `npm run dev`, sign in as `mortgage@example.com` after an advisor has made a warm intro on the paid case; confirm the context card, inbox, acknowledge button and milestone select all render and act.

- [ ] **Step 6: Commit**

```bash
git add src/app/partner/cases src/components/PartnerCaseContext.tsx src/components/PartnerIntegrationControls.tsx tests/domain/partner-activity.test.ts
git commit -m "feat: partner mini-view gains case context, evidence inbox and port-backed actions"
```

---

### Task 9: Advisor cockpit integration tickets and adapter activity

**Files:**
- Create: `src/components/PartnerIntegrationPanel.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx:86-89` (drop the ad-hoc event filter) and `:176-201` (replace the "Partner history" block)

**Interfaces:**
- Consumes: `partnerTickets`, `partnerActivity`, `canUseSpeedRails`, `syncPartnerStatusAction`, `milestonesForRole` (for labels), `partnerRoleLabel`.
- Produces: `PartnerIntegrationPanel`.

**What the advisor gains over today's flat event list:**
- **Ticket cards**, one per `PartnerTicketSummary`: role label, panel member name, adapter id (`manual` vs `stub-conveyancer` — the advisor can see at a glance which lane a case is on), opened/last-update timestamps, acknowledgement state with `ackLatencyDays`, last known status, milestone labels resolved through the pack, evidence-submitted count, nudge count, and a closed badge with the re-route reason.
- A **Sync partner status** button per open ticket, shown only when `canUseSpeedRails(caseState)` and the ticket's role owns the focus stage, wired to `syncPartnerStatusAction`.
- **Full activity** below the cards: every row from `partnerActivity`, across all roles (the advisor is the one actor entitled to the whole picture), with the status/milestone/detail columns decoded rather than dumping raw JSON payloads as the current implementation does.
- An **unacknowledged** highlight when a ticket has `acknowledgedAt === null` and `openDays >= 1`, sitting next to the existing nudge control in `PartnerOpsControls` — this is the spec §8 partner-non-response loop getting a better trigger, not a new mechanism.

Nothing here renders a promised date, and no scorecard data moves onto the case page (`/cockpit/panel` remains the scorecard surface).

- [ ] **Step 1: Write the failing test**

Add to `tests/domain/partner-activity.test.ts`:

```ts
  it("flags a ticket the partner has not acknowledged after a day", () => {
    const [ticket] = partnerTickets(caseWithEvents([WARM]), NOW);
    expect(ticket.acknowledgedAt).toBeNull();
    expect(ticket.openDays).toBeGreaterThanOrEqual(1);
  });

  it("orders tickets by open time so the cockpit reads chronologically", () => {
    const tickets = partnerTickets(caseWithEvents([WARM, CONVEYANCER_ACK]), NOW);
    expect(tickets.map((t) => t.role)).toEqual(["MORTGAGE_PARTNER", "CONVEYANCER"]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/partner-activity.test.ts`
Expected: FAIL if ordering or `openDays` is not yet implemented as specified; otherwise it passes and confirms Task 1's model already covers the cockpit's needs — record that and move on.

- [ ] **Step 3: Build the panel and rewire the cockpit page**

Follow the existing cockpit patterns: `PartnerIntegrationPanel` is `"use client"` only because of the sync button; take `{ caseId, tickets, activity, railsEnabled, syncableRoles }` as props and keep all formatting (labels, `toLocaleString`) inside it. Delete the `partnerEvents` filter and the "Partner history" JSX block from the page and render the panel in that slot.

- [ ] **Step 4: Verify**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: compiled successfully.
Manual: as `advisor@example.com` on the paid case, confirm ticket cards appear after a warm intro, "Sync partner status" appends a status row, and the raw JSON payload dump is gone.

- [ ] **Step 5: Commit**

```bash
git add src/components/PartnerIntegrationPanel.tsx src/app/cockpit/cases tests/domain/partner-activity.test.ts
git commit -m "feat: advisor cockpit shows partner integration tickets and adapter activity"
```

---

### Task 10: Demo script, README, flag-doc corrections and final verification

**Files:**
- Create: `docs/superpowers/plans/demo-script-speed-rails.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md` (the module list now has `partner_speed_rails` **on** for `ew`)
- Modify: `README.md`

**Interfaces:** documentation only.

- [ ] **Step 1: Correct the Plan 4 documentation that this plan invalidates**

In `docs/superpowers/plans/demo-script-market-packs.md`, section "1. E&W is a pack, and the cockpit can read it", step 4 currently lists `partner_speed_rails` among the modules that are off. Rewrite it to:

`Modules: fx_deposit and partner_speed_rails are **on**. chain_free_inventory, hard_client_sla, corridor_inbound, corridor_outbound and document_vault are **off** — the spec §9 dependency rule as data, not a promise in a doc. Speed rails being on means adapter plumbing exists, not that any date is guaranteed.`

Make the same correction in the README's "Module toggles are data" paragraph.

- [ ] **Step 2: Write the demo script**

Create `docs/superpowers/plans/demo-script-speed-rails.md`. Content requirements — one numbered walkthrough per claim, each executable against seeded data, and an explicit honesty section:

- **Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`; `PARTNER_WEBHOOK_SECRET` set in `.env`; all logins use password `password`.
- **1. The rail is a flag, and it is off in markets we have not built.** `/cockpit/market-packs` → `ew` shows `partner_speed_rails` on, `au` shows it off; `chain_free_inventory` and `hard_client_sla` are off in both.
- **2. A ticket opens.** As `advisor@example.com` on **Bloggs return (paid)**, advance to a partner-owned stage, request a warm intro to Priya Nair. The integration panel now shows one ticket: role `mortgage adviser`, adapter `stub-mortgage`, unacknowledged.
- **3. The partner works their own lane.** As `mortgage@example.com`, the mini-view shows case context, the required-evidence inbox and the acknowledge button. Acknowledge, then report `Decision in principle submitted`. Back in the cockpit the ticket shows an acknowledgement latency and a milestone. Note what the partner cannot see: no playbook, no scores, no fee status, no other partner's ticket.
- **4. The adapter simulates turnaround, deterministically.** As the advisor, press **Sync partner status** repeatedly — the status does not jitter, because it is a pure function of days-in-stage and the mortgage profile's three-day cadence. Point at `tests/lib/partner-adapters.test.ts` for the ladder assertions.
- **5. An update arrives from outside the app.** POST to `http://localhost:3000/api/partner-updates` with header `x-partner-signature: dev-partner-secret` and body `{"caseId":"<id>","ticketId":"<ticket>","role":"MORTGAGE_PARTNER","status":"EVIDENCE_READY"}`. The response is `{"ok":true,"applied":"SUBMIT_EVIDENCE"}` and `dip_aip` now sits in the advisor's awaiting-acceptance list. Repeat with a wrong secret (401), a malformed body (400) and an unknown ticket (409). Include both a `curl` one-liner and a PowerShell `Invoke-RestMethod` one-liner as plain indented lines.
- **6. The advisor still owns the case.** The inbound update submitted evidence and nothing else: the stage is still `ACTIVE`, no acceptance, no advance. Accept and advance manually to prove the rail did not take that power. Cross-reference `tests/server/adapter-authority.test.ts`.
- **7. Rails are paid and market-scoped.** On **Smith DIY journey** (`FREE_DIY`) there is no integration surface, and an inbound update for it is refused.
- **What is real and what is stubbed** — a short, blunt list: real = the port, the ledger events, the inbound mapping, the gate, the partner and advisor surfaces; stubbed = the three adapters' turnaround simulation and the loopback webhook; absent = every live vendor API, OAuth, chain-free inventory, and any client-facing guaranteed date.

- [ ] **Step 3: Update the README**

Insert a new section after "Partner panel, scorecards and referrals" and before "Market packs (configuration layer)":

`## Partner speed rails (deep integrations, stubbed)` covering:
- The port: `src/lib/partner-port.ts` — `requestWarmIntro`, `acknowledgeCase`, `syncStatus`, `submitPartnerEvidence`, `reportMilestone`, with a table of the three implementations (`ManualPartnerPort` / `manual`, `StubPartnerAdapter` × three profiles, and "a future vendor client" as the fourth row that costs no rewrite).
- The deliberate absence of accept / advance / block / resume / re-route from the port, enforced by `tests/server/adapter-authority.test.ts`.
- The four additive event types and the statement that Plan 1–3 event shapes are frozen.
- Simulated turnaround is deterministic (days-in-stage ÷ profile cadence), never random, never networked.
- The inbound loopback endpoint, its single shared secret, and a warning to replace `PARTNER_WEBHOOK_SECRET` outside development.
- The gate: `partner_speed_rails` (pack) **and** `PAID_DWY` (tier), via `canUseSpeedRails` / `assertSpeedRails`.
- Milestone vocabulary is pack data (`ew-milestones.ts`), so a second market brings its own process language.
- One explicit sentence: **no live third-party conveyancing, FX, mortgage or removals integration exists, and no client-facing guaranteed date is produced anywhere in this system.**
- Link to `docs/superpowers/plans/demo-script-speed-rails.md`.

Also add `PARTNER_WEBHOOK_SECRET` to the setup section's note about `.env`.

- [ ] **Step 4: Full verification**

Run: `npm test`
Expected: PASS, no failing files. Confirm specifically that `tests/server/warm-intro.test.ts`, `tests/server/warm-intro-action.test.ts`, `tests/server/partner-actions.test.ts`, `tests/server/scorecards.test.ts` and `tests/domain/engine-country-agnostic.test.ts` are green — those are the four regression surfaces this plan touches indirectly.

Run: `npm run build`
Expected: `✓ Compiled successfully` with no TypeScript or lint errors.

Run: `npm run db:push && npm run db:seed`
Expected: both exit 0.

- [ ] **Step 5: Manual smoke check**

`npm run dev`, then walk sections 2–7 of the demo script end to end.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/demo-script-speed-rails.md docs/superpowers/plans/demo-script-market-packs.md README.md
git commit -m "docs: speed rails demo script and README partner integration surface"
```

---

## Self-review notes

**Spec coverage:**
- §7 "Manual partner ops in v1 behind clean APIs/interfaces so deeper integrations can land without rewrite" → Task 4 (the port grows to five methods and `ManualPartnerPort` implements all of them), Task 5 (a second and third implementation land with no engine change).
- §7 "tight integration is a deliberate future speed moat" → Tasks 5–7, deliberately as stubs.
- §7 partner contract terms (response SLA, portal participation, referral disclosure, quality score) → acknowledgement latency and status/milestone reporting in Tasks 1, 8, 9 give the response-SLA and portal-participation terms a machine-readable trace; disclosure and quality score remain Plan 3's, untouched.
- §8 "Clean partner interfaces from day one; manual fulfilment acceptable in v1" → the manual port stays a first-class implementation and is the fallback whenever the flag or tier says no.
- §8 "Stage engine is source of truth" / "Partner non-response → nudge + scorecard hit + advisor re-route" → the authority guard test in Task 5, and the unacknowledged-ticket highlight in Task 9 feeding the existing nudge/re-route controls rather than replacing them.
- §9 Phase 2 "Deep integrations (conveyancing, FX, removals); stronger partner views" → three role-specific adapters (Task 5), the mini-view (Task 8), the cockpit panel (Task 9).
- §9 Phase 2 "optional hard guarantees" and the dependency rule → deliberately **not** taken: `hard_client_sla` and `chain_free_inventory` stay off and stay in `GATED_MODULES`.
- §9 Phase 2 "explicit UK-resident speed segment" → the `UK_RESIDENT_SPEED` entry context already exists from Plans 1–2 and drives the fixtures here; no new segmentation is introduced, because a segment without hard guarantees is just the existing entry context.
- §10 "what travels" (pressure model, scorecards, cockpit) → the statuses, port, tickets and activity model are engine-global and guarded by the extended country-agnostic test.
- §10 "what doesn't" (mortgage rules, conveyancing) → milestone vocabulary is pack data (Task 2).
- §13 sub-project 5 goals 1–8 → Task 4 (goal 1), Task 5 (goal 2), Tasks 6–7 (goal 3), Task 8 (goal 4), Task 9 (goal 5), Task 3 (goal 6), Task 10 (goal 7), Tasks 2–3 and the untouched panel/registry code (goal 8).

**Non-goals honoured:** no live vendor HTTP or OAuth (guarded by the outbound-call test), no chain-free work, no client-facing SLA or guaranteed dates, no AU/US corridor content (the `au` stub gains an empty milestone function and nothing else), no document vault or binary uploads, no FCA AR, no marketplace. Plans 1–4 are modified only where the port expansion requires it.

**Frozen-shape risk and how it is contained:** the highest-risk change is moving `ManualPartnerPort` onto a `CaseStore`. `requestWarmIntro`'s body, ticket prefix, actor role and payload keys are copied verbatim, and `tests/server/warm-intro.test.ts` is deliberately **not** edited so it acts as the regression oracle. The second risk is routing `submitPartnerEvidenceAction` through the port; the port delegates to the same engine function, so `EVIDENCE_SUBMITTED` keeps its bare-string payload and `src/domain/scorecard.ts`'s participation check (which matches on type + actor role) is unaffected.

**Deliberate duplication:** `railsEnabled` in `src/lib/partner-adapters/registry.ts` restates `canUseSpeedRails` from `src/server/partner-policy.ts`. Merging them would make `src/lib` depend on `src/server` and drag Prisma into the adapter unit tests. The lib copy returns a boolean and picks an implementation; the server copy throws and is the security boundary. Both are commented as a pair.

**Type-consistency ledger:** `MarketPack` gains exactly one field in this plan (`partnerMilestones`, Task 2), and `ew.ts`, `au-stub.ts` and `tests/support/fixture-pack.ts` are all updated in that same task, so no pack is ever left non-conforming. `MarketPackSummary` gains `partnerMilestoneKeys` in the same task as its only consumer. `PartnerPort` gains four methods in Task 4 and both implementations exist before any caller in Task 6 uses them. `tests/support/memory-case-store.ts` is created in Task 4 and gains the shared `atMortgagePath` fixture in Task 5, before Task 6's tests import it.

**Known limitation to record, not fix:** acknowledgement latency is computed on the fly from the ledger in `partner-activity.ts` and is not folded into `PartnerScorecard`. Adding a responsiveness term to the quality score would change every existing scorecard assertion in `tests/domain/scorecard.test.ts` and `tests/server/scorecards.test.ts` for no behaviour this sub-project needs. It is a one-task follow-on once real partners have generated acknowledgement data.
