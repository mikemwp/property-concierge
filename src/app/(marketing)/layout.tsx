import Link from "next/link";
import { ENTRY_STORIES, REGULATORY_DISCLOSURES } from "@/content/marketing";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="font-semibold text-slate-900">
            Property Concierge
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {ENTRY_STORIES.map((story) => (
              <Link
                key={story.slug}
                href={`/stories/${story.slug}`}
                className="text-slate-600 hover:text-slate-900"
              >
                {story.eyebrow}
              </Link>
            ))}
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-xs text-slate-500">
          {REGULATORY_DISCLOSURES.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </footer>
    </div>
  );
}
