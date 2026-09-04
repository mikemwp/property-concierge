type Props = {
  limitedCount: number;
};

export function UpgradeCallout({ limitedCount }: Props) {
  return (
    <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
      <p className="font-medium text-violet-900">Upgrade to Done-With-You</p>
      <p className="mt-1 text-sm text-violet-800">
        {limitedCount} stage{limitedCount === 1 ? "" : "s"} show limited detail on
        the free plan. Paid unlocks named owners, SLA pressure, evidence vault, and
        warm partner intros.
      </p>
      <p className="mt-2 text-sm font-medium text-violet-700">
        Contact your advisor to upgrade →
      </p>
    </div>
  );
}
