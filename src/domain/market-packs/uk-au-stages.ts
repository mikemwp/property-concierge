import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { UK_AU_FLAGS } from "./uk-au-config";
import type { StageTemplate } from "./types";

function auLegalSpine(): StageTemplate[] {
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
      requiredEvidenceKinds: ["conveyancer_instructed"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "diligence",
      title: "Diligence",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 21,
      requiredEvidenceKinds: ["searches_complete"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "settlement_complete",
      title: "Settlement → complete",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 14,
      requiredEvidenceKinds: ["settlement_confirmed"],
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

export function ukAuStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(auLegalSpine(), entry, UK_AU_FLAGS);
}
