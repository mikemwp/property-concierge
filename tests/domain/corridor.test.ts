import { describe, it, expect } from "vitest";
import type { StagePlaybook, StageTemplate } from "../../src/domain/market-packs/types";
import {
  applyCorridorEvidence,
  CORRIDOR_DEPARTURE_EVIDENCE,
  CORRIDOR_INTENT_EVIDENCE,
  CORRIDOR_VISA_EVIDENCE,
  corridorMoneyEvidence,
  corridorMoveEvidence,
  corridorProfileEvidence,
  withCorridorPlaybookOverlay,
  type CorridorPlaybookCopy,
} from "../../src/domain/market-packs/corridor";

const CORRIDOR_ON = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
} as const;

const COPY: CorridorPlaybookCopy = {
  originName: "Originland",
  destinationName: "Destinationland",
  currencyPair: "AAA to BBB",
  visaLabel: "destination visa or right-to-reside",
};

function spine(): StageTemplate[] {
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
      key: "move_logistics",
      title: "Move logistics",
      defaultOwnerRole: "MOVE_PARTNER",
      slaDays: 10,
      requiredEvidenceKinds: ["move_quote"],
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
  ];
}

function playbooks(): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective: "Lock household constraints.",
      actions: [
        { day: 0, owner: "ADVISOR", action: "Run the profile call." },
        { day: 1, owner: "ADVISOR", action: "Write the budget band." },
      ],
      evidenceStandard: ["profile_complete: region, budget, decision-makers."],
      escalation: ["Day 3: call, do not email."],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective: "Prove the deposit.",
      actions: [
        { day: 0, owner: "ADVISOR", action: "Issue the source-of-funds list." },
        { day: 5, owner: "ADVISOR", action: "Review the pack." },
      ],
      evidenceStandard: ["source_of_funds: full-page statements."],
      escalation: ["Day 7: name the missing document."],
      partnerScript: null,
    },
    {
      stageKey: "move_logistics",
      objective: "Book the move.",
      actions: [
        { day: 0, owner: "ADVISOR", action: "Brief the move partner." },
        { day: 3, owner: "MOVE_PARTNER", action: "Return a written quote." },
      ],
      evidenceStandard: ["move_quote: written quote with a validity date."],
      escalation: ["Day 10: chase the partner."],
      partnerScript: null,
    },
  ];
}

describe("corridor evidence helpers", () => {
  it("adds corridor_intent only when a corridor flag is on", () => {
    expect(corridorProfileEvidence({})).toEqual(["profile_complete"]);
    expect(corridorProfileEvidence(CORRIDOR_ON)).toEqual([
      "profile_complete",
      CORRIDOR_INTENT_EVIDENCE,
    ]);
    expect(corridorProfileEvidence({ corridor_inbound: true })).toContain(
      CORRIDOR_INTENT_EVIDENCE,
    );
    expect(corridorProfileEvidence({ corridor_outbound: true })).toContain(
      CORRIDOR_INTENT_EVIDENCE,
    );
  });

  it("always requires fx_plan when fx_deposit is on, including UK_RESIDENT_SPEED", () => {
    expect(corridorMoneyEvidence("UK_RESIDENT_SPEED", CORRIDOR_ON)).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(corridorMoneyEvidence("RETURNER_OVERSEAS", CORRIDOR_ON)).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);
    expect(corridorMoneyEvidence("RETURNER_OVERSEAS", {})).toEqual(["source_of_funds"]);
    expect(corridorMoneyEvidence("RETURNER_IN_UK", { fx_deposit: false })).toEqual([
      "source_of_funds",
    ]);
  });

  it("requires departure_plan on outbound packs and visa_status unless the household is a UK-resident speed-seeker", () => {
    expect(corridorMoveEvidence("RETURNER_OVERSEAS", CORRIDOR_ON)).toEqual([
      "move_quote",
      CORRIDOR_DEPARTURE_EVIDENCE,
      "vehicle_path",
      CORRIDOR_VISA_EVIDENCE,
    ]);
    expect(corridorMoveEvidence("RETURNER_IN_UK", CORRIDOR_ON)).toEqual([
      "move_quote",
      CORRIDOR_DEPARTURE_EVIDENCE,
      CORRIDOR_VISA_EVIDENCE,
    ]);
    expect(corridorMoveEvidence("UK_RESIDENT_SPEED", CORRIDOR_ON)).toEqual([
      "move_quote",
      CORRIDOR_DEPARTURE_EVIDENCE,
    ]);
    expect(corridorMoveEvidence("RETURNER_OVERSEAS", {})).toEqual(["move_quote"]);
  });
});

describe("applyCorridorEvidence", () => {
  it("rewrites only profile, money and move stages and leaves the legal spine untouched", () => {
    const next = applyCorridorEvidence(spine(), "RETURNER_OVERSEAS", CORRIDOR_ON);
    expect(next.map((s) => s.key)).toEqual([
      "purchase_profile",
      "money_readiness",
      "move_logistics",
      "offer_instruct",
    ]);
    expect(next[0]?.requiredEvidenceKinds).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);
    expect(next[1]?.requiredEvidenceKinds).toEqual(["source_of_funds", "fx_plan"]);
    expect(next[2]?.requiredEvidenceKinds).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
    expect(next[3]?.requiredEvidenceKinds).toEqual(["conveyancer_instructed"]);
  });
});

describe("withCorridorPlaybookOverlay", () => {
  it("injects corridor-specific actions and aligns evidenceStandard prefixes with required kinds", () => {
    const overlaid = withCorridorPlaybookOverlay(
      playbooks(),
      "RETURNER_OVERSEAS",
      CORRIDOR_ON,
      COPY,
    );
    const profile = overlaid.find((p) => p.stageKey === "purchase_profile");
    expect(profile?.objective).toMatch(/Originland/);
    expect(profile?.objective).toMatch(/Destinationland/);
    expect(profile?.actions.some((a) => /corridor_intent/i.test(a.action))).toBe(true);
    expect(profile?.evidenceStandard.map((line) => line.split(":")[0])).toEqual([
      "profile_complete",
      "corridor_intent",
    ]);

    const money = overlaid.find((p) => p.stageKey === "money_readiness");
    expect(money?.actions.some((a) => /AAA to BBB/i.test(a.action))).toBe(true);
    expect(money?.evidenceStandard.map((line) => line.split(":")[0])).toEqual([
      "source_of_funds",
      "fx_plan",
    ]);

    const move = overlaid.find((p) => p.stageKey === "move_logistics");
    expect(move?.actions.some((a) => /departure_plan/i.test(a.action))).toBe(true);
    expect(move?.actions.some((a) => /destination visa or right-to-reside/i.test(a.action))).toBe(
      true,
    );
    expect(move?.evidenceStandard.map((line) => line.split(":")[0])).toEqual([
      "move_quote",
      "departure_plan",
      "vehicle_path",
      "visa_status",
    ]);
  });

  it("does not invent seller introductions or completion-date guarantees", () => {
    const blob = JSON.stringify(
      withCorridorPlaybookOverlay(playbooks(), "RETURNER_OVERSEAS", CORRIDOR_ON, COPY),
    );
    expect(blob).not.toMatch(/introduc(?:e|tion).{0,60}seller/i);
    expect(blob).not.toMatch(/private listing/i);
    expect(blob).not.toMatch(/guaranteed completion/i);
  });
});
