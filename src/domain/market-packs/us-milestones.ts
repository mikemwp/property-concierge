import { isPartnerActorRole, type ActorRole } from "../types";
import type { PartnerMilestone } from "./types";

const US_MILESTONES: Record<string, Array<[string, string]>> = {
  MORTGAGE_PARTNER: [
    ["fact_find_booked", "Fact find booked"],
    ["pre_approval_submitted", "Pre-approval submitted"],
    ["lender_decision", "Lender decision received"],
  ],
  CONVEYANCER: [
    ["engagement_sent", "Engagement letter sent"],
    ["title_ordered", "Title search ordered"],
    ["inspection_period_open", "Inspection period open"],
    ["closing_scheduled", "Closing scheduled"],
  ],
  MOVE_PARTNER: [
    ["survey_booked", "Pre-move survey booked"],
    ["quote_issued", "Move quote issued"],
    ["date_held", "Move date provisionally held"],
  ],
};

export function usPartnerMilestones(role: ActorRole): PartnerMilestone[] {
  if (!isPartnerActorRole(role)) {
    return [];
  }
  return (US_MILESTONES[role] ?? []).map(([key, label]) => ({ key, label, role }));
}
