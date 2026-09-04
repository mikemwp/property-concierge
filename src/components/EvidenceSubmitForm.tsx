"use client";

import { useState } from "react";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";

type RowProps = {
  kind: string;
  onSubmit: () => Promise<{ ok: boolean; error?: string }>;
};

function EvidenceKindRow({ kind, onSubmit }: RowProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <ActionErrorBanner error={error} />
      <form
        action={async () => {
          setError(null);
          const result = await onSubmit();
          if (!result.ok) {
            setError(result.error ?? "Submit failed");
          }
        }}
        className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2"
      >
        <span className="text-sm font-medium text-slate-700">
          {kind.replace(/_/g, " ")}
        </span>
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

type FormProps = {
  rows: Array<{
    kind: string;
    onSubmit: () => Promise<{ ok: boolean; error?: string }>;
  }>;
  awaitingKinds?: string[];
};

export function EvidenceSubmitForm({ rows, awaitingKinds = [] }: FormProps) {
  if (rows.length === 0 && awaitingKinds.length === 0) {
    return (
      <p className="text-sm text-emerald-700">
        All required evidence submitted for this stage.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {awaitingKinds.map((kind) => (
        <p
          key={kind}
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {kind.replace(/_/g, " ")} — submitted, awaiting advisor acceptance
        </p>
      ))}
      {rows.map(({ kind, onSubmit }) => (
        <EvidenceKindRow key={kind} kind={kind} onSubmit={onSubmit} />
      ))}
    </div>
  );
}
