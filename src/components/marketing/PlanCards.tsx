import Link from "next/link";
import { PLAN_ORDER } from "@/content/marketing";
import type { RawAttributionParams } from "@/domain/attribution";
import type { EntryContext } from "@/domain/types";
import { startHref } from "@/lib/marketing-links";

type Props = {
  params: RawAttributionParams;
  entryContext?: EntryContext;
};

export function PlanCards({ params, entryContext }: Props) {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      {PLAN_ORDER.map((plan) => (
        <div
          key={plan.slug}
          className={
            plan.primary
              ? "rounded-xl border-2 border-indigo-500 bg-white p-6 shadow-sm"
              : "rounded-xl border border-slate-200 bg-white p-6"
          }
        >
          {plan.primary && (
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
              Recommended
            </span>
          )}
          <h3 className="mt-3 text-xl font-semibold text-slate-900">
            {plan.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
          <p className="mt-3 text-sm font-medium text-slate-900">{plan.price}</p>

          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {plan.features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>

          {plan.limits.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
              {plan.limits.map((limit) => (
                <li key={limit}>– {limit}</li>
              ))}
            </ul>
          )}

          <Link
            href={startHref({ plan: plan.slug, entryContext, params })}
            className={
              plan.primary
                ? "mt-6 block rounded bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                : "mt-6 block rounded border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            {plan.ctaLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}
