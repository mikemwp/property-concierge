import { isPartnerActorRole, type ActorRole, type Tier } from "./types";

export const THREAD_PERMISSIONS = ["NONE", "READ", "POST"] as const;
export type ThreadPermission = (typeof THREAD_PERMISSIONS)[number];

export type ThreadErrorCode =
  | "THREAD_DISABLED"
  | "FORBIDDEN"
  | "FREE_TIER"
  | "INVALID_BODY"
  | "APPEND_ONLY"
  | "NOT_FOUND";

export class ThreadError extends Error {
  constructor(
    public code: ThreadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ThreadError";
  }
}

export type CaseMessageRecord = {
  id: string;
  caseId: string;
  authorUserId: string;
  authorRole: ActorRole;
  body: string;
  createdAt: string;
  authorName: string | null;
};

export type ThreadActor = {
  role: ActorRole;
  userId: string;
};

export type ThreadViewer = {
  role: ActorRole;
  userId: string;
  tier: Tier;
  assigned: boolean;
  hasActiveReferral: boolean;
};

export const MIN_THREAD_BODY_LENGTH = 1;
export const MAX_THREAD_BODY_LENGTH = 4000;

export function normalizeThreadBody(body: string): string {
  return body.replace(/\0/g, "").trim();
}

export function assertValidThreadBody(body: string): string {
  const normalized = normalizeThreadBody(body);
  if (normalized.length < MIN_THREAD_BODY_LENGTH) {
    throw new ThreadError("INVALID_BODY", "Message body cannot be empty");
  }
  if (normalized.length > MAX_THREAD_BODY_LENGTH) {
    throw new ThreadError(
      "INVALID_BODY",
      `Message body must be at most ${MAX_THREAD_BODY_LENGTH} characters`,
    );
  }
  return normalized;
}

export function threadPermission(input: {
  role: ActorRole;
  tier: Tier;
  assigned: boolean;
  hasActiveReferral: boolean;
}): ThreadPermission {
  if (input.tier !== "PAID_DWY") {
    return "NONE";
  }
  if (input.role === "ADVISOR" || input.role === "CLIENT") {
    return "POST";
  }
  if (isPartnerActorRole(input.role) && (input.assigned || input.hasActiveReferral)) {
    return "POST";
  }
  return "NONE";
}

export function canReadThread(viewer: ThreadViewer): boolean {
  return threadPermission(viewer) !== "NONE";
}

export function canPostThread(viewer: ThreadViewer): boolean {
  return threadPermission(viewer) === "POST";
}

export function assertCanPostThread(viewer: ThreadViewer): void {
  if (viewer.tier !== "PAID_DWY") {
    throw new ThreadError("FREE_TIER", "Case thread is a paid Done-With-You capability");
  }
  if (!canPostThread(viewer)) {
    throw new ThreadError("FORBIDDEN", "Not allowed to post on this case thread");
  }
}

export function visibleCaseMessages(
  messages: readonly CaseMessageRecord[],
  viewer: ThreadViewer,
): CaseMessageRecord[] {
  if (!canReadThread(viewer)) {
    return [];
  }
  return [...messages];
}

export function assertAppendOnly(existing: CaseMessageRecord | null): void {
  if (existing) {
    throw new ThreadError(
      "APPEND_ONLY",
      "Case messages are append-only and cannot be edited or replaced",
    );
  }
}

export function assertMessageImmutable(
  existing: CaseMessageRecord,
  proposed: Pick<CaseMessageRecord, "body" | "authorUserId" | "authorRole">,
): void {
  if (
    existing.body !== proposed.body ||
    existing.authorUserId !== proposed.authorUserId ||
    existing.authorRole !== proposed.authorRole
  ) {
    throw new ThreadError(
      "APPEND_ONLY",
      "Case messages are append-only and cannot be edited or replaced",
    );
  }
}
