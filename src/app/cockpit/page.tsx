import Link from "next/link";

export default function CockpitHomePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">
        Advisor dashboard
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage cases, advance stages, and request partner warm intros.
      </p>
      <Link
        href="/cockpit/cases"
        className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        View all cases
      </Link>
    </section>
  );
}
