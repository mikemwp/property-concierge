import type { EntryContext } from "../types";
import { MarketPackError, type MarketPack, type StageTemplate } from "./types";

/**
 * Spec §3: "Second-country market packs (architecture ready only)". This pack exists
 * to prove the registry resolves more than one pack — it deliberately ships no AU
 * journeys, playbooks, evidence standards, partners or disclosure copy. It stays
 * `enabled: false`, so `resolveMarketPack("au")` refuses to back a case.
 * Corridor product work is Plan 7.
 */
function auStageTemplates(_entry: EntryContext): StageTemplate[] {
  /** Spec §10 country-agnostic spine. SLA cadence is a placeholder; the pack cannot run. */
  const spine: Array<[string, string, StageTemplate["defaultOwnerRole"]]> = [
    ["purchase_profile", "Purchase profile", "CLIENT"],
    ["money_readiness", "Money readiness", "CLIENT"],
    ["finance_path", "Finance path", "MORTGAGE_PARTNER"],
    ["move_logistics", "Move logistics", "MOVE_PARTNER"],
    ["search_readiness", "Search readiness", "CLIENT"],
    ["offer_instruct", "Offer → instruct", "CONVEYANCER"],
    ["diligence", "Diligence", "CONVEYANCER"],
    ["settlement_complete", "Settlement → complete", "CONVEYANCER"],
    ["settle_light", "Settle (light)", "CLIENT"],
  ];

  return spine.map(([key, title, defaultOwnerRole]) => ({
    key,
    title,
    defaultOwnerRole,
    slaDays: 7,
    requiredEvidenceKinds: [],
    freeVisible: false,
    freeCanSelfAdvance: false,
  }));
}

export const auStubPack: MarketPack = {
  id: "au",
  name: "Australia (configuration stub — not enabled)",
  jurisdiction: "australia",
  enabled: false,
  locale: {
    bcp47: "en-AU",
    currencyCode: "AUD",
    addressFieldKeys: ["line1", "line2", "suburb", "state", "postcode"],
    regionNoun: "state",
  },
  flags: {},
  copy: {
    jurisdiction_scope:
      "The Australia pack is a configuration stub. No cases run on it yet.",
    mortgage_posture:
      "Local finance rules are not written for this pack. Nothing here is advice.",
    region_prompt: "Which state are you buying in?",
    directory_intro: "There is no Australia partner panel yet.",
  },
  partnerRoleLabels: {
    CLIENT: "household",
    ADVISOR: "advisor",
    MORTGAGE_PARTNER: "mortgage broker",
    CONVEYANCER: "conveyancer",
    MOVE_PARTNER: "removalist",
  },
  buildStages: auStageTemplates,
  buildPlaybooks: () => [],
  /** AU partner process language is Plan 7. */
  partnerMilestones: () => [],
  disclosureText: () => {
    throw new MarketPackError("Australia disclosure copy is not written yet");
  },
};
