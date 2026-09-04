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
