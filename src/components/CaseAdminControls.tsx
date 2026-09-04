"use client";

import { useState } from "react";
import {
  setEntryContextAction,
  upgradeCaseAction,
} from "@/app/actions/case-admin";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { EntryContext, Tier } from "@/domain/types";

type Props = {
  caseId: string;
  tier: Tier;
  entryContext: EntryContext;
  entryLocked: boolean;
  leadSource: string;
};

const ENTRY_OPTIONS: Array<{ value: EntryContext; label: string }> = [
  { value: "RETURNER_OVERSEAS", label: "Returner — still overseas" },
  { value: "RETURNER_IN_UK", label: "Returner — already in the UK" },
  { value: "UK_RESIDENT_SPEED", label: "UK resident — speed seeker" },
];

export function CaseAdminControls({
  caseId,
  tier,
  entryContext,
  entryLocked,
  leadSource,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  return (
    <div className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Case admin</h2>
      <ActionErrorBanner error={error} />

      <p className="text-sm text-slate-600">
        Lead source:{" "}
        <span className="font-medium text-slate-900">
          {leadSource.replace(/_/g, " ").toLowerCase()}
        </span>
      </p>

      {tier === "FREE_DIY" ? (
        <form
          action={async () => {
            await run(() => upgradeCaseAction(caseId));
          }}
        >
          <button
            type="submit"
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Upgrade to Done-With-You
          </button>
        </form>
      ) : (
        <p className="text-sm text-emerald-700">
          On the paid Done-With-You tier.
        </p>
      )}

      <form
        action={async (formData) => {
          const next = String(formData.get("entryContext") ?? "");
          await run(() => setEntryContextAction(caseId, next));
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex-1">
          <span className="text-sm font-medium text-slate-700">
            Entry context
          </span>
          <select
            name="entryContext"
            defaultValue={entryContext}
            disabled={entryLocked}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            {ENTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={entryLocked}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save entry context
        </button>
      </form>

      {entryLocked && (
        <p className="text-xs text-slate-500">
          Entry context is locked once the offer stage has started.
        </p>
      )}
    </div>
  );
}
