import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { UK_US_FLAGS } from "./uk-us-config";
import type { StageTemplate } from "./types";

function usLegalSpine(): StageTemplate[] {
  return [
    {
      key: "purchase_profile",
      title: "Purchase profile",
      defaultOwnerRole: "CLIENT",
      slaDays: 3,
      requiredEvidenceKinds: ["profile_complete"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "money_readiness",
      title: "Money readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["source_of_funds"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "finance_path",
      title: "Finance path",
      defaultOwnerRole: "MORTGAGE_PARTNER",
      slaDays: 14,
      requiredEvidenceKinds: ["pre_approval"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: ["move_quote"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "search_readiness",
      title: "Search readiness",
      defaultOwnerRole: "CLIENT",
      slaDays: 7,
      requiredEvidenceKinds: ["buyer_ready"],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
    {
      key: "offer_instruct",
      title: "Offer → instruct",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 5,
      requiredEvidenceKinds: ["closing_agent_instructed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "diligence",
      title: "Diligence",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 21,
      requiredEvidenceKinds: ["inspection_complete"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "closing_complete",
      title: "Closing",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 14,
      requiredEvidenceKinds: ["closing_confirmed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "settle_light",
      title: "Settle (light)",
      defaultOwnerRole: "CLIENT",
      slaDays: 14,
      requiredEvidenceKinds: [],
      freeVisible: true,
      freeCanSelfAdvance: true,
    },
  ];
}

export function ukUsStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(usLegalSpine(), entry, UK_US_FLAGS);
}
