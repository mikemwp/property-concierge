"use client";

import { useState } from "react";
import {
  amendClientSlaAction,
  publishClientSlaAction,
  withdrawClientSlaAction,
} from "@/app/actions/client-sla";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type { AdvisorSlaView } from "@/domain/client-sla";

type Props = {
  caseId: string;
  view: AdvisorSlaView;
};

const BADGE: Record<AdvisorSlaView["status"], string> = {
  UNPUBLISHED: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  AMENDED: "bg-amber-100 text-amber-900",
  WITHDRAWN: "bg-rose-100 text-rose-900",
};

export function ClientSlaPublishPanel({ caseId, view }: Props) {
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
        <h2 className="text-lg font-medium text-slate-900">Published target timeline</h2>
        <span className={`rounded px-2 py-1 text-xs font-medium ${BADGE[view.status]}`}>
          {view.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Advisor-published target we are working toward, subject to carve-outs. Not a
        marketing promise of a completion date.
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
      {view.publication && (
        <p className="text-xs text-slate-500">
          Last action: {view.publication.action.toLowerCase()}
          {view.publication.targetDate ? ` · ${view.publication.targetDate}` : ""} —{" "}
          {view.publication.reason}
        </p>
      )}
      <div>
        <h3 className="text-sm font-medium text-slate-800">Standard carve-outs</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {view.carveOuts.map((row) => (
            <li key={row.key}>{row.label}</li>
          ))}
        </ul>
      </div>
      {view.canPublish && (
        <form
          action={async (formData) => {
            await run(() =>
              publishClientSlaAction(
                caseId,
                String(formData.get("targetDate") ?? ""),
                String(formData.get("reason") ?? ""),
              ),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Target date
            <input
              name="targetDate"
              type="date"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Publish reason
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
            Publish target
          </button>
        </form>
      )}
      {view.canAmend && (
        <form
          action={async (formData) => {
            await run(() =>
              amendClientSlaAction(
                caseId,
                String(formData.get("targetDate") ?? ""),
                String(formData.get("reason") ?? ""),
              ),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Amended target date
            <input
              name="targetDate"
              type="date"
              required
              defaultValue={view.publication?.targetDate ?? ""}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Amend reason
            <input
              name="reason"
              required
              minLength={8}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Amend target
          </button>
        </form>
      )}
      {view.canWithdraw && (
        <form
          action={async (formData) => {
            await run(() =>
              withdrawClientSlaAction(caseId, String(formData.get("reason") ?? "")),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Withdraw reason
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
            Withdraw target
          </button>
        </form>
      )}
    </div>
  );
}
