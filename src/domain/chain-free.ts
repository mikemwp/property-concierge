import { getFocusStage, type CaseState } from "./stage-engine";
import type { ScorecardRating } from "./scorecard";
import { isPartnerActorRole, type ActorRole } from "./types";

export const CHAIN_FREE_STATUSES = [
  "NOT_ASSESSED",
  "IN_PROGRESS",
  "CERTIFIED",
  "INELIGIBLE",
] as const;

export type ChainFreeStatus = (typeof CHAIN_FREE_STATUSES)[number];

export function isChainFreeStatus(value: string): value is ChainFreeStatus {
  return (CHAIN_FREE_STATUSES as readonly string[]).includes(value);
}

export const CHAIN_FREE_CRITERION_KEYS = [
  "paid_tier",
  "partner_participation",
  "evidence_complete",
] as const;

export type ChainFreeCriterionKey = (typeof CHAIN_FREE_CRITERION_KEYS)[number];

export const CHAIN_FREE_REQUIRED_EVIDENCE = [
  "source_of_funds",
  "dip_aip",
  "buyer_ready",
] as const;

export const CHAIN_FREE_EVENT_TYPES = [
  "CHAIN_FREE_CERTIFIED",
  "CHAIN_FREE_MARKED_INELIGIBLE",
  "CHAIN_FREE_RESET",
] as const;

export const CHAIN_FREE_OVERRIDE_ACTIONS = ["CERTIFY", "INELIGIBLE", "RESET"] as const;

export type ChainFreeOverrideAction = (typeof CHAIN_FREE_OVERRIDE_ACTIONS)[number];

export const MIN_CHAIN_FREE_REASON_LENGTH = 8;

export type PartnerParticipationSignal = {
  partnerId: string;
  roleType: ActorRole;
  hasReferral: boolean;
  participatedOnCase: boolean;
  scorecardRating: ScorecardRating;
  participationRate: number;
};

export type ChainFreeCriterion = {
  key: ChainFreeCriterionKey;
  label: string;
  met: boolean;
};

export type ChainFreeOverride = {
  action: ChainFreeOverrideAction;
  reason: string;
  at: string;
};

export type ChainFreeEventPayload = {
  action: ChainFreeOverrideAction;
  reason: string;
};

export type ChainFreeCertification = {
  status: ChainFreeStatus;
  criteria: ChainFreeCriterion[];
  eligibleByRules: boolean;
  override: ChainFreeOverride | null;
  moduleEnabled: boolean;
};

export type ClientCertificationCopy = {
  status: "CERTIFIED" | "IN_PROGRESS";
  headline: string;
  body: string;
};

export type AdvisorCertificationView = {
  status: ChainFreeStatus;
  criteria: ChainFreeCriterion[];
  override: ChainFreeOverride | null;
  canCertify: boolean;
  canMarkIneligible: boolean;
  canReset: boolean;
};

export class ChainFreeError extends Error {
  constructor(
    public code:
      | "MODULE_OFF"
      | "NOT_ELIGIBLE"
      | "REASON_REQUIRED"
      | "FORBIDDEN_ROLE"
      | "NOTHING_TO_RESET"
      | "ALREADY_CERTIFIED"
      | "ALREADY_INELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "ChainFreeError";
  }
}

const CRITERION_LABELS: Record<ChainFreeCriterionKey, string> = {
  paid_tier: "Paid orchestration tier",
  partner_participation: "Partner participation or scorecard signal",
  evidence_complete: "Required evidence accepted on the ledger",
};

const EVENT_TYPE_FOR_ACTION: Record<
  Exclude<ChainFreeOverrideAction, "RESET">,
  (typeof CHAIN_FREE_EVENT_TYPES)[number]
> = {
  CERTIFY: "CHAIN_FREE_CERTIFIED",
  INELIGIBLE: "CHAIN_FREE_MARKED_INELIGIBLE",
};

export function encodeChainFreePayload(payload: ChainFreeEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeChainFreePayload(
  payload: string | undefined,
): ChainFreeEventPayload | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "action" in parsed &&
      "reason" in parsed &&
      typeof (parsed as ChainFreeEventPayload).action === "string" &&
      typeof (parsed as ChainFreeEventPayload).reason === "string"
    ) {
      return parsed as ChainFreeEventPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function acceptedEvidenceKinds(caseState: CaseState): string[] {
  const kinds = new Set<string>();
  for (const stage of caseState.stages) {
    for (const kind of stage.acceptedEvidenceKinds) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}

export function partnerParticipationMet(signals: PartnerParticipationSignal[]): boolean {
  return signals.some(
    (signal) =>
      signal.hasReferral &&
      isPartnerActorRole(signal.roleType) &&
      (signal.participatedOnCase ||
        signal.scorecardRating === "STRONG" ||
        signal.scorecardRating === "WATCH" ||
        signal.participationRate >= 0.5),
  );
}

export function evaluateCriteria(input: {
  caseState: CaseState;
  partnerSignals: PartnerParticipationSignal[];
}): ChainFreeCriterion[] {
  const accepted = acceptedEvidenceKinds(input.caseState);
  const evidenceMet = CHAIN_FREE_REQUIRED_EVIDENCE.every((kind) => accepted.includes(kind));

  return CHAIN_FREE_CRITERION_KEYS.map((key) => {
    let met = false;
    if (key === "paid_tier") {
      met = input.caseState.tier === "PAID_DWY";
    } else if (key === "partner_participation") {
      met = partnerParticipationMet(input.partnerSignals);
    } else if (key === "evidence_complete") {
      met = evidenceMet;
    }
    return { key, label: CRITERION_LABELS[key], met };
  });
}

export function partnerSignalsFrom(input: {
  caseState: CaseState;
  referrals: Array<{
    partnerId: string;
    partnerRole: ActorRole;
    supersededAt: string | null;
  }>;
  scorecards: Array<{
    partnerId: string;
    rating: ScorecardRating;
    participationRate: number;
  }>;
}): PartnerParticipationSignal[] {
  const activeReferrals = input.referrals.filter(
    (referral) => referral.supersededAt === null && isPartnerActorRole(referral.partnerRole),
  );

  return activeReferrals.map((referral) => {
    const scorecard = input.scorecards.find((row) => row.partnerId === referral.partnerId);
    const participatedOnCase = input.caseState.events.some(
      (event) =>
        event.type === "EVIDENCE_SUBMITTED" && event.actorRole === referral.partnerRole,
    );
    return {
      partnerId: referral.partnerId,
      roleType: referral.partnerRole,
      hasReferral: true,
      participatedOnCase,
      scorecardRating: scorecard?.rating ?? "NO_DATA",
      participationRate: scorecard?.participationRate ?? 0,
    };
  });
}

function resolveOverrideFromEvents(
  caseState: CaseState,
): { override: ChainFreeOverride | null; statusFromOverride: ChainFreeStatus | null } {
  for (let i = caseState.events.length - 1; i >= 0; i--) {
    const event = caseState.events[i];
    if (!(CHAIN_FREE_EVENT_TYPES as readonly string[]).includes(event.type)) {
      continue;
    }
    const payload = decodeChainFreePayload(event.payload);
    if (!payload) {
      continue;
    }
    if (event.type === "CHAIN_FREE_RESET") {
      return { override: null, statusFromOverride: null };
    }
    if (event.type === "CHAIN_FREE_CERTIFIED") {
      return {
        override: { action: "CERTIFY", reason: payload.reason, at: event.at },
        statusFromOverride: "CERTIFIED",
      };
    }
    if (event.type === "CHAIN_FREE_MARKED_INELIGIBLE") {
      return {
        override: { action: "INELIGIBLE", reason: payload.reason, at: event.at },
        statusFromOverride: "INELIGIBLE",
      };
    }
  }
  return { override: null, statusFromOverride: null };
}

export function assessCertification(input: {
  caseState: CaseState;
  moduleEnabled: boolean;
  partnerSignals: PartnerParticipationSignal[];
}): ChainFreeCertification {
  const criteria = evaluateCriteria({
    caseState: input.caseState,
    partnerSignals: input.partnerSignals,
  });
  const allMet = criteria.every((criterion) => criterion.met);

  if (!input.moduleEnabled) {
    return {
      status: "NOT_ASSESSED",
      criteria,
      eligibleByRules: false,
      override: null,
      moduleEnabled: false,
    };
  }

  const { override, statusFromOverride } = resolveOverrideFromEvents(input.caseState);

  if (statusFromOverride) {
    return {
      status: statusFromOverride,
      criteria,
      eligibleByRules: allMet,
      override,
      moduleEnabled: true,
    };
  }

  const paidTierMet = criteria.find((c) => c.key === "paid_tier")?.met ?? false;
  const status: ChainFreeStatus = paidTierMet ? "IN_PROGRESS" : "NOT_ASSESSED";

  return {
    status,
    criteria,
    eligibleByRules: allMet,
    override: null,
    moduleEnabled: true,
  };
}

export function applyCertificationOverride(
  caseState: CaseState,
  input: {
    action: ChainFreeOverrideAction;
    reason: string;
    actorRole: ActorRole;
    now?: Date;
    moduleEnabled: boolean;
    partnerSignals: PartnerParticipationSignal[];
  },
): CaseState {
  if (input.actorRole !== "ADVISOR") {
    throw new ChainFreeError(
      "FORBIDDEN_ROLE",
      "Only an advisor may override chain-free certification",
    );
  }

  const trimmed = input.reason.trim();
  if (trimmed.length < MIN_CHAIN_FREE_REASON_LENGTH) {
    throw new ChainFreeError(
      "REASON_REQUIRED",
      "A reason of at least 8 characters is required",
    );
  }

  if (!input.moduleEnabled) {
    throw new ChainFreeError("MODULE_OFF", "Chain-free overlay is not enabled for this case");
  }

  const current = assessCertification({
    caseState,
    moduleEnabled: input.moduleEnabled,
    partnerSignals: input.partnerSignals,
  });

  if (input.action === "CERTIFY") {
    if (!current.eligibleByRules) {
      throw new ChainFreeError(
        "NOT_ELIGIBLE",
        "Every certification criterion must be met before certifying",
      );
    }
    if (current.status === "CERTIFIED") {
      throw new ChainFreeError("ALREADY_CERTIFIED", "Case is already certified chain-free");
    }
  }

  if (input.action === "INELIGIBLE" && current.status === "INELIGIBLE") {
    throw new ChainFreeError("ALREADY_INELIGIBLE", "Case is already marked ineligible");
  }

  if (input.action === "RESET") {
    if (current.override === null) {
      throw new ChainFreeError("NOTHING_TO_RESET", "No certification override to reset");
    }
  }

  const now = (input.now ?? new Date()).toISOString();
  const focus = getFocusStage(caseState);
  const stageKey = focus?.key ?? caseState.stages[0]?.key ?? "unknown";

  let eventType: (typeof CHAIN_FREE_EVENT_TYPES)[number];
  if (input.action === "RESET") {
    eventType = "CHAIN_FREE_RESET";
  } else {
    eventType = EVENT_TYPE_FOR_ACTION[input.action];
  }

  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: eventType,
        stageKey,
        actorRole: input.actorRole,
        at: now,
        payload: encodeChainFreePayload({ action: input.action, reason: trimmed }),
      },
    ],
  };
}

export function clientCertificationCopy(
  cert: ChainFreeCertification,
): ClientCertificationCopy | null {
  if (!cert.moduleEnabled) {
    return null;
  }
  if (cert.status !== "CERTIFIED" && cert.status !== "IN_PROGRESS") {
    return null;
  }

  if (cert.status === "CERTIFIED") {
    return {
      status: "CERTIFIED",
      headline: "Certified chain-free buyer",
      body: "Your household has been certified as chain-free from the stage ledger. This status is not a completion date.",
    };
  }

  return {
    status: "IN_PROGRESS",
    headline: "Chain-free certification in progress",
    body: "Your advisor is working through the chain-free certification criteria. This status is not a completion date.",
  };
}

export function advisorCertificationView(cert: ChainFreeCertification): AdvisorCertificationView {
  return {
    status: cert.status,
    criteria: cert.criteria,
    override: cert.override,
    canCertify: cert.moduleEnabled && cert.eligibleByRules && cert.status !== "CERTIFIED",
    canMarkIneligible: cert.moduleEnabled && cert.status !== "INELIGIBLE",
    canReset: cert.moduleEnabled && cert.override !== null,
  };
}
