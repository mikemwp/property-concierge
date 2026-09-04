import { describe, it, expect } from "vitest";
import {
  summariseFunnel,
  VALIDATION_TARGET_HOUSEHOLDS,
  type FunnelCaseRow,
} from "../../src/domain/funnel";

const rows: FunnelCaseRow[] = [
  { id: "1", tier: "PAID_DWY", leadSource: "DIASPORA_AU_UK", entryContext: "RETURNER_OVERSEAS" },
  { id: "2", tier: "PAID_DWY", leadSource: "DIASPORA_AU_UK", entryContext: "RETURNER_OVERSEAS" },
  { id: "3", tier: "FREE_DIY", leadSource: "DIASPORA_AU_UK", entryContext: "RETURNER_IN_UK" },
  { id: "4", tier: "FREE_DIY", leadSource: "ORGANIC", entryContext: "UK_RESIDENT_SPEED" },
  { id: "5", tier: "PAID_DWY", leadSource: "COMMUNITY_REFERRAL", entryContext: "RETURNER_IN_UK" },
];

describe("summariseFunnel", () => {
  it("counts tiers and the paid conversion rate", () => {
    const summary = summariseFunnel(rows);
    expect(summary.totalCases).toBe(5);
    expect(summary.paidCases).toBe(3);
    expect(summary.freeCases).toBe(2);
    expect(summary.paidConversionRate).toBe(0.6);
  });

  it("counts diaspora-sourced households for the community metric", () => {
    const summary = summariseFunnel(rows);
    expect(summary.diasporaCases).toBe(4);
    expect(summary.diasporaPaidCases).toBe(3);
  });

  it("breaks down by source, biggest first", () => {
    const summary = summariseFunnel(rows);
    expect(summary.bySource[0]).toEqual({
      leadSource: "DIASPORA_AU_UK",
      total: 3,
      paid: 2,
    });
    expect(summary.bySource).toHaveLength(3);
  });

  it("breaks down by entry context", () => {
    const summary = summariseFunnel(rows);
    const returnerInUk = summary.byEntryContext.find(
      (row) => row.entryContext === "RETURNER_IN_UK",
    );
    expect(returnerInUk).toEqual({
      entryContext: "RETURNER_IN_UK",
      total: 2,
      paid: 1,
    });
  });

  it("reports the 10-household validation target", () => {
    expect(VALIDATION_TARGET_HOUSEHOLDS).toBe(10);
    expect(summariseFunnel(rows).validationTargetMet).toBe(false);

    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `p${index}`,
      tier: "PAID_DWY" as const,
      leadSource: "DIASPORA_US_UK" as const,
      entryContext: "RETURNER_OVERSEAS" as const,
    }));
    expect(summariseFunnel(many).validationTargetMet).toBe(true);
  });

  it("handles an empty ledger without dividing by zero", () => {
    const summary = summariseFunnel([]);
    expect(summary.paidConversionRate).toBe(0);
    expect(summary.bySource).toEqual([]);
  });
});
