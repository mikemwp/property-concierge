"use client";

import { useState } from "react";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PartnerMilestone } from "@/domain/market-packs/types";
import type { PartnerActionResult } from "@/app/actions/partner";

type Props = {
  caseId: string;
  acknowledged: boolean;
  milestones: PartnerMilestone[];
  onAcknowledge: () => Promise<PartnerActionResult>;
  onReportMilestone: (
    milestoneKey: string,
    note?: string,
  ) => Promise<PartnerActionResult>;
};

export function PartnerIntegrationControls({
  caseId,
  acknowledged,
  milestones,
  onAcknowledge,
  onReportMilestone,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<PartnerActionResult>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-emerald-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Integration actions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Acknowledge receipt and report process milestones for case{" "}
        <span className="font-mono text-xs">{caseId}</span>.
      </p>
      <ActionErrorBanner error={error} />

      <div className="mt-4 flex flex-col gap-4">
        <div>
          {acknowledged ? (
            <p className="text-sm text-emerald-700">
              Case acknowledged — no further acknowledgement needed.
            </p>
          ) : (
            <form
              action={async () => {
                await run(onAcknowledge);
              }}
            >
              <button
                type="submit"
                className="rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
              >
                Acknowledge case
              </button>
            </form>
          )}
        </div>

        {milestones.length > 0 && (
          <form
            action={async (formData) => {
              const milestoneKey = String(formData.get("milestoneKey") ?? "");
              const note = String(formData.get("note") ?? "").trim();
              if (!milestoneKey) {
                setError("Select a milestone");
                return;
              }
              await run(() =>
                onReportMilestone(milestoneKey, note || undefined),
              );
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className="text-sm font-medium text-slate-700">
                Report milestone
              </span>
              <select
                name="milestoneKey"
                defaultValue={milestones[0].key}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {milestones.map((milestone) => (
                  <option key={milestone.key} value={milestone.key}>
                    {milestone.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="text-sm font-medium text-slate-700">
                Note (optional)
              </span>
              <input
                name="note"
                type="text"
                placeholder="Additional context"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Report milestone
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
