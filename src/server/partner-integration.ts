import type { StageState } from "@/domain/stage-engine";
import { getFocusStage } from "@/domain/stage-engine";
import { isMilestoneForRole } from "@/domain/market-packs/types";
import { openTicketForRole, type PartnerTicketSummary } from "@/domain/partner-activity";
import {
  intentForStatus,
  isPartnerStatus,
  type PartnerStatus,
  type PartnerUpdateIntent,
} from "@/domain/partner-integration";
import { isPartnerActorRole, type ActorRole } from "@/domain/types";
import { partnerPortForCase } from "@/lib/partner-adapters/registry";
import { casePack } from "@/lib/case-pack";
import { type CaseStore, prismaCaseStore } from "@/lib/case-store";
import {
  appendIntegrationEvent,
  buildPartnerEventPayload,
  type PartnerPortContext,
} from "@/lib/partner-port";
import { assertSpeedRails } from "@/server/partner-policy";

export class PartnerIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerIntegrationError";
  }
}

export type InboundPartnerUpdate = {
  caseId: string;
  ticketId: string;
  role: ActorRole;
  status: PartnerStatus;
  milestoneKey?: string;
  note?: string;
};

export type InboundResult = {
  applied: PartnerUpdateIntent["kind"];
  ticketId: string;
  eventTypes: string[];
};

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PartnerIntegrationError(`Invalid inbound update: ${field} must be a non-empty string`);
  }
  return value;
}

export function parseInboundUpdate(raw: unknown): InboundPartnerUpdate {
  if (typeof raw !== "object" || raw === null) {
    throw new PartnerIntegrationError("Invalid inbound update: expected an object");
  }

  const record = raw as Record<string, unknown>;
  const caseId = nonEmptyString(record.caseId, "caseId");
  const ticketId = nonEmptyString(record.ticketId, "ticketId");

  if (typeof record.role !== "string" || !isPartnerActorRole(record.role as ActorRole)) {
    throw new PartnerIntegrationError("Invalid inbound update: role must be a partner role");
  }
  const role = record.role as ActorRole;

  if (typeof record.status !== "string" || !isPartnerStatus(record.status)) {
    throw new PartnerIntegrationError("Invalid inbound update: status must be a partner status");
  }
  const status = record.status;

  const update: InboundPartnerUpdate = { caseId, ticketId, role, status };

  if (record.milestoneKey !== undefined) {
    update.milestoneKey = nonEmptyString(record.milestoneKey, "milestoneKey");
  }
  if (record.note !== undefined) {
    update.note = nonEmptyString(record.note, "note");
  }

  return update;
}

function resolveOpenTicket(
  caseState: Awaited<ReturnType<CaseStore["load"]>>,
  update: InboundPartnerUpdate,
): PartnerTicketSummary {
  const ticket = openTicketForRole(caseState, update.role);
  if (!ticket || ticket.ticketId !== update.ticketId) {
    throw new PartnerIntegrationError(`No open ticket ${update.ticketId} for ${update.role}`);
  }
  return ticket;
}

async function appendRejection(
  store: CaseStore,
  caseState: Awaited<ReturnType<CaseStore["load"]>>,
  focus: StageState,
  context: PartnerPortContext,
  adapterId: string,
  ticketId: string,
  reason: string,
): Promise<void> {
  const at = (context.now ?? new Date()).toISOString();
  const updated = appendIntegrationEvent(caseState, {
    type: "PARTNER_UPDATE_REJECTED",
    stageKey: focus.key,
    role: context.role,
    at,
    payload: buildPartnerEventPayload(context, adapterId, ticketId, { reason }),
  });
  await store.save(updated);
}

export async function applyPartnerUpdate(
  update: InboundPartnerUpdate,
  options: { now?: Date; store?: CaseStore } = {},
): Promise<InboundResult> {
  const store = options.store ?? prismaCaseStore;
  const now = options.now ?? new Date();

  const caseState = await store.load(update.caseId);
  assertSpeedRails(caseState);

  const ticket = resolveOpenTicket(caseState, update);

  const focus = getFocusStage(caseState);
  if (!focus) {
    throw new PartnerIntegrationError("Case has no focus stage");
  }

  if (update.milestoneKey && !isMilestoneForRole(casePack(caseState), update.role, update.milestoneKey)) {
    throw new PartnerIntegrationError(`Unknown milestone for ${update.role}: ${update.milestoneKey}`);
  }

  const port = partnerPortForCase(caseState, update.role, store);
  const context: PartnerPortContext = {
    caseId: update.caseId,
    role: update.role,
    panelMemberId: ticket.panelMemberId,
    panelMemberName: ticket.panelMemberName,
    now,
  };

  const intent = intentForStatus({ status: update.status, role: update.role, stage: focus });
  const eventTypes: string[] = [];

  switch (intent.kind) {
    case "ACKNOWLEDGE": {
      const result = await port.acknowledgeCase({ ...context, note: update.note });
      eventTypes.push(result.eventType);
      break;
    }
    case "NOTE_ONLY": {
      const result = await port.syncStatus(context);
      eventTypes.push(result.eventType);
      break;
    }
    case "SUBMIT_EVIDENCE": {
      for (const kind of intent.kinds) {
        const result = await port.submitPartnerEvidence({
          ...context,
          stageKey: focus.key,
          kind,
        });
        eventTypes.push(result.eventType);
      }
      break;
    }
    case "REJECT": {
      await appendRejection(
        store,
        caseState,
        focus,
        context,
        port.adapterId,
        update.ticketId,
        intent.reason,
      );
      eventTypes.push("PARTNER_UPDATE_REJECTED");
      break;
    }
  }

  if (update.milestoneKey && intent.kind !== "REJECT") {
    const milestoneResult = await port.reportMilestone({
      ...context,
      milestoneKey: update.milestoneKey,
      note: update.note,
    });
    eventTypes.push(milestoneResult.eventType);
  }

  return { applied: intent.kind, ticketId: ticket.ticketId, eventTypes };
}
