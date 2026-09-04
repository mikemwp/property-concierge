import { isDiasporaLead, type LeadSource } from "./attribution";
import type { EntryContext, Tier } from "./types";

/** Spec §1: ~10–20 households through the real workflow. */
export const VALIDATION_TARGET_HOUSEHOLDS = 10;

export type FunnelCaseRow = {
  id: string;
  tier: Tier;
  leadSource: LeadSource;
  entryContext: EntryContext;
};

export type SourceBreakdown = {
  leadSource: LeadSource;
  total: number;
  paid: number;
};

export type EntryBreakdown = {
  entryContext: EntryContext;
  total: number;
  paid: number;
};

export type FunnelSummary = {
  totalCases: number;
  paidCases: number;
  freeCases: number;
  paidConversionRate: number;
  diasporaCases: number;
  diasporaPaidCases: number;
  validationTargetMet: boolean;
  bySource: SourceBreakdown[];
  byEntryContext: EntryBreakdown[];
};

function tally<K extends string>(
  rows: FunnelCaseRow[],
  keyOf: (row: FunnelCaseRow) => K,
): Array<{ key: K; total: number; paid: number }> {
  const counts = new Map<K, { total: number; paid: number }>();

  for (const row of rows) {
    const key = keyOf(row);
    const entry = counts.get(key) ?? { total: 0, paid: 0 };
    entry.total += 1;
    if (row.tier === "PAID_DWY") {
      entry.paid += 1;
    }
    counts.set(key, entry);
  }

  return [...counts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) =>
      right.total !== left.total
        ? right.total - left.total
        : left.key.localeCompare(right.key),
    );
}

export function summariseFunnel(rows: FunnelCaseRow[]): FunnelSummary {
  const totalCases = rows.length;
  const paidCases = rows.filter((row) => row.tier === "PAID_DWY").length;
  const diaspora = rows.filter((row) => isDiasporaLead(row.leadSource));

  return {
    totalCases,
    paidCases,
    freeCases: totalCases - paidCases,
    paidConversionRate:
      totalCases === 0 ? 0 : Math.round((paidCases / totalCases) * 100) / 100,
    diasporaCases: diaspora.length,
    diasporaPaidCases: diaspora.filter((row) => row.tier === "PAID_DWY").length,
    validationTargetMet: paidCases >= VALIDATION_TARGET_HOUSEHOLDS,
    bySource: tally(rows, (row) => row.leadSource).map((row) => ({
      leadSource: row.key,
      total: row.total,
      paid: row.paid,
    })),
    byEntryContext: tally(rows, (row) => row.entryContext).map((row) => ({
      entryContext: row.key,
      total: row.total,
      paid: row.paid,
    })),
  };
}
