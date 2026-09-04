import { Suspense } from "react";
import { REGULATORY_DISCLOSURES } from "@/content/marketing";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <Suspense
          fallback={
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <span className="font-semibold text-slate-900">
                Property Concierge
              </span>
            </nav>
          }
        >
          <MarketingNav />
        </Suspense>
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
