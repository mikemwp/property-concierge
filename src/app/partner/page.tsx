import Link from "next/link";
import { auth } from "@/lib/auth";
import { isPartnerRole } from "@/server/partner-policy";
import { listCasesForPartnerRole } from "@/server/cases";
import type { ActorRole } from "@/domain/types";

export default async function PartnerHomePage() {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  const userId = session?.user?.id;
  if (!userId || !role || !isPartnerRole(role)) {
    return null;
  }

  const cases = await listCasesForPartnerRole(userId, role);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Assigned stages</h1>
      <p className="mt-1 text-sm text-slate-600">
        Cases where the current focus stage is owned by{" "}
        {role.replace(/_/g, " ").toLowerCase()}.
      </p>

      {cases.length === 0 ? (
        <p className="mt-6 text-slate-500">
          No cases assigned to your role right now.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/partner/cases/${c.id}`}
                className="block rounded-lg border border-emerald-200 bg-white px-4 py-3 hover:border-emerald-400 hover:bg-emerald-50"
              >
                <span className="font-medium text-slate-900">{c.title}</span>
                <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  {c.focusStageKey.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
