"use client";

import { useState } from "react";
import {
  issueSellerShareAction,
  revokeSellerShareAction,
} from "@/app/actions/seller-milestones";
import type { AdvisorSellerView } from "@/domain/seller-milestones";

const STATE_LABEL = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  DONE: "done",
} as const;

type Props = {
  caseId: string;
  view: AdvisorSellerView;
  sharePath: string | null;
};

export function SellerMilestonePanel({ caseId, view, sharePath }: Props) {
  const [issueReason, setIssueReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(sharePath);

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Seller milestone view</h2>
      <p className="mt-1 text-sm text-slate-600">
        Read-only buyer-ledger projection. Not a listing and not an introduction.
      </p>
      <p className="mt-2 text-xs uppercase text-slate-500">Share {view.summary.shareStatus}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-700">
        {view.summary.rows.map((row) => (
          <li key={row.key}>
            {row.title}: {STATE_LABEL[row.state]}
          </li>
        ))}
      </ul>
      <label className="mt-4 block text-xs uppercase text-slate-500">
        Advisor export copy
        <textarea
          readOnly
          value={view.exportCopy}
          className="mt-1 h-40 w-full rounded border border-slate-300 p-2 text-sm text-slate-800"
        />
      </label>
      {path && (
        <p className="mt-3 text-sm text-slate-700">
          Live share path: <code>{path}</code>
        </p>
      )}
      {view.canIssueShare && (
        <form
          className="mt-4 space-y-2"
          action={async (formData) => {
            const result = await issueSellerShareAction(
              caseId,
              String(formData.get("reason") ?? ""),
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            setPath(result.sharePath);
            setIssueReason("");
          }}
        >
          <input
            name="reason"
            value={issueReason}
            onChange={(event) => setIssueReason(event.target.value)}
            placeholder="Why share this snapshot?"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
          >
            Issue share link
          </button>
        </form>
      )}
      {view.canRevokeShare && (
        <form
          className="mt-4 space-y-2"
          action={async (formData) => {
            const result = await revokeSellerShareAction(
              caseId,
              String(formData.get("reason") ?? ""),
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            setPath(null);
            setRevokeReason("");
          }}
        >
          <input
            name="reason"
            value={revokeReason}
            onChange={(event) => setRevokeReason(event.target.value)}
            placeholder="Why revoke this share?"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1 text-sm"
          >
            Revoke share link
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
