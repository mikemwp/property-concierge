import type { CaseState, StageState } from "@/domain/stage-engine";
import { getFocusStage, submitPartnerEvidence as applyPartnerEvidence } from "@/domain/stage-engine";
import { isMilestoneForRole } from "@/domain/market-packs/types";
import { openTicketForRole } from "@/domain/partner-activity";
import {
  encodePartnerEventPayload,
  mintTicketId,
  partnerEvidenceInbox,
  type PartnerEventPayload,
  type PartnerIntegrationEventType,
  type PartnerStatus,
} from "@/domain/partner-integration";
import type { ActorRole } from "@/domain/types";
import { casePack } from "@/lib/case-pack";
import { type CaseStore, prismaCaseStore } from "@/lib/case-store";

export type WarmIntroRequest = {
  caseId: string;
  partnerType: ActorRole;
  note: string;
  panelMemberId: string;
  panelMemberName: string;
};

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

export function requirePartnerFocusStage(caseState: CaseState, role: ActorRole): StageState {
  const focus = getFocusStage(caseState);
  if (!focus) {
    throw new PartnerPortError("No focus stage");
  }
  if (focus.ownerRole !== role) {
    throw new PartnerPortError(`Stage owner is ${focus.ownerRole}, not ${role}`);
  }
  if (focus.status !== "ACTIVE" && focus.status !== "BLOCKED") {
    throw new PartnerPortError("Stage is not open for partner updates");
  }
  return focus;
}

export function resolveTicketId(
  caseState: CaseState,
  role: ActorRole,
  prefix: string,
  at: string,
): string {
  return openTicketForRole(caseState, role)?.ticketId ?? mintTicketId({ prefix, caseId: caseState.id, at });
}

export function appendIntegrationEvent(
  caseState: CaseState,
  input: {
    type: PartnerIntegrationEventType;
    stageKey: string;
    role: ActorRole;
    payload: PartnerEventPayload;
    at: string;
  },
): CaseState {
  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: input.type,
        stageKey: input.stageKey,
        actorRole: input.role,
        at: input.at,
        payload: encodePartnerEventPayload(input.payload),
      },
    ],
  };
}

export function derivedStatus(
  caseState: CaseState,
  stage: StageState,
  role: ActorRole,
): PartnerStatus {
  const inbox = partnerEvidenceInbox(stage);
  if (inbox.complete) {
    return "COMPLETE";
  }
  if (inbox.awaitingAcceptance.length > 0) {
    return "EVIDENCE_READY";
  }
  const ticket = openTicketForRole(caseState, role);
  if (ticket?.acknowledgedAt || (ticket?.milestoneKeys.length ?? 0) > 0) {
    return "IN_PROGRESS";
  }
  return "RECEIVED";
}

export function assertMilestone(caseState: CaseState, role: ActorRole, milestoneKey: string): void {
  if (!isMilestoneForRole(casePack(caseState), role, milestoneKey)) {
    throw new PartnerPortError(
      `Unknown milestone for ${role} in pack ${caseState.marketPackId}: ${milestoneKey}`,
    );
  }
}

export function buildPartnerEventPayload(
  input: PartnerPortContext,
  adapterId: string,
  ticketId: string,
  extra: Partial<PartnerEventPayload> = {},
): PartnerEventPayload {
  return {
    ticketId,
    adapterId,
    role: input.role,
    panelMemberId: input.panelMemberId,
    panelMemberName: input.panelMemberName ?? undefined,
    ...extra,
  };
}

export class ManualPartnerPort implements PartnerPort {
  readonly adapterId: string = "manual";

  constructor(protected readonly store: CaseStore = prismaCaseStore) {}

  async requestWarmIntro(input: WarmIntroRequest): Promise<{ ticketId: string }> {
    const caseState = await this.store.load(input.caseId);
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

    await this.store.save(updated);
    return { ticketId };
  }

  async acknowledgeCase(input: PartnerPortContext & { note?: string }): Promise<PartnerPortResult> {
    let caseState = await this.store.load(input.caseId);
    const stage = requirePartnerFocusStage(caseState, input.role);
    const at = (input.now ?? new Date()).toISOString();
    const ticketId = resolveTicketId(caseState, input.role, "ack", at);

    caseState = appendIntegrationEvent(caseState, {
      type: "PARTNER_CASE_ACKNOWLEDGED",
      stageKey: stage.key,
      role: input.role,
      at,
      payload: buildPartnerEventPayload(input, this.adapterId, ticketId, {
        status: "RECEIVED",
        note: input.note,
      }),
    });

    await this.store.save(caseState);
    return { ticketId, eventType: "PARTNER_CASE_ACKNOWLEDGED" };
  }

  async syncStatus(
    input: PartnerPortContext,
  ): Promise<PartnerPortResult & { status: PartnerStatus }> {
    let caseState = await this.store.load(input.caseId);
    const stage = requirePartnerFocusStage(caseState, input.role);
    const at = (input.now ?? new Date()).toISOString();
    const ticketId = resolveTicketId(caseState, input.role, "ack", at);
    const status = derivedStatus(caseState, stage, input.role);

    caseState = appendIntegrationEvent(caseState, {
      type: "PARTNER_STATUS_SYNCED",
      stageKey: stage.key,
      role: input.role,
      at,
      payload: buildPartnerEventPayload(input, this.adapterId, ticketId, { status }),
    });

    await this.store.save(caseState);
    return { ticketId, eventType: "PARTNER_STATUS_SYNCED", status };
  }

  async submitPartnerEvidence(
    input: PartnerPortContext & { stageKey: string; kind: string },
  ): Promise<PartnerPortResult> {
    let caseState = await this.store.load(input.caseId);
    const stage = requirePartnerFocusStage(caseState, input.role);
    if (stage.key !== input.stageKey) {
      throw new PartnerPortError("Evidence submit only on current focus stage");
    }
    const ticketId = resolveTicketId(
      caseState,
      input.role,
      "ack",
      (input.now ?? new Date()).toISOString(),
    );

    caseState = applyPartnerEvidence(caseState, {
      stageKey: input.stageKey,
      kind: input.kind,
      actorRole: input.role,
      now: input.now,
    });

    await this.store.save(caseState);
    return { ticketId, eventType: "EVIDENCE_SUBMITTED" };
  }

  async reportMilestone(
    input: PartnerPortContext & { milestoneKey: string; note?: string },
  ): Promise<PartnerPortResult> {
    let caseState = await this.store.load(input.caseId);
    const stage = requirePartnerFocusStage(caseState, input.role);
    assertMilestone(caseState, input.role, input.milestoneKey);
    const at = (input.now ?? new Date()).toISOString();
    const ticketId = resolveTicketId(caseState, input.role, "ack", at);

    caseState = appendIntegrationEvent(caseState, {
      type: "PARTNER_MILESTONE_REPORTED",
      stageKey: stage.key,
      role: input.role,
      at,
      payload: buildPartnerEventPayload(input, this.adapterId, ticketId, {
        milestoneKey: input.milestoneKey,
        note: input.note,
      }),
    });

    await this.store.save(caseState);
    return { ticketId, eventType: "PARTNER_MILESTONE_REPORTED" };
  }
}
