"use client";

import { useState } from "react";
import { warmIntroAction } from "@/app/actions/cockpit";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelMember } from "@/domain/panel";

type Props = {
  caseId: string;
  enabled: boolean;
  panel: PanelMember[];
};

function label(role: string): string {
  return role.replace(/_/g, " ").toLowerCase();
}

export function WarmIntroButton({ caseId, enabled, panel }: Props) {
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

  const active = panel.filter((member) => member.active);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Warm intro</h2>
      <p className="mt-1 text-sm text-slate-600">
        Introduce a named panel partner. Logged as a stage event and a disclosed
        referral the client can see.
      </p>
      <ActionErrorBanner error={error} />
      {active.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No active panel members. Reinstate one from the Partner panel.
        </p>
      ) : (
        <form
          action={async (formData) => {
            setError(null);
            const panelMemberId = String(formData.get("panelMemberId") ?? "");
            const note = String(formData.get("note") ?? "");
            const result = await warmIntroAction(caseId, panelMemberId, note);
            if (!result.ok) {
              setError(result.error ?? "Warm intro failed");
            }
          }}
          className="mt-4 space-y-3"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Panel partner</span>
            <select
              name="panelMemberId"
              defaultValue={active[0].id}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {active.map((member) => (
                <option key={member.id} value={member.id}>
                  {label(member.roleType)} — {member.name}
                  {member.firm ? ` (${member.firm})` : ""}
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
      )}
    </div>
  );
}
