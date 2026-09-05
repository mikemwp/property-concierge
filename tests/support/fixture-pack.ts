import type { MarketPack, StageTemplate } from "../../src/domain/market-packs/types";
import type { EntryContext } from "../../src/domain/types";

/** A non-UK pack used only by tests: proves the pack-parametric helpers carry no E&W assumption. */
export function makeFixturePack(overrides: Partial<MarketPack> = {}): MarketPack {
  return {
    id: "zz",
    name: "Testland",
    jurisdiction: "testland",
    enabled: true,
    locale: {
      bcp47: "en-AU",
      currencyCode: "AUD",
      addressFieldKeys: ["line1", "suburb", "state", "postcode"],
      regionNoun: "state",
    },
    flags: { corridor_inbound: true },
    copy: {
      jurisdiction_scope: "Testland only.",
      mortgage_posture: "Introducer only in Testland.",
      region_prompt: "Which state are you buying in?",
      directory_intro: "Our Testland panel.",
    },
    partnerRoleLabels: {
      CLIENT: "household",
      ADVISOR: "advisor",
      MORTGAGE_PARTNER: "loan broker",
      CONVEYANCER: "settlement agent",
      MOVE_PARTNER: "removalist",
    },
    buildStages: (entry: EntryContext): StageTemplate[] => [
      {
        key: "local_profile",
        title: "Local profile",
        defaultOwnerRole: "CLIENT",
        slaDays: 2,
        requiredEvidenceKinds: ["profile_complete"],
        freeVisible: true,
        freeCanSelfAdvance: true,
      },
      {
        key: "local_settlement",
        title: "Local settlement",
        defaultOwnerRole: "CONVEYANCER",
        slaDays: 11,
        requiredEvidenceKinds:
          entry === "UK_RESIDENT_SPEED"
            ? ["settlement_booked"]
            : ["settlement_booked", "transfer_plan"],
        freeVisible: false,
        freeCanSelfAdvance: false,
      },
    ],
    buildPlaybooks: (entry: EntryContext) => [
      {
        stageKey: "local_profile",
        objective: "Fixture objective for local_profile.",
        actions: [{ day: 0, owner: "ADVISOR" as const, action: "Fixture action." }],
        evidenceStandard: ["profile_complete: fixture standard."],
        escalation: [`Day 2: fixture escalation (${entry}).`],
        partnerScript: null,
      },
    ],
    disclosureText: ({ partnerName }) => `Testland disclosure for ${partnerName}.`,
    partnerMilestones: (role) =>
      role === "CONVEYANCER"
        ? [{ key: "settlement_lodged", label: "Settlement lodged", role }]
        : [],
    ...overrides,
  };
}
