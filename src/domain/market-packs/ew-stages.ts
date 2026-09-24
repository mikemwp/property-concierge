import type { EntryContext } from "../types";
import { EW_FLAGS } from "./ew-config";
import { isModuleEnabled, type MarketFlags, type StageTemplate } from "./types";

/** FX evidence exists only where the pack runs the fx_deposit module and the household holds foreign currency. */
export function moneyEvidenceKinds(
  entry: EntryContext,
  flags: MarketFlags,
): string[] {
  const kinds = ["source_of_funds"];
  if (isModuleEnabled(flags, "fx_deposit") && entry !== "UK_RESIDENT_SPEED") {
    kinds.push("fx_plan");
  }
  return kinds;
}

export function moveEvidenceKinds(entry: EntryContext): string[] {
  const kinds = ["move_quote"];
  if (entry === "RETURNER_OVERSEAS") {
    kinds.push("vehicle_path");
  }
  return kinds;
}

export function chainFreeMatchingTemplate(): StageTemplate {
  return {
    key: "chain_free_matching",
    title: "Chain-free position",
    defaultOwnerRole: "CLIENT",
    slaDays: 7,
    requiredEvidenceKinds: ["chain_free_position"],
    freeVisible: true,
    freeCanSelfAdvance: false,
  };
}

/** England & Wales legal spine. Spec §4 canonical stage groups. */
export function ewStageTemplates(entry: EntryContext): StageTemplate[] {
  const stages: StageTemplate[] = [
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
      requiredEvidenceKinds: moneyEvidenceKinds(entry, EW_FLAGS),
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "mortgage_path",
      title: "Mortgage path",
      defaultOwnerRole: "MORTGAGE_PARTNER",
      slaDays: 14,
      requiredEvidenceKinds: ["dip_aip"],
      freeVisible: true,
      freeCanSelfAdvance: false,
    },
    {
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: moveEvidenceKinds(entry),
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
      key: "exchange_complete",
      title: "Exchange → complete",
      defaultOwnerRole: "CONVEYANCER",
      slaDays: 14,
      requiredEvidenceKinds: ["completion_confirmed"],
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

  if (!isModuleEnabled(EW_FLAGS, "chain_free_inventory")) {
    return stages;
  }
  const insertAt = stages.findIndex((stage) => stage.key === "offer_instruct");
  return [
    ...stages.slice(0, insertAt),
    chainFreeMatchingTemplate(),
    ...stages.slice(insertAt),
  ];
}
