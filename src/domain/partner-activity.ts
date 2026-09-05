import type { CaseState } from "./stage-engine";
import type { ActorRole } from "./types";
import { isPartnerActorRole } from "./types";
import {
  decodePartnerEventPayload,
  PARTNER_INTEGRATION_EVENT_TYPES,
  type PartnerStatus,
} from "./partner-integration";

const INTEGRATION_TYPES = new Set<string>(PARTNER_INTEGRATION_EVENT_TYPES);

function utcDayFloor(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysBetweenUtc(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((utcDayFloor(end) - utcDayFloor(start)) / msPerDay));
}

function isPartnerLedgerEvent(event: CaseState["events"][number]): boolean {
  if (event.type === "WARM_INTRO_REQUESTED") {
    return true;
  }
  if (event.type === "PARTNER_NUDGED") {
    return true;
  }
  if (event.type === "PARTNER_REROUTED") {
    return true;
  }
  if (INTEGRATION_TYPES.has(event.type)) {
    return true;
  }
  if (event.type === "EVIDENCE_SUBMITTED" && isPartnerActorRole(event.actorRole)) {
    return true;
  }
  return false;
}

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

export function partnerActivity(caseState: CaseState): PartnerActivityRow[] {
  const rows: PartnerActivityRow[] = [];
  const openTicketByRole = new Map<ActorRole, string>();

  for (const event of caseState.events) {
    if (!isPartnerLedgerEvent(event)) {
      continue;
    }

    const base: PartnerActivityRow = {
      at: event.at,
      type: event.type,
      stageKey: event.stageKey,
      actorRole: event.actorRole,
      role: null,
      ticketId: null,
      adapterId: null,
      status: null,
      milestoneKey: null,
      detail: null,
    };

    if (event.type === "PARTNER_NUDGED") {
      rows.push({
        ...base,
        role: (event.payload ?? null) as ActorRole | null,
      });
      continue;
    }

    if (event.type === "PARTNER_REROUTED") {
      let role: ActorRole | null = null;
      let toPartnerId: string | null = null;
      try {
        const parsed = JSON.parse(event.payload ?? "{}") as Record<string, unknown>;
        role = (parsed.roleType as ActorRole) ?? null;
        toPartnerId = typeof parsed.toPartnerId === "string" ? parsed.toPartnerId : null;
      } catch {
        // malformed payload — row still emitted with nulls
      }
      if (role) {
        openTicketByRole.delete(role);
      }
      rows.push({
        ...base,
        role,
        detail: toPartnerId ? `rerouted to ${toPartnerId}` : null,
      });
      continue;
    }

    if (event.type === "EVIDENCE_SUBMITTED") {
      rows.push({
        ...base,
        role: event.actorRole,
        ticketId: openTicketByRole.get(event.actorRole) ?? null,
        detail: event.payload ?? null,
      });
      continue;
    }

    const decoded = decodePartnerEventPayload(event.payload);
    if (decoded) {
      if (decoded.ticketId && decoded.role) {
        openTicketByRole.set(decoded.role, decoded.ticketId);
      }
      rows.push({
        ...base,
        role: decoded.role,
        ticketId: decoded.ticketId,
        adapterId: decoded.adapterId,
        status: decoded.status ?? null,
        milestoneKey: decoded.milestoneKey ?? null,
        detail: decoded.note ?? decoded.reason ?? null,
      });
      continue;
    }

    rows.push(base);
  }

  return rows;
}

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

function payloadForRow(caseState: CaseState, row: PartnerActivityRow) {
  const event = caseState.events.find(
    (candidate) =>
      candidate.at === row.at && candidate.type === row.type && candidate.stageKey === row.stageKey,
  );
  return decodePartnerEventPayload(event?.payload);
}

function createTicket(row: PartnerActivityRow, decoded: ReturnType<typeof decodePartnerEventPayload>): PartnerTicketSummary {
  return {
    ticketId: row.ticketId!,
    role: row.role!,
    adapterId: row.adapterId ?? "manual",
    panelMemberId: decoded?.panelMemberId ?? null,
    panelMemberName: decoded?.panelMemberName ?? null,
    openedAt: row.at,
    openDays: 0,
    acknowledgedAt: null,
    ackLatencyDays: null,
    lastStatus: null,
    lastUpdateAt: row.at,
    milestoneKeys: [],
    evidenceSubmitted: 0,
    nudges: 0,
    closedAt: null,
    closeReason: null,
  };
}

export function partnerTickets(caseState: CaseState, now: Date): PartnerTicketSummary[] {
  const rows = partnerActivity(caseState);
  const tickets = new Map<string, PartnerTicketSummary>();
  const ticketOrder: string[] = [];
  const openByRole = new Map<ActorRole, string>();

  for (const row of rows) {
    if (row.type === "PARTNER_REROUTED" && row.role) {
      const openId = openByRole.get(row.role);
      if (openId) {
        const ticket = tickets.get(openId);
        if (ticket) {
          ticket.closedAt = row.at;
          ticket.closeReason = "REROUTED";
          ticket.lastUpdateAt = row.at;
          ticket.openDays = daysBetweenUtc(new Date(ticket.openedAt), new Date(row.at));
        }
        openByRole.delete(row.role);
      }
      continue;
    }

    if (row.type === "PARTNER_NUDGED" && row.role) {
      const openId = openByRole.get(row.role);
      if (openId) {
        const ticket = tickets.get(openId);
        if (ticket) {
          ticket.nudges += 1;
          ticket.lastUpdateAt = row.at;
        }
      }
      continue;
    }

    if (!row.ticketId || !row.role) {
      continue;
    }

    const decoded = payloadForRow(caseState, row);
    let ticket = tickets.get(row.ticketId);
    if (!ticket) {
      ticket = createTicket(row, decoded);
      tickets.set(row.ticketId, ticket);
      ticketOrder.push(row.ticketId);
      openByRole.set(row.role, row.ticketId);
    }

    if (row.adapterId && row.adapterId !== "manual") {
      ticket.adapterId = row.adapterId;
    }
    if (decoded?.panelMemberId) {
      ticket.panelMemberId = decoded.panelMemberId;
    }
    if (decoded?.panelMemberName) {
      ticket.panelMemberName = decoded.panelMemberName;
    }
    if (row.type === "PARTNER_CASE_ACKNOWLEDGED") {
      ticket.acknowledgedAt = row.at;
    }
    if (row.status) {
      ticket.lastStatus = row.status;
    }
    if (row.milestoneKey && !ticket.milestoneKeys.includes(row.milestoneKey)) {
      ticket.milestoneKeys.push(row.milestoneKey);
    }
    if (row.type === "EVIDENCE_SUBMITTED") {
      ticket.evidenceSubmitted += 1;
    }
    ticket.lastUpdateAt = row.at;
  }

  for (const ticketId of ticketOrder) {
    const ticket = tickets.get(ticketId)!;
    const end = ticket.closedAt ? new Date(ticket.closedAt) : now;
    ticket.openDays = daysBetweenUtc(new Date(ticket.openedAt), end);
    if (ticket.acknowledgedAt) {
      ticket.ackLatencyDays = daysBetweenUtc(new Date(ticket.openedAt), new Date(ticket.acknowledgedAt));
    }
  }

  return ticketOrder.map((id) => tickets.get(id)!);
}

export function openTicketForRole(caseState: CaseState, role: ActorRole): PartnerTicketSummary | null {
  const rows = partnerActivity(caseState);
  const lastAt = rows.at(-1)?.at ?? caseState.events.at(-1)?.at;
  const now = new Date(lastAt ?? Date.now());
  const open = partnerTickets(caseState, now).filter((ticket) => ticket.role === role && ticket.closedAt === null);
  return open.at(-1) ?? null;
}
