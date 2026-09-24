import { postCaseMessageAction } from "@/app/actions/threads";
import type { CaseMessageRecord } from "@/domain/threads";

export function ThreadPanel({
  caseId,
  messages,
  canPost,
}: {
  caseId: string;
  messages: CaseMessageRecord[];
  canPost: boolean;
}) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Case thread</h2>
      <p className="mt-1 text-sm text-slate-600">
        Append-only audit trail for everyone on this case. Refresh to see new
        posts. This is not a live chat.
      </p>
      {messages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No messages yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {messages.map((row) => (
            <li
              key={row.id}
              className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <p className="text-xs text-slate-500">
                {(row.authorName ?? row.authorRole.replace(/_/g, " ")) +
                  " · " +
                  row.authorRole.replace(/_/g, " ") +
                  " · " +
                  new Date(row.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canPost && (
        <form
          action={async (formData) => {
            const body = String(formData.get("body") ?? "");
            await postCaseMessageAction(caseId, body);
          }}
          className="mt-4 flex flex-col gap-2"
        >
          <label className="text-sm font-medium text-slate-800" htmlFor={`thread-body-${caseId}`}>
            Post a message
          </label>
          <textarea
            id={`thread-body-${caseId}`}
            name="body"
            required
            minLength={1}
            maxLength={4000}
            rows={3}
            placeholder="Write to everyone on this case"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800 hover:bg-slate-100"
          >
            Post
          </button>
        </form>
      )}
    </div>
  );
}
