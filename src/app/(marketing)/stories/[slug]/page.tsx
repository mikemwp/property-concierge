import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanCards } from "@/components/marketing/PlanCards";
import { ENTRY_STORIES, storyBySlug } from "@/content/marketing";
import { attributionParamsFrom, startHref } from "@/lib/marketing-links";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return ENTRY_STORIES.map((story) => ({ slug: story.slug }));
}

export default async function StoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const story = storyBySlug(slug);
  if (!story) {
    notFound();
  }

  const attribution = attributionParamsFrom(await searchParams);

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
        {story.eyebrow}
      </span>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-900">
        {story.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">{story.subhead}</p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium text-slate-900">
            What we take off you
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {story.proofPoints.map((point) => (
              <li key={point}>• {point}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-medium text-slate-900">
            Your first three moves
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            {story.firstMoves.map((move, index) => (
              <li key={move}>
                {index + 1}. {move}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Link
        href={startHref({
          plan: "paid",
          entryContext: story.entryContext,
          params: attribution,
        })}
        className="mt-8 inline-block rounded bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Start Done-With-You
      </Link>

      <PlanCards params={attribution} entryContext={story.entryContext} />
    </div>
  );
}
