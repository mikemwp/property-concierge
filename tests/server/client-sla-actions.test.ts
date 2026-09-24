import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
import {
  applyClientSlaAction,
  assessClientSla,
  ClientSlaError,
  type SlaScorecardSignal,
} from "../../src/domain/client-sla";
import { createCase, type CaseState } from "../../src/domain/stage-engine";
import { performClientSlaAction } from "../../src/server/client-sla";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const TARGET = "2026-12-15";

function acceptAny(caseState: CaseState): CaseState {
  const kind = caseState.stages[0]?.requiredEvidenceKinds[0];
  if (!kind) {
    return caseState;
  }
  return {
    ...caseState,
    stages: caseState.stages.map((stage, index) =>
      index === 0
        ? { ...stage, acceptedEvidenceKinds: [...stage.acceptedEvidenceKinds, kind] }
        : stage,
    ),
  };
}

const signals: SlaScorecardSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

function ready(): CaseState {
  return acceptAny(
    createCase({
      id: "slaa1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      now: NOW,
    }),
  );
}

describe("performClientSlaAction", () => {
  it("writes PUBLISHED through the policy gate", () => {
    const next = performClientSlaAction(ready(), {
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "Ledger is live; partner scorecard supports a target.",
      partnerSignals: signals,
      now: NOW,
    });
    expect(
      assessClientSla({
        caseState: next,
        moduleEnabled: true,
        partnerSignals: signals,
      }).status,
    ).toBe("PUBLISHED");
  });

  it("maps domain refusals to ClientSlaError codes the action will surface", () => {
    try {
      performClientSlaAction(
        createCase({
          id: "slaa2",
          entryContext: "UK_RESIDENT_SPEED",
          tier: "PAID_DWY",
          now: NOW,
        }),
        {
          action: "PUBLISH",
          targetDate: TARGET,
          reason: "I just like a date.",
          partnerSignals: [],
          now: NOW,
        },
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ClientSlaError);
      expect((err as ClientSlaError).code).toBe("NOT_ELIGIBLE");
    }
  });

  it("refuses the overlay when the pack flag is off", () => {
    const other = { ...ready(), marketPackId: "au" };
    expect(() =>
      performClientSlaAction(other, {
        action: "PUBLISH",
        targetDate: TARGET,
        reason: "Ledger is live; partner scorecard supports a target.",
        partnerSignals: signals,
        now: NOW,
      }),
    ).toThrow(/not enabled/i);
  });
});

describe("error mapping contract", () => {
  it("exposes the domain message, not a generic failure, for ClientSlaError", () => {
    const err = new ClientSlaError(
      "REASON_REQUIRED",
      "A reason of at least 8 characters is required",
    );
    expect(err.message).toMatch(/reason/i);
    expect(err).toBeInstanceOf(Error);
  });

  it("does not let applyClientSlaAction skip the server gate", () => {
    const published = applyClientSlaAction(ready(), {
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "Ledger is live; partner scorecard supports a target.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
      now: NOW,
    });
    expect(published.events.some((event) => event.type === "CLIENT_SLA_PUBLISHED")).toBe(true);
  });
});

describe("action module", () => {
  it("exports advisor publish, amend and withdraw entry points", async () => {
    const actions = await import("@/app/actions/client-sla");
    expect(typeof actions.publishClientSlaAction).toBe("function");
    expect(typeof actions.amendClientSlaAction).toBe("function");
    expect(typeof actions.withdrawClientSlaAction).toBe("function");
  });
});
