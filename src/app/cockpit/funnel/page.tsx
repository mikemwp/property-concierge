import { summariseFunnel, VALIDATION_TARGET_HOUSEHOLDS } from "@/domain/funnel";
import { listFunnelRows } from "@/server/cases";

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export default async function FunnelPage() {
  const summary = summariseFunnel(await listFunnelRows());

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">
        Validation funnel
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Evidence for the two v1 goals: households through the real workflow, and
        traction inside diaspora communities.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Paid households</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.paidCases}
            <span className="text-base font-normal text-slate-500">
              {" "}
              / {VALIDATION_TARGET_HOUSEHOLDS}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.validationTargetMet
              ? "Validation target met"
              : "Below validation target"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Paid conversion</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {Math.round(summary.paidConversionRate * 100)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.freeCases} free · {summary.totalCases} total
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Diaspora-sourced</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.diasporaCases}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.diasporaPaidCases} of them paid
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Distinct sources</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.bySource.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aim for depth in 1–2 communities, not spread
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium text-slate-900">By lead source</h2>
          <ul className="mt-3 space-y-2">
            {summary.bySource.map((row) => (
              <li
                key={row.leadSource}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{label(row.leadSource)}</span>
                <span className="text-slate-900">
                  {row.paid} paid / {row.total}
                </span>
              </li>
            ))}
            {summary.bySource.length === 0 && (
              <li className="text-sm text-slate-500">No cases yet.</li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-medium text-slate-900">
            By entry context
          </h2>
          <ul className="mt-3 space-y-2">
            {summary.byEntryContext.map((row) => (
              <li
                key={row.entryContext}
                className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{label(row.entryContext)}</span>
                <span className="text-slate-900">
                  {row.paid} paid / {row.total}
                </span>
              </li>
            ))}
            {summary.byEntryContext.length === 0 && (
              <li className="text-sm text-slate-500">No cases yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
