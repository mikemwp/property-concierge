import Link from "next/link";
import { auth } from "@/lib/auth";
import { listCasesForUser } from "@/server/cases";

export default async function CockpitCasesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const cases = await listCasesForUser(userId);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
      <p className="mt-1 text-sm text-slate-600">
        Advance stages, accept evidence, and request warm intros.
      </p>

      {cases.length === 0 ? (
        <p className="mt-6 text-slate-500">No cases assigned.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cockpit/cases/${c.id}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="font-medium text-slate-900">{c.title}</span>
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {c.tier === "FREE_DIY" ? "Free DIY" : "Paid DWY"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
