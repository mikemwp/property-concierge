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
