"use client";

import { useState } from "react";
import {
  markReferralAction,
  setFeeStatusAction,
} from "@/app/actions/partner-network";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { PanelMember } from "@/domain/panel";
import { FEE_STATUSES, type ReferralRecord } from "@/domain/referral";

type Props = {
  caseId: string;
  referrals: ReferralRecord[];
  panel: PanelMember[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export function ReferralPanel({ caseId, referrals, panel }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
    }
  }

  const active = panel.filter((member) => member.active);

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Referrals & disclosure</h2>
      <p className="mt-1 text-sm text-slate-600">
        Every partner referral is recorded with its disclosure and fee status.
        Fees are recorded here, never paid from this system.
      </p>
      <ActionErrorBanner error={error} />

      {referrals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No referrals on this case yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {referrals.map((referral) => (
            <li
              key={referral.id}
              className={`rounded border px-3 py-2 text-sm ${
                referral.supersededAt
                  ? "border-slate-100 bg-slate-50 text-slate-500"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium text-slate-900">{referral.partnerName}</span>
                  {referral.partnerFirm && ` (${referral.partnerFirm})`}
                  {" · "}
                  {label(referral.partnerRole)}
                  {" · "}
                  {label(referral.source)}
                  {referral.supersededAt && " · superseded"}
                </span>
                <span className="text-xs text-slate-500">
                  disclosed {new Date(referral.disclosedAt).toLocaleDateString("en-GB")}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{referral.disclosureText}</p>
              <form
                action={async (formData) => {
                  const next = String(formData.get("feeStatus") ?? "");
                  await run(() => setFeeStatusAction(caseId, referral.id, next));
                }}
                className="mt-2 flex items-center gap-2"
              >
                <label className="text-xs text-slate-600">
                  Fee status
                  <select
                    name="feeStatus"
                    defaultValue={referral.feeStatus}
                    className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {FEE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {label(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <form
          action={async (formData) => {
            const panelMemberId = String(formData.get("panelMemberId") ?? "");
            const feeStatus = String(formData.get("feeStatus") ?? "EXPECTED");
            await run(() => markReferralAction(caseId, panelMemberId, feeStatus));
          }}
          className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="text-sm font-medium text-slate-700">
              Mark a referral (client chose a panel partner)
            </span>
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
          <label>
            <span className="text-sm font-medium text-slate-700">Fee</span>
            <select
              name="feeStatus"
              defaultValue="EXPECTED"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {FEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Record referral
          </button>
        </form>
      )}
    </div>
  );
}
