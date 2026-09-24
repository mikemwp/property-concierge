/**
 * Public share surface — copy comes from sellerFacingCopy (headline
 * "Buyer progress on this purchase"; body notes this is not an introduction).
 */
import type { SellerFacingCopy, SellerMilestoneRow } from "@/domain/seller-milestones";

const STATE_LABEL = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  DONE: "done",
} as const;

type Props = {
  copy: SellerFacingCopy;
  rows: SellerMilestoneRow[];
};

export function SellerMilestoneShareCard({ copy, rows }: Props) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">{copy.headline}</h1>
      <p className="mt-3 text-sm text-slate-600">{copy.body}</p>
      <ul className="mt-6 space-y-2 text-sm text-slate-800">
        {rows.map((row) => (
          <li key={row.key} className="flex justify-between border-b border-slate-100 py-2">
            <span>{row.title}</span>
            <span className="text-slate-500">{STATE_LABEL[row.state]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
