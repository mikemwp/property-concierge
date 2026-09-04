import Link from "next/link";
import { StartForm } from "@/components/marketing/StartForm";
import { FREE_PLAN, PAID_PLAN } from "@/content/marketing";
import { ENTRY_CONTEXTS, type EntryContext } from "@/domain/types";
import { attributionParamsFrom, startHref } from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StartPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const attribution = attributionParamsFrom(resolved);

  const planParam = Array.isArray(resolved.plan) ? resolved.plan[0] : resolved.plan;
  const plan: "free" | "paid" = planParam === "free" ? "free" : "paid";

  const entryParam = Array.isArray(resolved.entry) ? resolved.entry[0] : resolved.entry;
  const entryContext: EntryContext = ENTRY_CONTEXTS.includes(
    entryParam as EntryContext,
  )
    ? (entryParam as EntryContext)
    : "RETURNER_OVERSEAS";

  const chosen = plan === "free" ? FREE_PLAN : PAID_PLAN;

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">{chosen.name}</h1>
      <p className="mt-2 text-slate-600">{chosen.tagline}</p>

      {plan === "free" ? (
        <p className="mt-4 max-w-2xl rounded border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          The free orientation shows you the map and lets you tick off the
          starter stages. When you want the purchase actually run —{" "}
          <Link
            href={startHref({ plan: "paid", entryContext, params: attribution })}
            className="font-semibold underline"
          >
            switch to Done-With-You
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 max-w-2xl space-y-1 text-sm text-slate-700">
          {PAID_PLAN.features.map((feature) => (
            <li key={feature}>• {feature}</li>
          ))}
        </ul>
      )}

      <StartForm
        plan={plan}
        entryContext={entryContext}
        attribution={attribution}
      />
    </div>
  );
}
