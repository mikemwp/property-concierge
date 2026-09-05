import type { StageState } from "./stage-engine";
import type { ActorRole } from "./types";

/**
 * Spec §7: partner ops sit behind a clean interface. This is the vendor-neutral
 * vocabulary every adapter — manual, stub or a future real client — must speak.
 */
export const PARTNER_STATUSES = [
  "RECEIVED",
  "IN_PROGRESS",
  "BLOCKED_ON_CLIENT",
  "EVIDENCE_READY",
  "COMPLETE",
] as const;

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export function isPartnerStatus(value: string): value is PartnerStatus {
  return (PARTNER_STATUSES as readonly string[]).includes(value);
}

/** Additive only. The Plan 1-3 event types keep their exact shapes. */
export const PARTNER_INTEGRATION_EVENT_TYPES = [
  "PARTNER_CASE_ACKNOWLEDGED",
  "PARTNER_STATUS_SYNCED",
  "PARTNER_MILESTONE_REPORTED",
  "PARTNER_UPDATE_REJECTED",
] as const;

export type PartnerIntegrationEventType = (typeof PARTNER_INTEGRATION_EVENT_TYPES)[number];

export function mintTicketId(input: { prefix: string; caseId: string; at: string }): string {
  return `${input.prefix}-${input.caseId}-${new Date(input.at).getTime()}`;
}

/** The stable JSON envelope for every integration event payload. */
export type PartnerEventPayload = {
  ticketId: string;
  adapterId: string;
  role: ActorRole;
  panelMemberId: string | null;
  panelMemberName?: string;
  status?: PartnerStatus;
  milestoneKey?: string;
  note?: string;
  reason?: string;
  simulatedLatencyDays?: number;
};

export function encodePartnerEventPayload(payload: PartnerEventPayload): string {
  return JSON.stringify(payload);
}

/**
 * Reads both the new envelope and the frozen WARM_INTRO_REQUESTED shape, so the
 * activity view never needs a second parser. Bare-string payloads (EVIDENCE_SUBMITTED
 * carries only the kind) decode to null by design.
 */
export function decodePartnerEventPayload(raw: string | undefined): PartnerEventPayload | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const role = (record.role ?? record.partnerType) as ActorRole | undefined;
  if (typeof record.ticketId !== "string" || role === undefined) {
    return null;
  }

  const str = (key: string) => (typeof record[key] === "string" ? { [key]: record[key] } : {});

  return {
    ticketId: record.ticketId,
    adapterId: typeof record.adapterId === "string" ? record.adapterId : "manual",
    role,
    panelMemberId: typeof record.panelMemberId === "string" ? record.panelMemberId : null,
    ...str("panelMemberName"),
    ...str("milestoneKey"),
    ...str("note"),
    ...str("reason"),
    ...(typeof record.status === "string" && isPartnerStatus(record.status)
      ? { status: record.status }
      : {}),
    ...(typeof record.simulatedLatencyDays === "number"
      ? { simulatedLatencyDays: record.simulatedLatencyDays }
      : {}),
  };
}

export type EvidenceInbox = {
  toSubmit: string[];
  awaitingAcceptance: string[];
  accepted: string[];
  complete: boolean;
};

export function partnerEvidenceInbox(stage: StageState): EvidenceInbox {
  const accepted = stage.requiredEvidenceKinds.filter((k) => stage.acceptedEvidenceKinds.includes(k));
  const awaitingAcceptance = stage.requiredEvidenceKinds.filter(
    (k) => stage.submittedEvidenceKinds.includes(k) && !stage.acceptedEvidenceKinds.includes(k),
  );
  const toSubmit = stage.requiredEvidenceKinds.filter(
    (k) => !stage.submittedEvidenceKinds.includes(k) && !stage.acceptedEvidenceKinds.includes(k),
  );
  return {
    toSubmit,
    awaitingAcceptance,
    accepted,
    complete: stage.requiredEvidenceKinds.length > 0 && toSubmit.length === 0 && awaitingAcceptance.length === 0,
  };
}

/**
 * What a partner status entitles the orchestrator to do. Deliberately narrow: a partner
 * can add evidence and add facts to the ledger. Accepting, advancing, blocking and
 * re-routing remain advisor powers (spec §8 "stage engine is source of truth").
 */
export type PartnerUpdateIntent =
  | { kind: "ACKNOWLEDGE" }
  | { kind: "NOTE_ONLY"; note?: string }
  | { kind: "SUBMIT_EVIDENCE"; kinds: string[] }
  | { kind: "REJECT"; reason: string };

export function intentForStatus(input: {
  status: PartnerStatus;
  role: ActorRole;
  stage: StageState;
}): PartnerUpdateIntent {
  const { status, role, stage } = input;

  if (stage.ownerRole !== role) {
    return { kind: "REJECT", reason: `Stage owner is ${stage.ownerRole}, not ${role}` };
  }
  if (stage.status !== "ACTIVE" && stage.status !== "BLOCKED") {
    return { kind: "REJECT", reason: "Stage is not open for partner updates" };
  }

  if (status === "RECEIVED") {
    return { kind: "ACKNOWLEDGE" };
  }
  if (status === "IN_PROGRESS") {
    return { kind: "NOTE_ONLY" };
  }
  if (status === "BLOCKED_ON_CLIENT") {
    return { kind: "NOTE_ONLY", note: "Partner is waiting on the client" };
  }

  const outstanding = partnerEvidenceInbox(stage).toSubmit;
  if (outstanding.length === 0) {
    return { kind: "NOTE_ONLY", note: "All required evidence is already with the advisor" };
  }
  return { kind: "SUBMIT_EVIDENCE", kinds: outstanding };
}
