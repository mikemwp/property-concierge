import { PlanCards } from "@/components/marketing/PlanCards";
import { attributionParamsFrom } from "@/lib/marketing-links";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PricingPage({ searchParams }: Props) {
  const params = attributionParamsFrom(await searchParams);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">
        What you get, and what you do yourself
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Done-With-You is the product: a named advisor, warm partner
        introductions, and someone chasing the blocker. The free orientation
        exists so you can see the shape of the job before you decide.
      </p>
      <PlanCards params={params} />
    </div>
  );
}
