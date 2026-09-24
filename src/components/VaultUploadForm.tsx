"use client";

import { useState } from "react";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";

type Row = {
  kind: string;
  hasActiveDocument: boolean;
  onUploadAndSubmit: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onSubmitOnly: () => Promise<{ ok: boolean; error?: string }>;
};

function VaultKindRow({ kind, hasActiveDocument, onUploadAndSubmit, onSubmitOnly }: Row) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <ActionErrorBanner error={error} />
      <form
        action={async (formData) => {
          setError(null);
          const result = hasActiveDocument
            ? await onSubmitOnly()
            : await onUploadAndSubmit(formData);
          if (!result.ok) {
            setError(result.error ?? "Upload failed");
          }
        }}
        className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="text-sm font-medium text-slate-700">{kind.replace(/_/g, " ")}</span>
        <div className="flex items-center gap-2">
          {!hasActiveDocument && (
            <input
              type="file"
              name="file"
              required
              className="text-sm text-slate-600"
            />
          )}
          {hasActiveDocument && (
            <span className="text-xs text-slate-500">File attached — cannot replace</span>
          )}
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            {hasActiveDocument ? "Submit" : "Upload and submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function VaultUploadForm({
  rows,
  awaitingKinds = [],
}: {
  rows: Row[];
  awaitingKinds?: string[];
}) {
  if (rows.length === 0 && awaitingKinds.length === 0) {
    return (
      <p className="text-sm text-emerald-700">All required evidence submitted for this stage.</p>
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
      {rows.map((row) => (
        <VaultKindRow key={row.kind} {...row} />
      ))}
    </div>
  );
}
