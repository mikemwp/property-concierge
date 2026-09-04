import { PanelTable } from "@/components/PanelTable";
import { loadPanelScorecards } from "@/server/scorecards";

export default async function PanelPage() {
  const rows = await loadPanelScorecards(new Date());
  const active = rows.filter((row) => row.member.active).length;
  const flagged = rows.filter(
    (row) => row.member.active && row.scorecard.recommendReroute,
  ).length;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Partner panel</h1>
      <p className="mt-1 text-sm text-slate-600">
        Curated panel scored from the stage ledger. Speed credibility is earned
        here before any chain-free or hard SLA promise.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Active partners</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {active}
            <span className="text-base font-normal text-slate-500"> / {rows.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Re-route recommended</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{flagged}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Stages attributed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {rows.reduce((sum, row) => sum + row.scorecard.stagesAssigned, 0)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-slate-500">No panel members yet. Run the seed.</p>
      ) : (
        <PanelTable rows={rows} />
      )}
    </section>
  );
}
