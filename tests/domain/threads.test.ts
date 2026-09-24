import { describe, expect, it } from "vitest";
import {
  assertAppendOnly,
  assertCanPostThread,
  assertMessageImmutable,
  assertValidThreadBody,
  canPostThread,
  canReadThread,
  MAX_THREAD_BODY_LENGTH,
  MIN_THREAD_BODY_LENGTH,
  normalizeThreadBody,
  ThreadError,
  threadPermission,
  visibleCaseMessages,
  type CaseMessageRecord,
  type ThreadViewer,
} from "../../src/domain/threads";

function message(overrides: Partial<CaseMessageRecord> = {}): CaseMessageRecord {
  return {
    id: "msg_1",
    caseId: "case_1",
    authorUserId: "user_advisor",
    authorRole: "ADVISOR",
    body: "Welcome to the case thread.",
    createdAt: "2026-09-04T10:00:00.000Z",
    authorName: "Demo Advisor",
    ...overrides,
  };
}

function viewer(overrides: Partial<ThreadViewer> = {}): ThreadViewer {
  return {
    role: "CLIENT",
    userId: "user_client",
    tier: "PAID_DWY",
    assigned: true,
    hasActiveReferral: false,
    ...overrides,
  };
}

describe("thread ACL", () => {
  it("lets the advisor and paid client post, and hides the thread from free DIY", () => {
    expect(threadPermission(viewer({ role: "ADVISOR" }))).toBe("POST");
    expect(threadPermission(viewer({ role: "CLIENT" }))).toBe("POST");
    expect(threadPermission(viewer({ role: "CLIENT", tier: "FREE_DIY" }))).toBe("NONE");
    expect(threadPermission(viewer({ role: "ADVISOR", tier: "FREE_DIY" }))).toBe("NONE");
    expect(canReadThread(viewer({ tier: "FREE_DIY" }))).toBe(false);
    expect(canPostThread(viewer({ tier: "FREE_DIY" }))).toBe(false);
  });

  it("lets assigned or referred partners post and refuses strangers", () => {
    expect(
      threadPermission(
        viewer({
          role: "MORTGAGE_PARTNER",
          userId: "user_mortgage",
          assigned: true,
          hasActiveReferral: false,
        }),
      ),
    ).toBe("POST");
    expect(
      threadPermission(
        viewer({
          role: "CONVEYANCER",
          userId: "user_conv",
          assigned: false,
          hasActiveReferral: true,
        }),
      ),
    ).toBe("POST");
    expect(
      threadPermission(
        viewer({
          role: "MOVE_PARTNER",
          userId: "user_move",
          assigned: false,
          hasActiveReferral: false,
        }),
      ),
    ).toBe("NONE");
  });

  it("throws FREE_TIER for a free client and FORBIDDEN for an unassigned partner", () => {
    expect(() => assertCanPostThread(viewer({ tier: "FREE_DIY" }))).toThrow(ThreadError);
    try {
      assertCanPostThread(viewer({ tier: "FREE_DIY" }));
    } catch (err) {
      expect(err).toBeInstanceOf(ThreadError);
      expect((err as ThreadError).code).toBe("FREE_TIER");
    }
    try {
      assertCanPostThread(
        viewer({
          role: "MORTGAGE_PARTNER",
          assigned: false,
          hasActiveReferral: false,
        }),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(ThreadError);
      expect((err as ThreadError).code).toBe("FORBIDDEN");
    }
  });
});

describe("visibility is the whole thread or nothing", () => {
  it("returns every message to a permitted viewer and none to a free or unassigned viewer", () => {
    const rows = [
      message(),
      message({
        id: "msg_2",
        authorUserId: "user_client",
        authorRole: "CLIENT",
        body: "Here is the ID pack.",
        authorName: "Demo Client",
      }),
    ];
    expect(visibleCaseMessages(rows, viewer({ role: "ADVISOR" })).map((row) => row.id)).toEqual([
      "msg_1",
      "msg_2",
    ]);
    expect(visibleCaseMessages(rows, viewer({ role: "CLIENT" }))).toHaveLength(2);
    expect(
      visibleCaseMessages(
        rows,
        viewer({ role: "MORTGAGE_PARTNER", assigned: true }),
      ),
    ).toHaveLength(2);
    expect(visibleCaseMessages(rows, viewer({ tier: "FREE_DIY" }))).toEqual([]);
    expect(
      visibleCaseMessages(
        rows,
        viewer({
          role: "MORTGAGE_PARTNER",
          assigned: false,
          hasActiveReferral: false,
        }),
      ),
    ).toEqual([]);
  });
});

describe("body rules", () => {
  it("trims, strips NUL, and enforces 1..4000 characters", () => {
    expect(normalizeThreadBody("  hello\0  ")).toBe("hello");
    expect(assertValidThreadBody("  hello  ")).toBe("hello");
    expect(MIN_THREAD_BODY_LENGTH).toBe(1);
    expect(MAX_THREAD_BODY_LENGTH).toBe(4000);
    expect(() => assertValidThreadBody("   ")).toThrow(ThreadError);
    expect(() => assertValidThreadBody("x".repeat(4001))).toThrow(ThreadError);
    try {
      assertValidThreadBody("");
    } catch (err) {
      expect((err as ThreadError).code).toBe("INVALID_BODY");
    }
  });
});

describe("append-only", () => {
  it("refuses a second write against an existing message id or a mutated body", () => {
    const existing = message();
    expect(() => assertAppendOnly(existing)).toThrow(ThreadError);
    expect(() => assertAppendOnly(null)).not.toThrow();
    expect(() =>
      assertMessageImmutable(existing, {
        body: existing.body,
        authorUserId: existing.authorUserId,
        authorRole: existing.authorRole,
      }),
    ).not.toThrow();
    try {
      assertMessageImmutable(existing, {
        body: "edited",
        authorUserId: existing.authorUserId,
        authorRole: existing.authorRole,
      });
    } catch (err) {
      expect((err as ThreadError).code).toBe("APPEND_ONLY");
    }
  });
});
