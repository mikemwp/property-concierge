import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ThreadError } from "../../src/domain/threads";
import {
  assertThreadsEnabled,
  canUseThreads,
  listVisibleCaseMessages,
  performPostMessage,
  threadViewerFor,
} from "../../src/server/threads";
import type { CaseMessageRecord } from "../../src/domain/threads";

function paid(id = "tp1") {
  return createCase({ id, entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

const sample: CaseMessageRecord = {
  id: "msg_1",
  caseId: "tp1",
  authorUserId: "user_advisor",
  authorRole: "ADVISOR",
  body: "Welcome.",
  createdAt: "2026-09-04T10:00:00.000Z",
  authorName: "Demo Advisor",
};

describe("case_threads module gate", () => {
  it("is open for paid England & Wales and closed otherwise", () => {
    expect(canUseThreads(paid())).toBe(true);
    expect(canUseThreads({ ...paid(), marketPackId: "au_uk" })).toBe(false);
    expect(canUseThreads({ ...paid("tp2"), tier: "FREE_DIY" })).toBe(false);
    expect(() => assertThreadsEnabled(paid())).not.toThrow();
    expect(() => assertThreadsEnabled({ ...paid(), marketPackId: "au_uk" })).toThrow(ThreadError);
    expect(() => assertThreadsEnabled({ ...paid("tp3"), tier: "FREE_DIY" })).toThrow(ThreadError);
  });
});

describe("visibility filter", () => {
  it("shows the whole thread to paid parties and nothing to free DIY", () => {
    const caseState = paid();
    const advisor = threadViewerFor(caseState, { role: "ADVISOR", userId: "adv" }, {
      assigned: true,
      hasActiveReferral: false,
    });
    const free = threadViewerFor(
      { ...caseState, tier: "FREE_DIY" },
      { role: "CLIENT", userId: "user_client" },
      { assigned: true, hasActiveReferral: false },
    );
    expect(listVisibleCaseMessages([sample], advisor).map((row) => row.id)).toEqual(["msg_1"]);
    expect(listVisibleCaseMessages([sample], free)).toEqual([]);
  });
});

describe("performPostMessage refuses before the store", () => {
  it("throws THREAD_DISABLED on a corridor pack without inserting", async () => {
    await expect(
      performPostMessage({
        caseState: { ...paid(), marketPackId: "au_uk" },
        actor: { role: "ADVISOR", userId: "adv" },
        body: "Should not persist.",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "THREAD_DISABLED" });
  });

  it("throws FREE_TIER for a DIY case", async () => {
    await expect(
      performPostMessage({
        caseState: { ...paid("tp4"), tier: "FREE_DIY" },
        actor: { role: "CLIENT", userId: "user_client" },
        body: "Should not persist.",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "FREE_TIER" });
  });

  it("throws FORBIDDEN for an unassigned partner", async () => {
    await expect(
      performPostMessage({
        caseState: paid("tp5"),
        actor: { role: "MORTGAGE_PARTNER", userId: "user_mortgage" },
        body: "Should not persist.",
        assigned: false,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws INVALID_BODY for whitespace", async () => {
    await expect(
      performPostMessage({
        caseState: paid("tp6"),
        actor: { role: "ADVISOR", userId: "adv" },
        body: "   ",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).rejects.toMatchObject({ code: "INVALID_BODY" });
  });
});
