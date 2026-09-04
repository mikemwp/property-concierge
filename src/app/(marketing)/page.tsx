import Link from "next/link";
import { PlanCards } from "@/components/marketing/PlanCards";
import { ENTRY_STORIES, HERO } from "@/content/marketing";
import { attributionParamsFrom, startHref } from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarketingHomePage({ searchParams }: Props) {
  const params = attributionParamsFrom(await searchParams);

  return (
    <div>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900">
        {HERO.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">{HERO.subhead}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={startHref({ plan: "paid", params })}
          className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {HERO.primaryCta}
        </Link>
        <Link
          href={startHref({ plan: "free", params })}
          className="rounded border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {HERO.secondaryCta}
        </Link>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-slate-900">
          Where are you starting from?
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ENTRY_STORIES.map((story) => (
            <Link
              key={story.slug}
              href={`/stories/${story.slug}`}
              className="rounded-lg border border-slate-200 p-5 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {story.eyebrow}
              </span>
              <h3 className="mt-2 font-medium text-slate-900">
                {story.headline}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{story.subhead}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-slate-900">
          Two ways in. Only one of them runs the purchase for you.
        </h2>
        <PlanCards params={params} />
      </section>
    </div>
  );
}
