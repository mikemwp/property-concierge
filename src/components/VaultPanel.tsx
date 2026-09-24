import { resetVaultDocumentAction } from "@/app/actions/vault";
import type { VaultDocumentRecord } from "@/domain/vault";

export function VaultPanel({
  caseId,
  documents,
  canReset,
}: {
  caseId: string;
  documents: VaultDocumentRecord[];
  canReset: boolean;
}) {
  if (documents.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-medium text-slate-900">Document vault</h2>
        <p className="mt-2 text-sm text-slate-600">No documents in the vault for this view.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Document vault</h2>
      <p className="mt-1 text-sm text-slate-600">
        One file per evidence kind. Replacement requires an advisor reset.
      </p>
      <ul className="mt-4 space-y-3">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{doc.originalFilename}</p>
                <p className="text-xs text-slate-500">
                  {doc.stageKey.replace(/_/g, " ")} · {doc.evidenceKind.replace(/_/g, " ")} ·{" "}
                  {doc.status} · {doc.uploadedByRole.replace(/_/g, " ")}
                </p>
              </div>
              <a
                href={`/api/vault/${doc.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Download
              </a>
            </div>
            {canReset && doc.status === "ACTIVE" && (
              <form
                action={async (formData) => {
                  const reason = String(formData.get("reason") ?? "");
                  await resetVaultDocumentAction(caseId, doc.id, reason);
                }}
                className="mt-2 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  name="reason"
                  required
                  minLength={8}
                  placeholder="Reason for reset"
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800 hover:bg-slate-100"
                >
                  Reset
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
