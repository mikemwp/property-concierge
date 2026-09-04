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

const CONVEYANCER_ACK = {
  type: "WARM_INTRO_REQUESTED",
  stageKey: "conveyancing",
  actorRole: "ADVISOR" as const,
  at: "2026-09-03T09:00:00.000Z",
  payload: JSON.stringify({
    partnerType: "CONVEYANCER",
    note: "Needs instructing this week",
    ticketId: "warm-c1-99",
    panelMemberId: "seed_panel_tom",
    panelMemberName: "Tom Ashby",
  }),
};

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

  it("scopes activity to one role so a partner cannot see another partner's ticket", () => {
    const rows = partnerActivity(caseWithEvents([WARM, ACK, CONVEYANCER_ACK]));
    expect(rows.filter((r) => r.role === "MORTGAGE_PARTNER")).toHaveLength(2);
    expect(rows.filter((r) => r.role === "CONVEYANCER")).toHaveLength(1);
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

  it("flags a ticket the partner has not acknowledged after a day", () => {
    const [ticket] = partnerTickets(caseWithEvents([WARM]), NOW);
    expect(ticket.acknowledgedAt).toBeNull();
    expect(ticket.openDays).toBeGreaterThanOrEqual(1);
  });

  it("orders tickets by open time so the cockpit reads chronologically", () => {
    const tickets = partnerTickets(caseWithEvents([WARM, CONVEYANCER_ACK]), NOW);
    expect(tickets.map((t) => t.role)).toEqual(["MORTGAGE_PARTNER", "CONVEYANCER"]);
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
