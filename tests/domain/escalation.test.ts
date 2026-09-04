import { describe, it, expect } from "vitest";
import { escalationLevel, daysInStage } from "../../src/domain/escalation";
import type { StageState } from "../../src/domain/stage-engine";

const base: StageState = {
  key: "purchase_profile",
  title: "Purchase profile",
  sortOrder: 0,
  status: "ACTIVE",
  ownerRole: "CLIENT",
  dueAt: null,
  activatedAt: "2026-09-01T10:00:00.000Z",
  completedAt: null,
  blockedReason: null,
  requiredEvidenceKinds: [],
  freeVisible: true,
  freeCanSelfAdvance: true,
  acceptedEvidenceKinds: [],
};

describe("escalation", () => {
  it("returns BREACH when well past SLA", () => {
    expect(
      escalationLevel(base, 3, new Date("2026-09-10T10:00:00.000Z")),
    ).toBe("BREACH");
    expect(daysInStage(base, new Date("2026-09-04T10:00:00.000Z"))).toBe(3);
  });
});
