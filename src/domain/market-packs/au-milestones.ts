import { isPartnerActorRole, type ActorRole } from "../types";
import type { PartnerMilestone } from "./types";

const AU_MILESTONES: Record<string, Array<[string, string]>> = {
  MORTGAGE_PARTNER: [
    ["fact_find_booked", "Fact find booked"],
    ["pre_approval_submitted", "Pre-approval submitted"],
    ["lender_decision", "Lender decision received"],
  ],
  CONVEYANCER: [
    ["client_care_sent", "Client care pack sent"],
    ["contract_reviewed", "Contract reviewed"],
    ["searches_ordered", "Searches ordered"],
    ["settlement_booked", "Settlement booked"],
  ],
  MOVE_PARTNER: [
    ["survey_booked", "Pre-move survey booked"],
    ["quote_issued", "Move quote issued"],
    ["date_held", "Move date provisionally held"],
  ],
};

export function auPartnerMilestones(role: ActorRole): PartnerMilestone[] {
  if (!isPartnerActorRole(role)) {
    return [];
  }
  return (AU_MILESTONES[role] ?? []).map(([key, label]) => ({ key, label, role }));
}
