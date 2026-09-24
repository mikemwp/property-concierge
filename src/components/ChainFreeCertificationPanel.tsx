"use client";

import { useState } from "react";
import {
  certifyChainFreeAction,
  markChainFreeIneligibleAction,
  resetChainFreeAction,
} from "@/app/actions/chain-free";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { AdvisorCertificationView } from "@/domain/chain-free";

type Props = {
  caseId: string;
  view: AdvisorCertificationView;
};

const BADGE: Record<AdvisorCertificationView["status"], string> = {
  NOT_ASSESSED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-900",
  CERTIFIED: "bg-emerald-100 text-emerald-900",
  INELIGIBLE: "bg-rose-100 text-rose-900",
};

export function ChainFreeCertificationPanel({ caseId, view }: Props) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-slate-900">Chain-free certification</h2>
        <span className={`rounded px-2 py-1 text-xs font-medium ${BADGE[view.status]}`}>
          {view.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Derived from the stage ledger and partner scorecards. Not a star rating, not a
        seller listing, and not a completion date.
      </p>
      <ActionErrorBanner error={error} />
      <ul className="space-y-2 text-sm">
        {view.criteria.map((row) => (
          <li key={row.key} className="flex gap-2">
            <span className={row.met ? "text-emerald-700" : "text-slate-500"}>
              {row.met ? "Met" : "Open"}
            </span>
            <span className="text-slate-800">{row.label}</span>
          </li>
        ))}
      </ul>
      {view.override && (
        <p className="text-xs text-slate-500">
          Last override: {view.override.action.toLowerCase()} — {view.override.reason}
        </p>
      )}
      {view.canCertify && (
        <form
          action={async (formData) => {
            await run(() =>
              certifyChainFreeAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Certify reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Certify chain-free
          </button>
        </form>
      )}
      {view.canMarkIneligible && (
        <form
          action={async (formData) => {
            await run(() =>
              markChainFreeIneligibleAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Ineligible reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
          >
            Mark ineligible
          </button>
        </form>
      )}
      {view.canReset && (
        <form
          action={async (formData) => {
            await run(() =>
              resetChainFreeAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Reset reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Reset certification
          </button>
        </form>
      )}
    </div>
  );
}
