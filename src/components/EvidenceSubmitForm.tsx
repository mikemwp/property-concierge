"use client";

type Props = {
  action: (formData: FormData) => Promise<void>;
  kind: string;
};

export function EvidenceKindRow({ action, kind }: Props) {
  return (
    <form
      action={action}
      className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2"
    >
      <input type="hidden" name="kind" value={kind} />
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
  );
}

type FormProps = {
  rows: Array<{ kind: string; action: (formData: FormData) => Promise<void> }>;
};

export function EvidenceSubmitForm({ rows }: FormProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-emerald-700">
        All required evidence submitted for this stage.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ kind, action }) => (
        <EvidenceKindRow key={kind} kind={kind} action={action} />
      ))}
    </div>
  );
}
