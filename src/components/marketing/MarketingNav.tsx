"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ENTRY_STORIES } from "@/content/marketing";
import { attributionParamsFrom, withAttribution } from "@/lib/marketing-links";

export function MarketingNav() {
  const searchParams = useSearchParams();
  const attribution = attributionParamsFrom({
    utm_source: searchParams.get("utm_source") ?? undefined,
    utm_medium: searchParams.get("utm_medium") ?? undefined,
    utm_campaign: searchParams.get("utm_campaign") ?? undefined,
    ref: searchParams.get("ref") ?? undefined,
  });

  return (
    <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Link
        href={withAttribution("/", attribution)}
        className="font-semibold text-slate-900"
      >
        Property Concierge
      </Link>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {ENTRY_STORIES.map((story) => (
          <Link
            key={story.slug}
            href={withAttribution(`/stories/${story.slug}`, attribution)}
            className="text-slate-600 hover:text-slate-900"
          >
            {story.eyebrow}
          </Link>
        ))}
        <Link
          href={withAttribution("/pricing", attribution)}
          className="text-slate-600 hover:text-slate-900"
        >
          Pricing
        </Link>
        <Link href="/login" className="text-slate-600 hover:text-slate-900">
          Sign in
        </Link>
      </div>
    </nav>
  );
}
