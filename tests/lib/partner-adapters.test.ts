import { describe, it, expect } from "vitest";
import { decodePartnerEventPayload } from "../../src/domain/partner-integration";
import { profileForRole } from "../../src/lib/partner-adapters/profiles";
import { partnerPortForCase, partnerPortForRole } from "../../src/lib/partner-adapters/registry";
import { ManualPartnerPort } from "../../src/lib/partner-port";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

/**
 * mortgage_path activates at case creation + 0 days in these fixtures; the tests move
 * `now` forward instead of moving the clock.
 */
function daysAfterActivation(state: ReturnType<typeof atMortgagePath>, days: number): Date {
  const activatedAt = state.stages.find((s) => s.key === "mortgage_path")!.activatedAt!;
  const at = new Date(activatedAt);
  at.setUTCDate(at.getUTCDate() + days);
  return at;
}

describe("stub adapter selection", () => {
  it("picks the role's stub adapter when the pack runs speed rails", () => {
    const state = atMortgagePath();
    expect(partnerPortForCase(state, "MORTGAGE_PARTNER").adapterId).toBe("stub-mortgage");
    expect(partnerPortForCase(state, "CONVEYANCER").adapterId).toBe("stub-conveyancer");
    expect(partnerPortForCase(state, "MOVE_PARTNER").adapterId).toBe("stub-move");
  });

  it("falls back to manual ops when the module is off or the case is free", () => {
    const noModule = { ...atMortgagePath(), marketPackId: "au" };
    const free = { ...atMortgagePath(), tier: "FREE_DIY" as const };
    expect(partnerPortForCase(noModule, "MORTGAGE_PARTNER")).toBeInstanceOf(ManualPartnerPort);
    expect(partnerPortForCase(free, "MORTGAGE_PARTNER").adapterId).toBe("manual");
  });

  it("exposes a role-only lookup for the inbound path", () => {
    expect(partnerPortForRole("CONVEYANCER").adapterId).toBe("stub-conveyancer");
  });

  it("gives each role its own cadence — removals fastest, conveyancing slowest", () => {
    expect(profileForRole("MOVE_PARTNER")!.cadenceDays).toBeLessThan(
      profileForRole("MORTGAGE_PARTNER")!.cadenceDays,
    );
    expect(profileForRole("MORTGAGE_PARTNER")!.cadenceDays).toBeLessThan(
      profileForRole("CONVEYANCER")!.cadenceDays,
    );
    expect(profileForRole("CLIENT")).toBeNull();
  });
});

describe("simulated vendor turnaround is deterministic", () => {
  const context = {
    caseId: "pp1",
    role: "MORTGAGE_PARTNER" as const,
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
  };

  it("walks the mortgage ladder as simulated days pass", async () => {
    const state = atMortgagePath();
    const store = makeMemoryCaseStore(state);
    const port = partnerPortForCase(state, "MORTGAGE_PARTNER", store);

    const day0 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 0) });
    const day3 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 3) });
    const day6 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 6) });
    const day30 = await port.syncStatus({ ...context, now: daysAfterActivation(state, 30) });

    expect([day0.status, day3.status, day6.status, day30.status]).toEqual([
      "RECEIVED",
      "IN_PROGRESS",
      "BLOCKED_ON_CLIENT",
      "EVIDENCE_READY",
    ]);
    // Same inputs, same answer: the ladder is arithmetic on days-in-stage, not a roll.
    expect((await port.syncStatus({ ...context, now: daysAfterActivation(state, 3) })).status).toBe(
      "IN_PROGRESS",
    );
  });

  it("refuses a role that does not own the focus stage", async () => {
    const state = atMortgagePath();
    const port = partnerPortForCase(state, "CONVEYANCER", makeMemoryCaseStore(state));
    await expect(
      port.syncStatus({ ...context, role: "CONVEYANCER", now: daysAfterActivation(state, 3) }),
    ).rejects.toThrow(/owner/i);
  });

  it("records the simulated latency it used in the ledger payload", async () => {
    const state = atMortgagePath();
    const store = makeMemoryCaseStore(state);
    const port = partnerPortForCase(state, "MORTGAGE_PARTNER", store);
    await port.syncStatus({ ...context, now: daysAfterActivation(state, 3) });
    const payload = decodePartnerEventPayload(store.current().events.at(-1)!.payload);
    expect(payload).toMatchObject({ adapterId: "stub-mortgage", status: "IN_PROGRESS" });
    expect(payload!.simulatedLatencyDays).toBe(3);
  });

  it("reports COMPLETE once every required kind is accepted, and still does not advance", async () => {
    const state = atMortgagePath();
    const withEvidence = {
      ...state,
      stages: state.stages.map((s) =>
        s.key === "mortgage_path" ? { ...s, acceptedEvidenceKinds: [...s.requiredEvidenceKinds] } : s,
      ),
    };
    const store = makeMemoryCaseStore(withEvidence);
    const port = partnerPortForCase(withEvidence, "MORTGAGE_PARTNER", store);
    const result = await port.syncStatus({ ...context, now: daysAfterActivation(state, 1) });
    expect(result.status).toBe("COMPLETE");
    expect(store.current().stages.find((s) => s.key === "mortgage_path")!.status).toBe("ACTIVE");
  });
});
