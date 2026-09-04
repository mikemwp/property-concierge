"use client";

import {
  acceptEvidenceAction,
  advanceAction,
  blockAction,
} from "@/app/actions/cockpit";

type Props = {
  caseId: string;
  stageKey: string;
  pendingEvidenceKinds: string[];
  canAdvance: boolean;
};

export function AdvisorStageControls({
  caseId,
  stageKey,
  pendingEvidenceKinds,
  canAdvance,
}: Props) {
  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Stage controls</h2>

      {pendingEvidenceKinds.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">
            Accept evidence
          </h3>
          <ul className="space-y-2">
            {pendingEvidenceKinds.map((kind) => (
              <li key={kind}>
                <form
                  action={async () => {
                    await acceptEvidenceAction(caseId, stageKey, kind);
                  }}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {kind.replace(/_/g, " ")}
                  </span>
                  <button
                    type="submit"
                    className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Accept
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingEvidenceKinds.length === 0 && (
        <p className="text-sm text-emerald-700">
          All required evidence accepted for this stage.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <form
          action={async () => {
            await advanceAction(caseId);
          }}
        >
          <button
            type="submit"
            disabled={!canAdvance}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Advance stage
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">Block stage</h3>
        <form
          action={async (formData) => {
            const reason = String(formData.get("reason") ?? "");
            await blockAction(caseId, reason);
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="sr-only">Block reason</span>
            <input
              name="reason"
              type="text"
              required
              placeholder="Reason for blocking…"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Block
          </button>
        </form>
      </div>
    </div>
  );
}
