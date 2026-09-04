import type { EntryContext } from "../types";
import type { MarketPack, StageTemplate } from "./types";

export { getStageTemplate } from "./types";

function moneyEvidenceKinds(entry: EntryContext): string[] {
  const kinds = ["source_of_funds"];
  if (entry !== "UK_RESIDENT_SPEED") {
    kinds.push("fx_plan");
  }
  return kinds;
}

function moveEvidenceKinds(entry: EntryContext): string[] {
  const kinds = ["move_quote"];
  if (entry === "RETURNER_OVERSEAS") {
    kinds.push("vehicle_path");
  }
  return kinds;
}

export const ewMarketPack: MarketPack = {
  id: "ew",
  name: "England & Wales",
  jurisdiction: "england_wales",
  buildStages(entry: EntryContext): StageTemplate[] {
    return [
      {
        key: "purchase_profile",
        title: "Purchase profile",
        defaultOwnerRole: "CLIENT",
        slaDays: 3,
        requiredEvidenceKinds: [],
        freeVisible: true,
        freeCanSelfAdvance: true,
      },
      {
        key: "money_readiness",
        title: "Money readiness",
        defaultOwnerRole: "CLIENT",
        slaDays: 7,
        requiredEvidenceKinds: moneyEvidenceKinds(entry),
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
  },
};
