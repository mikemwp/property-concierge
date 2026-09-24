import { getFocusStage, type CaseState } from "./stage-engine";
import type { ActorRole, StageStatus } from "./types";

export const SELLER_MILESTONE_STATES = ["NOT_STARTED", "IN_PROGRESS", "DONE"] as const;
export type SellerMilestoneState = (typeof SELLER_MILESTONE_STATES)[number];

export function isSellerMilestoneState(value: string): value is SellerMilestoneState {
  return (SELLER_MILESTONE_STATES as readonly string[]).includes(value);
}

export const SELLER_SHARE_STATUSES = ["NONE", "LIVE", "REVOKED"] as const;
export type SellerShareStatus = (typeof SELLER_SHARE_STATUSES)[number];

export function isSellerShareStatus(value: string): value is SellerShareStatus {
  return (SELLER_SHARE_STATUSES as readonly string[]).includes(value);
}

export const SELLER_SHARE_ACTIONS = ["ISSUE", "REVOKE"] as const;
export type SellerShareAction = (typeof SELLER_SHARE_ACTIONS)[number];

export const SELLER_VIEW_EVENT_TYPES = {
  ISSUED: "SELLER_VIEW_SHARE_ISSUED",
  REVOKED: "SELLER_VIEW_SHARE_REVOKED",
} as const;

export const MIN_SELLER_SHARE_REASON_LENGTH = 8;

export type SellerMilestoneRow = {
  key: string;
  title: string;
  state: SellerMilestoneState;
};

export type SellerMilestoneSummary = {
  moduleEnabled: boolean;
  shareStatus: SellerShareStatus;
  rows: SellerMilestoneRow[];
  focusStageKey: string | null;
};

export type SellerShareEventPayload = {
  action: SellerShareAction;
  reason: string;
};

export type SellerFacingCopy = {
  headline: string;
  body: string;
};

export type AdvisorSellerView = {
  summary: SellerMilestoneSummary;
  exportCopy: string;
  canIssueShare: boolean;
  canRevokeShare: boolean;
};

export class SellerMilestoneError extends Error {
  constructor(
    public code:
      | "MODULE_OFF"
      | "FORBIDDEN_ROLE"
      | "REASON_REQUIRED"
      | "ALREADY_LIVE"
      | "NOTHING_TO_REVOKE"
      | "ALREADY_REVOKED"
      | "SHARE_INACTIVE"
      | "INVALID_TOKEN",
    message: string,
  ) {
    super(message);
    this.name = "SellerMilestoneError";
  }
}

export function deriveSellerMilestoneState(status: StageStatus): SellerMilestoneState {
  if (status === "DONE") return "DONE";
  if (status === "ACTIVE" || status === "BLOCKED") return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function encodeSellerSharePayload(payload: SellerShareEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeSellerSharePayload(raw: string | undefined): SellerShareEventPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SellerShareEventPayload>;
    if (
      (parsed.action !== "ISSUE" && parsed.action !== "REVOKE") ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return { action: parsed.action, reason: parsed.reason };
  } catch {
    return null;
  }
}

export function shareStatusFromEvents(
  events: ReadonlyArray<{ type: string; payload?: string }>,
): SellerShareStatus {
  let status: SellerShareStatus = "NONE";
  for (const event of events) {
    if (event.type === SELLER_VIEW_EVENT_TYPES.ISSUED) status = "LIVE";
    if (event.type === SELLER_VIEW_EVENT_TYPES.REVOKED) status = "REVOKED";
  }
  return status;
}

export function buildSellerMilestoneSummary(input: {
  caseState: CaseState;
  moduleEnabled: boolean;
}): SellerMilestoneSummary {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      shareStatus: "NONE",
      rows: [],
      focusStageKey: null,
    };
  }
  return {
    moduleEnabled: true,
    shareStatus: shareStatusFromEvents(input.caseState.events),
    rows: input.caseState.stages.map((stage) => ({
      key: stage.key,
      title: stage.title,
      state: deriveSellerMilestoneState(stage.status),
    })),
    focusStageKey: getFocusStage(input.caseState)?.key ?? null,
  };
}

const FACING_HEADLINE = "Buyer progress on this purchase";
const FACING_BODY =
  "This summary is shared by the buyer's advisor from the purchase ledger. We act for the buyer only. This is not a property listing, not a seller login, and not an introduction to the buyer.";

const STATE_LABEL: Record<SellerMilestoneState, string> = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  DONE: "done",
};

export function sellerFacingCopy(summary: SellerMilestoneSummary): SellerFacingCopy | null {
  if (!summary.moduleEnabled) return null;
  return { headline: FACING_HEADLINE, body: FACING_BODY };
}

export function sellerExportCopy(summary: SellerMilestoneSummary): string {
  const facing = sellerFacingCopy(summary);
  if (!facing) return "";
  const lines = summary.rows.map((row) => `- ${row.title}: ${STATE_LABEL[row.state]}`);
  return [facing.headline, "", facing.body, "", ...lines].join("\n");
}

export function advisorSellerView(summary: SellerMilestoneSummary): AdvisorSellerView {
  return {
    summary,
    exportCopy: sellerExportCopy(summary),
    canIssueShare: summary.moduleEnabled && summary.shareStatus !== "LIVE",
    canRevokeShare: summary.moduleEnabled && summary.shareStatus === "LIVE",
  };
}

export function applySellerShareAction(
  caseState: CaseState,
  input: {
    action: SellerShareAction;
    reason: string;
    actorRole: ActorRole;
    moduleEnabled: boolean;
    now?: Date;
  },
): CaseState {
  if (input.actorRole !== "ADVISOR") {
    throw new SellerMilestoneError(
      "FORBIDDEN_ROLE",
      "Only an advisor may issue or revoke a seller milestone share",
    );
  }
  const reason = input.reason.trim();
  if (reason.length < MIN_SELLER_SHARE_REASON_LENGTH) {
    throw new SellerMilestoneError(
      "REASON_REQUIRED",
      `A reason of at least ${MIN_SELLER_SHARE_REASON_LENGTH} characters is required`,
    );
  }
  if (!input.moduleEnabled) {
    throw new SellerMilestoneError("MODULE_OFF", "Seller milestone views are not enabled for this case");
  }

  const current = shareStatusFromEvents(caseState.events);
  if (input.action === "ISSUE" && current === "LIVE") {
    throw new SellerMilestoneError("ALREADY_LIVE", "A seller milestone share is already live");
  }
  if (input.action === "REVOKE" && current === "NONE") {
    throw new SellerMilestoneError("NOTHING_TO_REVOKE", "Nothing to revoke");
  }
  if (input.action === "REVOKE" && current === "REVOKED") {
    throw new SellerMilestoneError("ALREADY_REVOKED", "Seller milestone share is already revoked");
  }

  const focus = getFocusStage(caseState);
  const stageKey = focus?.key ?? caseState.stages[0]?.key ?? "unknown";
  return {
    ...caseState,
    events: [
      ...caseState.events,
      {
        type:
          input.action === "ISSUE"
            ? SELLER_VIEW_EVENT_TYPES.ISSUED
            : SELLER_VIEW_EVENT_TYPES.REVOKED,
        stageKey,
        actorRole: input.actorRole,
        at: (input.now ?? new Date()).toISOString(),
        payload: encodeSellerSharePayload({ action: input.action, reason }),
      },
    ],
  };
}
