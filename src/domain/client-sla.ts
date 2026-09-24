import { getFocusStage, type CaseState } from "./stage-engine";
import type { ScorecardRating } from "./scorecard";
import { isPartnerActorRole, type ActorRole } from "./types";

export const CLIENT_SLA_STATUSES = [
  "UNPUBLISHED",
  "PUBLISHED",
  "AMENDED",
  "WITHDRAWN",
] as const;

export type ClientSlaStatus = (typeof CLIENT_SLA_STATUSES)[number];

export function isClientSlaStatus(value: string): value is ClientSlaStatus {
  return (CLIENT_SLA_STATUSES as readonly string[]).includes(value);
}

export const CLIENT_SLA_CRITERION_KEYS = [
  "paid_tier",
  "partner_scorecard",
  "ledger_started",
] as const;

export type ClientSlaCriterionKey = (typeof CLIENT_SLA_CRITERION_KEYS)[number];

export const CLIENT_SLA_CARVE_OUT_KEYS = [
  "lender_delay",
  "survey_defects",
  "title_pack_delay",
  "client_inaction",
  "outside_pipeline",
] as const;

export type ClientSlaCarveOutKey = (typeof CLIENT_SLA_CARVE_OUT_KEYS)[number];

export type ClientSlaCarveOut = {
  key: ClientSlaCarveOutKey;
  label: string;
};

export const CLIENT_SLA_CARVE_OUTS: ClientSlaCarveOut[] = [
  { key: "lender_delay", label: "Lender or finance-provider delay" },
  { key: "survey_defects", label: "Survey or inspection defects" },
  { key: "title_pack_delay", label: "Title or tenure document pack delay" },
  { key: "client_inaction", label: "Client inaction or late evidence" },
  { key: "outside_pipeline", label: "Events outside the orchestrated pipeline" },
];

export const CLIENT_SLA_EVENT_TYPES = [
  "CLIENT_SLA_PUBLISHED",
  "CLIENT_SLA_AMENDED",
  "CLIENT_SLA_WITHDRAWN",
] as const;

export const CLIENT_SLA_ACTIONS = ["PUBLISH", "AMEND", "WITHDRAW"] as const;

export type ClientSlaAction = (typeof CLIENT_SLA_ACTIONS)[number];

export const MIN_CLIENT_SLA_REASON_LENGTH = 8;

export type SlaScorecardSignal = {
  partnerId: string;
  roleType: ActorRole;
  hasReferral: boolean;
  scorecardRating: ScorecardRating;
  participationRate: number;
};

export type ClientSlaCriterion = {
  key: ClientSlaCriterionKey;
  label: string;
  met: boolean;
};

export type ClientSlaPublication = {
  action: ClientSlaAction;
  targetDate: string | null;
  reason: string;
  at: string;
};

export type ClientSlaEventPayload = {
  action: ClientSlaAction;
  targetDate: string | null;
  reason: string;
};

export type ClientSlaCommitment = {
  status: ClientSlaStatus;
  criteria: ClientSlaCriterion[];
  eligibleByRules: boolean;
  publication: ClientSlaPublication | null;
  carveOuts: ClientSlaCarveOut[];
  moduleEnabled: boolean;
};

export type ClientSlaTargetCopy = {
  status: "PUBLISHED" | "AMENDED";
  headline: string;
  body: string;
  targetDate: string;
  carveOuts: ClientSlaCarveOut[];
};

export type AdvisorSlaView = {
  status: ClientSlaStatus;
  criteria: ClientSlaCriterion[];
  publication: ClientSlaPublication | null;
  carveOuts: ClientSlaCarveOut[];
  canPublish: boolean;
  canAmend: boolean;
  canWithdraw: boolean;
};

export class ClientSlaError extends Error {
  constructor(
    public code:
      | "MODULE_OFF"
      | "NOT_ELIGIBLE"
      | "REASON_REQUIRED"
      | "FORBIDDEN_ROLE"
      | "INVALID_TARGET_DATE"
      | "ALREADY_PUBLISHED"
      | "NOTHING_TO_AMEND"
      | "NOTHING_TO_WITHDRAW"
      | "ALREADY_WITHDRAWN",
    message: string,
  ) {
    super(message);
    this.name = "ClientSlaError";
  }
}

const CRITERION_LABELS: Record<ClientSlaCriterionKey, string> = {
  paid_tier: "Paid orchestration tier",
  partner_scorecard: "Partner scorecard or participation signal",
  ledger_started: "Accepted evidence on the stage ledger",
};

const EVENT_TYPE_FOR_ACTION: Record<
  ClientSlaAction,
  (typeof CLIENT_SLA_EVENT_TYPES)[number]
> = {
  PUBLISH: "CLIENT_SLA_PUBLISHED",
  AMEND: "CLIENT_SLA_AMENDED",
  WITHDRAW: "CLIENT_SLA_WITHDRAWN",
};

export function encodeClientSlaPayload(payload: ClientSlaEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeClientSlaPayload(
  payload: string | undefined,
): ClientSlaEventPayload | null {
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
      typeof (parsed as ClientSlaEventPayload).action === "string" &&
      typeof (parsed as ClientSlaEventPayload).reason === "string" &&
      ((parsed as ClientSlaEventPayload).targetDate === null ||
        typeof (parsed as ClientSlaEventPayload).targetDate === "string")
    ) {
      return parsed as ClientSlaEventPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
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

export function partnerSlaMet(signals: SlaScorecardSignal[]): boolean {
  return signals.some(
    (signal) =>
      signal.hasReferral &&
      isPartnerActorRole(signal.roleType) &&
      (signal.scorecardRating === "STRONG" ||
        signal.scorecardRating === "WATCH" ||
        signal.participationRate >= 0.5),
  );
}

export function evaluateSlaCriteria(input: {
  caseState: CaseState;
  partnerSignals: SlaScorecardSignal[];
}): ClientSlaCriterion[] {
  return CLIENT_SLA_CRITERION_KEYS.map((key) => {
    let met = false;
    if (key === "paid_tier") {
      met = input.caseState.tier === "PAID_DWY";
    } else if (key === "partner_scorecard") {
      met = partnerSlaMet(input.partnerSignals);
    } else if (key === "ledger_started") {
      met = acceptedEvidenceKinds(input.caseState).length > 0;
    }
    return { key, label: CRITERION_LABELS[key], met };
  });
}

export function slaSignalsFrom(input: {
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
}): SlaScorecardSignal[] {
  const activeReferrals = input.referrals.filter(
    (referral) => referral.supersededAt === null && isPartnerActorRole(referral.partnerRole),
  );

  return activeReferrals.map((referral) => {
    const scorecard = input.scorecards.find((row) => row.partnerId === referral.partnerId);
    return {
      partnerId: referral.partnerId,
      roleType: referral.partnerRole,
      hasReferral: true,
      scorecardRating: scorecard?.rating ?? "NO_DATA",
      participationRate: scorecard?.participationRate ?? 0,
    };
  });
}

function resolvePublication(caseState: CaseState): ClientSlaPublication | null {
  for (let i = caseState.events.length - 1; i >= 0; i--) {
    const event = caseState.events[i];
    if (!(CLIENT_SLA_EVENT_TYPES as readonly string[]).includes(event.type)) {
      continue;
    }
    const payload = decodeClientSlaPayload(event.payload);
    if (!payload) {
      continue;
    }
    return {
      action: payload.action,
      targetDate: payload.targetDate,
      reason: payload.reason,
      at: event.at,
    };
  }
  return null;
}

function statusFromPublication(publication: ClientSlaPublication | null): ClientSlaStatus {
  if (!publication) {
    return "UNPUBLISHED";
  }
  if (publication.action === "PUBLISH") {
    return "PUBLISHED";
  }
  if (publication.action === "AMEND") {
    return "AMENDED";
  }
  return "WITHDRAWN";
}

export function assessClientSla(input: {
  caseState: CaseState;
  moduleEnabled: boolean;
  partnerSignals: SlaScorecardSignal[];
}): ClientSlaCommitment {
  const criteria = evaluateSlaCriteria({
    caseState: input.caseState,
    partnerSignals: input.partnerSignals,
  });
  const allMet = criteria.every((criterion) => criterion.met);

  if (!input.moduleEnabled) {
    return {
      status: "UNPUBLISHED",
      criteria,
      eligibleByRules: false,
      publication: null,
      carveOuts: CLIENT_SLA_CARVE_OUTS,
      moduleEnabled: false,
    };
  }

  return {
    status: statusFromPublication(resolvePublication(input.caseState)),
    criteria,
    eligibleByRules: allMet,
    publication: resolvePublication(input.caseState),
    carveOuts: CLIENT_SLA_CARVE_OUTS,
    moduleEnabled: true,
  };
}

function assertTargetDate(targetDate: string | null, now: Date): string {
  if (!targetDate || !isIsoCalendarDate(targetDate)) {
    throw new ClientSlaError(
      "INVALID_TARGET_DATE",
      "A calendar target date (YYYY-MM-DD) is required",
    );
  }
  if (targetDate < todayIso(now)) {
    throw new ClientSlaError(
      "INVALID_TARGET_DATE",
      "Target date must be on or after today",
    );
  }
  return targetDate;
}

export function applyClientSlaAction(
  caseState: CaseState,
  input: {
    action: ClientSlaAction;
    targetDate: string | null;
    reason: string;
    actorRole: ActorRole;
    now?: Date;
    moduleEnabled: boolean;
    partnerSignals: SlaScorecardSignal[];
  },
): CaseState {
  if (input.actorRole !== "ADVISOR") {
    throw new ClientSlaError(
      "FORBIDDEN_ROLE",
      "Only an advisor may publish, amend, or withdraw a client SLA target",
    );
  }

  const trimmed = input.reason.trim();
  if (trimmed.length < MIN_CLIENT_SLA_REASON_LENGTH) {
    throw new ClientSlaError(
      "REASON_REQUIRED",
      "A reason of at least 8 characters is required",
    );
  }

  if (!input.moduleEnabled) {
    throw new ClientSlaError("MODULE_OFF", "Client SLA overlay is not enabled for this case");
  }

  const now = input.now ?? new Date();
  const current = assessClientSla({
    caseState,
    moduleEnabled: input.moduleEnabled,
    partnerSignals: input.partnerSignals,
  });
  const live = current.status === "PUBLISHED" || current.status === "AMENDED";

  let storedDate: string | null = null;
  if (input.action === "PUBLISH") {
    if (!current.eligibleByRules) {
      throw new ClientSlaError(
        "NOT_ELIGIBLE",
        "Not eligible: every SLA criterion must be met before publishing a target",
      );
    }
    if (live) {
      throw new ClientSlaError(
        "ALREADY_PUBLISHED",
        "A target is already published; amend or withdraw it first",
      );
    }
    storedDate = assertTargetDate(input.targetDate, now);
  } else if (input.action === "AMEND") {
    if (!live) {
      throw new ClientSlaError("NOTHING_TO_AMEND", "Nothing to amend — no published target");
    }
    storedDate = assertTargetDate(input.targetDate, now);
  } else if (input.action === "WITHDRAW") {
    if (!live) {
      throw new ClientSlaError("NOTHING_TO_WITHDRAW", "Nothing to withdraw — no published target");
    }
    storedDate = null;
  }

  const focus = getFocusStage(caseState);
  const stageKey = focus?.key ?? caseState.stages[0]?.key ?? "unknown";

  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type: EVENT_TYPE_FOR_ACTION[input.action],
        stageKey,
        actorRole: input.actorRole,
        at: now.toISOString(),
        payload: encodeClientSlaPayload({
          action: input.action,
          targetDate: storedDate,
          reason: trimmed,
        }),
      },
    ],
  };
}

export function clientSlaTargetCopy(
  commitment: ClientSlaCommitment,
): ClientSlaTargetCopy | null {
  if (!commitment.moduleEnabled) {
    return null;
  }
  const paid = commitment.criteria.find((row) => row.key === "paid_tier")?.met ?? false;
  if (!paid) {
    return null;
  }
  if (commitment.status !== "PUBLISHED" && commitment.status !== "AMENDED") {
    return null;
  }
  const targetDate = commitment.publication?.targetDate;
  if (!targetDate) {
    return null;
  }

  const amendedNote = commitment.status === "AMENDED" ? " (amended)" : "";
  return {
    status: commitment.status,
    headline: "Target completion date",
    body: `We are working toward ${targetDate}${amendedNote}. This is a published target, subject to the carve-outs below.`,
    targetDate,
    carveOuts: commitment.carveOuts,
  };
}

export function advisorSlaView(commitment: ClientSlaCommitment): AdvisorSlaView {
  const live = commitment.status === "PUBLISHED" || commitment.status === "AMENDED";
  return {
    status: commitment.status,
    criteria: commitment.criteria,
    publication: commitment.publication,
    carveOuts: commitment.carveOuts,
    canPublish: commitment.moduleEnabled && commitment.eligibleByRules && !live,
    canAmend: commitment.moduleEnabled && live,
    canWithdraw: commitment.moduleEnabled && live,
  };
}
