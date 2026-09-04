import { notFound } from "next/navigation";
import { marketPackSummary } from "@/domain/market-packs/inspector";
import {
  DEFAULT_MARKET_PACK_ID,
  findMarketPack,
  listMarketPacks,
} from "@/domain/market-packs/registry";
import { ENTRY_CONTEXTS, type EntryContext } from "@/domain/types";
import { auth } from "@/lib/auth";
import { assertPackInspectorVisible } from "@/server/cockpit-policy";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MarketPacksPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    notFound();
  }
  assertPackInspectorVisible("ADVISOR");

  const resolved = await searchParams;
  const packId = single(resolved.pack) ?? DEFAULT_MARKET_PACK_ID;
  const entryParam = single(resolved.entry) as EntryContext | undefined;
  const entry: EntryContext =
    entryParam && ENTRY_CONTEXTS.includes(entryParam) ? entryParam : "RETURNER_OVERSEAS";

  const packs = listMarketPacks();
  const selected = findMarketPack(packId) ?? findMarketPack(DEFAULT_MARKET_PACK_ID)!;
  const summary = marketPackSummary(selected, entry);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Market packs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Read-only configuration. The stage engine is country-agnostic; everything on
        this page is pack data resolved from <code>case.marketPackId</code>.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {packs.map((pack) => (
          <a
            key={pack.id}
            href={`/cockpit/market-packs?pack=${pack.id}&entry=${entry}`}
            className={`rounded border px-3 py-1 text-sm ${
              pack.id === summary.id
                ? "border-slate-900 bg-slate-900 text-slate-50"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {pack.id} · {pack.name}
            <span className="ml-2 text-xs">{pack.enabled ? "active" : "disabled"}</span>
          </a>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ENTRY_CONTEXTS.map((value) => (
          <a
            key={value}
            href={`/cockpit/market-packs?pack=${summary.id}&entry=${value}`}
            className={`rounded border px-3 py-1 text-xs ${
              value === summary.entryContext
                ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {value.replace(/_/g, " ").toLowerCase()}
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Jurisdiction",
            value: summary.jurisdiction,
            note: summary.enabled
              ? "Enabled — may back live cases"
              : "Disabled — fails closed",
          },
          {
            label: "Locale",
            value: `${summary.locale.bcp47} · ${summary.locale.currencyCode}`,
            note: `address: ${summary.locale.addressFieldKeys.join(", ")}`,
          },
          {
            label: "Evidence kinds",
            value: String(summary.evidenceKinds.length),
            note: summary.evidenceKinds.join(", ") || "none yet",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <p className="text-xs uppercase text-slate-500">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.note}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-medium text-slate-900">Modules</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {summary.modules.map((module) => (
          <li
            key={module.key}
            className={`rounded px-2 py-1 text-xs ${
              module.enabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {module.key} · {module.enabled ? "on" : "off"}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-medium text-slate-900">
        Stage template ({summary.stages.length})
      </h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Required evidence</th>
              <th className="px-3 py-2">Free</th>
            </tr>
          </thead>
          <tbody>
            {summary.stages.map((stage) => (
              <tr key={stage.key} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-900">
                  {stage.title}
                  <span className="block text-xs text-slate-500">{stage.key}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {summary.partnerRoleLabels.find((r) => r.role === stage.ownerRole)?.label ??
                    stage.ownerRole}
                </td>
                <td className="px-3 py-2 text-slate-700">{stage.slaDays}d</td>
                <td className="px-3 py-2 text-slate-700">
                  {stage.requiredEvidenceKinds.join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {stage.freeVisible ? "visible" : "hidden"}
                  {stage.freeCanSelfAdvance ? " · self-advance" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-medium text-slate-900">Jurisdiction copy</h2>
      <dl className="mt-2 space-y-2">
        {summary.copy.map((row) => (
          <div key={row.key} className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs uppercase text-slate-500">{row.key}</dt>
            <dd className="mt-1 text-sm text-slate-800">{row.text}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-xs text-slate-500">
        Playbooks exist for {summary.playbookStageKeys.length} of {summary.stages.length}{" "}
        stages. Playbook detail renders only on a case page.
      </p>
    </section>
  );
}
