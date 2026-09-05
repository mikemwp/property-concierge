import type { StageState } from "@/domain/stage-engine";
import { daysInStage } from "@/domain/escalation";
import {
  partnerEvidenceInbox,
  type PartnerStatus,
} from "@/domain/partner-integration";
import type { CaseStore } from "@/lib/case-store";
import {
  ManualPartnerPort,
  appendIntegrationEvent,
  buildPartnerEventPayload,
  requirePartnerFocusStage,
  resolveTicketId,
  type PartnerPortContext,
  type PartnerPortResult,
} from "@/lib/partner-port";
import type { AdapterProfile } from "./profiles";

export class StubPartnerAdapter extends ManualPartnerPort {
  readonly adapterId: string;

  constructor(
    private readonly profile: AdapterProfile,
    store: CaseStore,
  ) {
    super(store);
    this.adapterId = profile.adapterId;
  }

  private simulatedStatus(
    stage: StageState,
    now: Date,
  ): { status: PartnerStatus; latencyDays: number } {
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

  async syncStatus(
    input: PartnerPortContext,
  ): Promise<PartnerPortResult & { status: PartnerStatus }> {
    let caseState = await this.store.load(input.caseId);
    const stage = requirePartnerFocusStage(caseState, input.role);
    const at = (input.now ?? new Date()).toISOString();
    const ticketId = resolveTicketId(caseState, input.role, "ack", at);
    const { status, latencyDays } = this.simulatedStatus(stage, input.now ?? new Date());

    caseState = appendIntegrationEvent(caseState, {
      type: "PARTNER_STATUS_SYNCED",
      stageKey: stage.key,
      role: input.role,
      at,
      payload: buildPartnerEventPayload(input, this.adapterId, ticketId, {
        status,
        simulatedLatencyDays: latencyDays,
      }),
    });

    await this.store.save(caseState);
    return { ticketId, eventType: "PARTNER_STATUS_SYNCED", status };
  }
}
