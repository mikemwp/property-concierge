"use client";

import { useState } from "react";
import {
  nudgePartnerAction,
  reroutePartnerAction,
} from "@/app/actions/partner-network";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelMember } from "@/domain/panel";
import type { ActorRole } from "@/domain/types";

type Props = {
  caseId: string;
  paid: boolean;
  focusOwnerRole: ActorRole | null;
  currentPartner: { id: string; name: string } | null;
  rerouteOptions: PanelMember[];
  unacknowledgedPartner?: boolean;
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export function PartnerOpsControls({
  caseId,
  paid,
  focusOwnerRole,
  currentPartner,
  rerouteOptions,
  unacknowledgedPartner = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  if (!focusOwnerRole) {
    return null;
  }

  const options = rerouteOptions.filter(
    (member) => member.active && member.id !== currentPartner?.id,
  );

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Partner ops</h2>
      <p className="mt-1 text-sm text-slate-600">
        Focus stage is owned by <span className="font-medium">{label(focusOwnerRole)}</span>
        {currentPartner ? ` — ${currentPartner.name}` : " — no named partner yet"}.
        Non-response: nudge (scorecard hit), then re-route.
      </p>
      <ActionErrorBanner error={error} />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {unacknowledgedPartner && (
            <span className="rounded bg-amber-200 px-2 py-1 text-xs font-medium text-amber-900">
              Partner has not acknowledged this case
            </span>
          )}
          <form
            action={async () => {
              await run(() => nudgePartnerAction(caseId));
            }}
          >
            <button
              type="submit"
              className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Nudge partner
            </button>
          </form>
        </div>

        {paid ? (
          options.length > 0 ? (
            <form
              action={async (formData) => {
                const panelMemberId = String(formData.get("panelMemberId") ?? "");
                await run(() => reroutePartnerAction(caseId, panelMemberId));
              }}
              className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
            >
              <label className="flex-1">
                <span className="text-sm font-medium text-slate-700">Re-route to</span>
                <select
                  name="panelMemberId"
                  defaultValue={options[0].id}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {options.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.firm ? ` (${member.firm})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Re-route
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">
              No other active panel member for this role.
            </p>
          )
        ) : (
          <p className="text-sm text-amber-800">
            Re-route is a paid Done-With-You control.
          </p>
        )}
      </div>
    </div>
  );
}
