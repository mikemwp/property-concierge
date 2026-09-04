"use client";

import { useState } from "react";
import { warmIntroAction } from "@/app/actions/cockpit";
import type { ActorRole } from "@/domain/types";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";

const PARTNER_OPTIONS: Array<{ value: ActorRole; label: string }> = [
  { value: "MORTGAGE_PARTNER", label: "Mortgage partner" },
  { value: "CONVEYANCER", label: "Conveyancer" },
  { value: "MOVE_PARTNER", label: "Move partner" },
];

type Props = {
  caseId: string;
  enabled: boolean;
};

export function WarmIntroButton({ caseId, enabled }: Props) {
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-medium text-amber-900">Warm intro</h2>
        <p className="mt-1 text-sm text-amber-800">
          Warm intros are available on paid Done-With-You cases only.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Warm intro</h2>
      <p className="mt-1 text-sm text-slate-600">
        Request a manual partner introduction (logged as a stage event).
      </p>
      <ActionErrorBanner error={error} />
      <form
        action={async (formData) => {
          setError(null);
          const partnerType = String(formData.get("partnerType")) as ActorRole;
          const note = String(formData.get("note") ?? "");
          const result = await warmIntroAction(caseId, partnerType, note);
          if (!result.ok) {
            setError(result.error ?? "Warm intro failed");
          }
        }}
        className="mt-4 space-y-3"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Partner</span>
          <select
            name="partnerType"
            defaultValue="MORTGAGE_PARTNER"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {PARTNER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            name="note"
            rows={2}
            placeholder="Context for the partner…"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Request warm intro
        </button>
      </form>
    </div>
  );
}
