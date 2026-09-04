"use client";

import { useState } from "react";
import {
  acceptEvidenceAction,
  advanceAction,
  blockAction,
  resumeAction,
} from "@/app/actions/cockpit";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";

type Props = {
  caseId: string;
  stageKey: string;
  awaitingAcceptanceKinds: string[];
  canAdvance: boolean;
  isBlocked: boolean;
};

export function AdvisorStageControls({
  caseId,
  stageKey,
  awaitingAcceptanceKinds,
  canAdvance,
  isBlocked,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Stage controls</h2>
      <ActionErrorBanner error={error} />

      {awaitingAcceptanceKinds.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">
            Accept submitted evidence
          </h3>
          <ul className="space-y-2">
            {awaitingAcceptanceKinds.map((kind) => (
              <li key={kind}>
                <form
                  action={async () => {
                    await runAction(() =>
                      acceptEvidenceAction(caseId, stageKey, kind),
                    );
                  }}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {kind.replace(/_/g, " ")}
                    <span className="ml-2 text-xs font-normal text-amber-700">
                      awaiting acceptance
                    </span>
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

      {awaitingAcceptanceKinds.length === 0 && (
        <p className="text-sm text-emerald-700">
          No evidence awaiting acceptance for this stage.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {isBlocked ? (
          <form
            action={async () => {
              await runAction(() => resumeAction(caseId));
            }}
          >
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Resume stage
            </button>
          </form>
        ) : (
          <form
            action={async () => {
              await runAction(() => advanceAction(caseId));
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
        )}
      </div>

      {!isBlocked && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Block stage</h3>
          <form
            action={async (formData) => {
              const reason = String(formData.get("reason") ?? "");
              await runAction(() => blockAction(caseId, reason));
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
      )}
    </div>
  );
}
