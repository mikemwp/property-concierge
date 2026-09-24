import type { ActorRole, EntryContext } from "../types";
import {
  isModuleEnabled,
  type MarketFlags,
  type StagePlaybook,
  type StageTemplate,
} from "./types";

export const CORRIDOR_INTENT_EVIDENCE = "corridor_intent";
export const CORRIDOR_DEPARTURE_EVIDENCE = "departure_plan";
export const CORRIDOR_VISA_EVIDENCE = "visa_status";

export type CorridorPlaybookCopy = {
  originName: string;
  destinationName: string;
  currencyPair: string;
  visaLabel: string;
};

export function corridorProfileEvidence(flags: MarketFlags): string[] {
  const kinds = ["profile_complete"];
  if (
    isModuleEnabled(flags, "corridor_inbound") ||
    isModuleEnabled(flags, "corridor_outbound")
  ) {
    kinds.push(CORRIDOR_INTENT_EVIDENCE);
  }
  return kinds;
}

export function corridorMoneyEvidence(
  _entry: EntryContext,
  flags: MarketFlags,
): string[] {
  const kinds = ["source_of_funds"];
  if (isModuleEnabled(flags, "fx_deposit")) {
    kinds.push("fx_plan");
  }
  return kinds;
}

export function corridorMoveEvidence(
  entry: EntryContext,
  flags: MarketFlags,
): string[] {
  const kinds = ["move_quote"];
  if (isModuleEnabled(flags, "corridor_outbound")) {
    kinds.push(CORRIDOR_DEPARTURE_EVIDENCE);
    if (entry === "RETURNER_OVERSEAS") {
      kinds.push("vehicle_path");
    }
  }
  if (isModuleEnabled(flags, "corridor_inbound") && entry !== "UK_RESIDENT_SPEED") {
    kinds.push(CORRIDOR_VISA_EVIDENCE);
  }
  return kinds;
}

export function applyCorridorEvidence(
  stages: StageTemplate[],
  entry: EntryContext,
  flags: MarketFlags,
): StageTemplate[] {
  return stages.map((stage) => {
    if (stage.key === "purchase_profile") {
      return { ...stage, requiredEvidenceKinds: corridorProfileEvidence(flags) };
    }
    if (stage.key === "money_readiness") {
      return { ...stage, requiredEvidenceKinds: corridorMoneyEvidence(entry, flags) };
    }
    if (stage.key === "move_logistics") {
      return { ...stage, requiredEvidenceKinds: corridorMoveEvidence(entry, flags) };
    }
    return stage;
  });
}

function evidenceLine(
  kind: string,
  fallback: Record<string, string>,
  existing: string[],
): string {
  const fromExisting = existing.find((line) => line.startsWith(`${kind}:`));
  if (fromExisting) {
    return fromExisting;
  }
  const fromFallback = fallback[kind];
  if (!fromFallback) {
    throw new Error(`Missing corridor playbook evidence copy for ${kind}`);
  }
  return fromFallback;
}

function overlayProfilePlaybook(
  playbook: StagePlaybook,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook {
  const kinds = corridorProfileEvidence(flags);
  const extra: Array<{ day: number; owner: ActorRole; action: string }> = [];
  if (kinds.includes(CORRIDOR_INTENT_EVIDENCE)) {
    extra.push({
      day: 1,
      owner: "ADVISOR",
      action: `Record corridor_intent: the household is moving from ${copy.originName} to buy in ${copy.destinationName}, and name every person who will be on title.`,
    });
  }
  return {
    ...playbook,
    objective: `Lock household constraints for a ${copy.originName} → ${copy.destinationName} purchase: arrival window, target region, budget band, and who signs.`,
    actions: [...playbook.actions, ...extra],
    evidenceStandard: kinds.map((kind) =>
      evidenceLine(
        kind,
        {
          profile_complete:
            "profile_complete: target region named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
          corridor_intent: `corridor_intent: origin ${copy.originName}, destination ${copy.destinationName}, and the legal buyers named.`,
        },
        playbook.evidenceStandard,
      ),
    ),
  };
}

function overlayMoneyPlaybook(
  playbook: StagePlaybook,
  entry: EntryContext,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook {
  const kinds = corridorMoneyEvidence(entry, flags);
  const hasFxAction = playbook.actions.some((action) => /fx|transfer|currency/i.test(action.action));
  const extra: Array<{ day: number; owner: ActorRole; action: string }> = [];
  if (kinds.includes("fx_plan") && !hasFxAction) {
    extra.push({
      day: 2,
      owner: "ADVISOR",
      action: `Agree the FX plan for ${copy.currencyPair}: named transfer route, target settlement date, and the latest date funds must sit in a destination-currency account. The rate is not fixed by us.`,
    });
  }
  return {
    ...playbook,
    actions: [...playbook.actions, ...extra],
    evidenceStandard: kinds.map((kind) =>
      evidenceLine(
        kind,
        {
          source_of_funds:
            "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every large deposit explained.",
          fx_plan: `fx_plan: ${copy.currencyPair} transfer route named, target settlement date set, and the client understands the rate is not fixed by us.`,
        },
        playbook.evidenceStandard,
      ),
    ),
  };
}

function overlayMovePlaybook(
  playbook: StagePlaybook,
  entry: EntryContext,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook {
  const kinds = corridorMoveEvidence(entry, flags);
  const extra: Array<{ day: number; owner: ActorRole; action: string }> = [];
  if (kinds.includes(CORRIDOR_DEPARTURE_EVIDENCE)) {
    extra.push({
      day: 4,
      owner: "ADVISOR",
      action: `Submit departure_plan: what leaves ${copy.originName}, what is sold or stored, and the earliest and latest acceptable arrival dates in ${copy.destinationName}.`,
    });
  }
  if (kinds.includes("vehicle_path")) {
    extra.push({
      day: 4,
      owner: "ADVISOR",
      action:
        "Decide the vehicle path: ship, sell, or leave — and list the registration steps needed on arrival.",
    });
  }
  if (kinds.includes(CORRIDOR_VISA_EVIDENCE)) {
    extra.push({
      day: 5,
      owner: "ADVISOR",
      action: `Record visa_status: ${copy.visaLabel} for every adult buyer, including what is proven and what is still in progress.`,
    });
  }
  return {
    ...playbook,
    actions: [...playbook.actions, ...extra],
    evidenceStandard: kinds.map((kind) =>
      evidenceLine(
        kind,
        {
          move_quote:
            "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
          departure_plan: `departure_plan: goods that leave ${copy.originName}, goods sold or stored, and dated arrival window in ${copy.destinationName}.`,
          vehicle_path:
            "vehicle_path: decision recorded for each vehicle — ship, sell, or leave — with the registration steps listed.",
          visa_status: `visa_status: ${copy.visaLabel} recorded for every adult buyer, with outstanding applications named.`,
        },
        playbook.evidenceStandard,
      ),
    ),
  };
}

export function withCorridorPlaybookOverlay(
  playbooks: StagePlaybook[],
  entry: EntryContext,
  flags: MarketFlags,
  copy: CorridorPlaybookCopy,
): StagePlaybook[] {
  return playbooks.map((playbook) => {
    if (playbook.stageKey === "purchase_profile") {
      return overlayProfilePlaybook(playbook, flags, copy);
    }
    if (playbook.stageKey === "money_readiness") {
      return overlayMoneyPlaybook(playbook, entry, flags, copy);
    }
    if (playbook.stageKey === "move_logistics") {
      return overlayMovePlaybook(playbook, entry, flags, copy);
    }
    return playbook;
  });
}
