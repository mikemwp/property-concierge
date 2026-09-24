import { describe, expect, it } from "vitest";
import { createCase, type CaseState } from "../../src/domain/stage-engine";
import {
  advisorSellerView,
  applySellerShareAction,
  buildSellerMilestoneSummary,
  decodeSellerSharePayload,
  deriveSellerMilestoneState,
  encodeSellerSharePayload,
  MIN_SELLER_SHARE_REASON_LENGTH,
  SellerMilestoneError,
  sellerExportCopy,
  sellerFacingCopy,
  shareStatusFromEvents,
} from "../../src/domain/seller-milestones";

function paid(id = "sm1"): CaseState {
  return createCase({
    id,
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
  });
}

function withStages(
  caseState: CaseState,
  statuses: Record<string, CaseState["stages"][number]["status"]>,
): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      status: statuses[stage.key] ?? stage.status,
    })),
  };
}

describe("stage collapse", () => {
  it("maps ledger statuses onto three seller-facing states", () => {
    expect(deriveSellerMilestoneState("DONE")).toBe("DONE");
    expect(deriveSellerMilestoneState("ACTIVE")).toBe("IN_PROGRESS");
    expect(deriveSellerMilestoneState("BLOCKED")).toBe("IN_PROGRESS");
    expect(deriveSellerMilestoneState("PENDING")).toBe("NOT_STARTED");
    expect(deriveSellerMilestoneState("SKIPPED")).toBe("NOT_STARTED");
  });
});

describe("summary from the buyer ledger", () => {
  it("returns empty rows and NONE when the module is off", () => {
    const summary = buildSellerMilestoneSummary({
      caseState: paid(),
      moduleEnabled: false,
    });
    expect(summary.moduleEnabled).toBe(false);
    expect(summary.shareStatus).toBe("NONE");
    expect(summary.rows).toEqual([]);
    expect(sellerFacingCopy(summary)).toBeNull();
    expect(sellerExportCopy(summary)).toBe("");
  });

  it("projects every stage title and collapsed state in pack order", () => {
    const caseState = withStages(paid(), {
      purchase_profile: "DONE",
      money_readiness: "ACTIVE",
      mortgage_path: "PENDING",
    });
    const summary = buildSellerMilestoneSummary({ caseState, moduleEnabled: true });
    expect(summary.rows[0]).toEqual({
      key: "purchase_profile",
      title: "Purchase profile",
      state: "DONE",
    });
    expect(summary.rows[1]).toMatchObject({
      key: "money_readiness",
      state: "IN_PROGRESS",
    });
    expect(summary.rows.find((row) => row.key === "mortgage_path")?.state).toBe("NOT_STARTED");
    expect(summary.rows.map((row) => row.key)).toEqual(caseState.stages.map((s) => s.key));
    expect(JSON.stringify(summary)).not.toMatch(/MORTGAGE_PARTNER|CONVEYANCER|source_of_funds|dip_aip/);
  });

  it("reconstructs LIVE then REVOKED from ledger events", () => {
    const issued = applySellerShareAction(paid(), {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(shareStatusFromEvents(issued.events)).toBe("LIVE");
    const revoked = applySellerShareAction(issued, {
      action: "REVOKE",
      reason: "Offer fell through; stop sharing",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(shareStatusFromEvents(revoked.events)).toBe("REVOKED");
    expect(buildSellerMilestoneSummary({ caseState: revoked, moduleEnabled: true }).shareStatus).toBe(
      "REVOKED",
    );
  });
});

describe("share actions", () => {
  it("refuses non-advisors, short reasons, module-off, and illegal transitions", () => {
    expect(() =>
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
        actorRole: "CLIENT",
        moduleEnabled: true,
      }),
    ).toThrow(SellerMilestoneError);
    expect(() =>
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "short",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
    ).toThrow(/at least 8/i);
    expect(MIN_SELLER_SHARE_REASON_LENGTH).toBe(8);
    expect(() =>
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
        actorRole: "ADVISOR",
        moduleEnabled: false,
      }),
    ).toThrow(/not enabled/i);
    expect(() =>
      applySellerShareAction(paid(), {
        action: "REVOKE",
        reason: "Nothing to revoke yet here",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
    ).toThrow(/nothing to revoke/i);

    const live = applySellerShareAction(paid(), {
      action: "ISSUE",
      reason: "Agent asked for a progress snapshot",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(() =>
      applySellerShareAction(live, {
        action: "ISSUE",
        reason: "Already live on this case now",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
    ).toThrow(/already live/i);
  });

  it("allows re-issue after revoke and round-trips the payload", () => {
    const revoked = applySellerShareAction(
      applySellerShareAction(paid(), {
        action: "ISSUE",
        reason: "Agent asked for a progress snapshot",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      }),
      {
        action: "REVOKE",
        reason: "Offer fell through; stop sharing",
        actorRole: "ADVISOR",
        moduleEnabled: true,
      },
    );
    const again = applySellerShareAction(revoked, {
      action: "ISSUE",
      reason: "New agent asked for the same snapshot",
      actorRole: "ADVISOR",
      moduleEnabled: true,
    });
    expect(shareStatusFromEvents(again.events)).toBe("LIVE");
    const payload = decodeSellerSharePayload(again.events.at(-1)?.payload);
    expect(payload).toEqual({
      action: "ISSUE",
      reason: "New agent asked for the same snapshot",
    });
    expect(decodeSellerSharePayload(encodeSellerSharePayload(payload!))).toEqual(payload);
  });
});

describe("copy", () => {
  it("exports a buyer-only disclaimer and never names inventory or an introduction", () => {
    const summary = buildSellerMilestoneSummary({
      caseState: withStages(paid(), { purchase_profile: "DONE" }),
      moduleEnabled: true,
    });
    const facing = sellerFacingCopy(summary);
    expect(facing?.headline).toBe("Buyer progress on this purchase");
    expect(facing?.body).toMatch(/buyer only/i);
    expect(facing?.body).toMatch(/not a property listing/i);
    expect(facing?.body).toMatch(/not an introduction/i);
    const exported = sellerExportCopy(summary);
    expect(exported).toMatch(/purchase profile: done/i);
    const exportWithoutNegations = exported
      .replace(/not an introduction/gi, "")
      .replace(/not a seller login/gi, "")
      .replace(/not a property listing/gi, "");
    expect(exportWithoutNegations).not.toMatch(/introduc|inventory|listing feed|seller login/i);
    const view = advisorSellerView(summary);
    expect(view.canIssueShare).toBe(true);
    expect(view.canRevokeShare).toBe(false);
  });
});
