import Link from "next/link";
import type { DirectoryEntry } from "@/domain/panel";

type Props = {
  entries: DirectoryEntry[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

/** Spec §5: Free DIY gets a "Partner directory (not warm intro)". Names and categories only. */
export function PartnerDirectory({ entries }: Props) {
  const byRole = new Map<string, DirectoryEntry[]>();
  for (const entry of entries) {
    const list = byRole.get(entry.roleType) ?? [];
    list.push(entry);
    byRole.set(entry.roleType, list);
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Partner directory</h2>
      <p className="mt-1 text-sm text-slate-600">
        Our curated England &amp; Wales panel. On Done-With-You your advisor makes
        the introduction, stays in the thread, and chases on your behalf.
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Directory coming soon.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[...byRole.entries()].map(([roleType, list]) => (
            <div key={roleType}>
              <p className="text-xs uppercase text-slate-500">{label(roleType)}</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-800">
                {list.map((entry) => (
                  <li key={`${roleType}-${entry.name}`}>
                    {entry.name}
                    {entry.firm && (
                      <span className="text-slate-500"> · {entry.firm}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Link
        href="/pricing"
        className="mt-4 inline-block rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
      >
        Upgrade for a warm introduction
      </Link>
    </div>
  );
}
