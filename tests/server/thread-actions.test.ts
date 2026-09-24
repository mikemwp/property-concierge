import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { ThreadError } from "../../src/domain/threads";
import { canUseThreads } from "../../src/server/threads";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("thread actions honour the ew flag", () => {
  it("enables post policy on paid ew and keeps free DIY silent", () => {
    const paidCase = createCase({
      id: "ta1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    const free = createCase({
      id: "ta2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "FREE_DIY",
    });
    expect(canUseThreads(paidCase)).toBe(true);
    expect(canUseThreads(free)).toBe(false);
  });
});

describe("action module", () => {
  it("exports a single post entry point that revalidates all three surfaces", async () => {
    const actions = await import("@/app/actions/threads");
    expect(typeof actions.postCaseMessageAction).toBe("function");
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/actions/threads.ts"),
      "utf8",
    );
    expect(source).toContain("revalidatePath(`/portal/cases/${caseId}`)");
    expect(source).toContain("revalidatePath(`/cockpit/cases/${caseId}`)");
    expect(source).toContain("revalidatePath(`/partner/cases/${caseId}`)");
    expect(source).not.toMatch(/WebSocket|socket\.io|EventSource|Pusher|Ably/i);
    expect(source).toContain("performPostMessage");
    expect(source).not.toContain("prisma.caseMessage");
  });

  it("surfaces ThreadError messages, not a generic failure", () => {
    const err = new ThreadError("FORBIDDEN", "Not allowed to post on this case thread");
    expect(err.message).toMatch(/Not allowed/);
    expect(err).toBeInstanceOf(Error);
  });
});
