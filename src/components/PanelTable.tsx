"use client";

import { useState } from "react";
import { setPanelActiveAction } from "@/app/actions/partner-network";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelScorecardRow, ScorecardRating } from "@/domain/scorecard";

type Props = {
  rows: PanelScorecardRow[];
};

const RATING_CLASS: Record<ScorecardRating, string> = {
  STRONG: "bg-emerald-100 text-emerald-800",
  WATCH: "bg-amber-100 text-amber-800",
  UNDERPERFORMING: "bg-red-100 text-red-800",
  NO_DATA: "bg-slate-100 text-slate-600",
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function PanelTable({ rows }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function toggle(panelMemberId: string, active: boolean) {
    setError(null);
    const result = await setPanelActiveAction(panelMemberId, active);
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <ActionErrorBanner error={error} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Stages</th>
              <th className="px-3 py-2">Done</th>
              <th className="px-3 py-2">Avg days</th>
              <th className="px-3 py-2">Miss rate</th>
              <th className="px-3 py-2">Breaches</th>
              <th className="px-3 py-2">Portal</th>
              <th className="px-3 py-2">Nudges</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, scorecard }) => (
              <tr
                key={member.id}
                className={`border-t border-slate-100 ${member.active ? "" : "text-slate-400"}`}
              >
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-900">{member.name}</span>
                  {member.firm && (
                    <span className="block text-xs text-slate-500">{member.firm}</span>
                  )}
                  {!member.userId && (
                    <span className="block text-xs text-slate-400">no portal login</span>
                  )}
                </td>
                <td className="px-3 py-2">{label(member.roleType)}</td>
                <td className="px-3 py-2">{member.slaDays}d</td>
                <td className="px-3 py-2">{scorecard.stagesAssigned}</td>
                <td className="px-3 py-2">{scorecard.completions}</td>
                <td className="px-3 py-2">{scorecard.avgDaysInStage ?? "—"}</td>
                <td className="px-3 py-2">{percent(scorecard.missRate)}</td>
                <td className="px-3 py-2">{scorecard.breaches}</td>
                <td className="px-3 py-2">{percent(scorecard.participationRate)}</td>
                <td className="px-3 py-2">{scorecard.nudges}</td>
                <td className="px-3 py-2 font-medium">{scorecard.qualityScore}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${RATING_CLASS[scorecard.rating]}`}
                  >
                    {label(scorecard.rating)}
                  </span>
                  {scorecard.recommendReroute && member.active && (
                    <span className="mt-1 block text-xs text-red-700">
                      re-route recommended
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <form
                    action={async () => {
                      await toggle(member.id, !member.active);
                    }}
                  >
                    <button
                      type="submit"
                      className={
                        member.active
                          ? "rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          : "rounded border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      }
                    >
                      {member.active ? "Demote" : "Reinstate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Miss = time-in-stage reached the partner&apos;s SLA; breach = 1.5× SLA
        (same escalation rules as the case banner). Portal = share of assigned
        stages where the partner submitted evidence through the portal.
        Demoted partners keep their history but cannot receive intros.
      </p>
    </div>
  );
}
