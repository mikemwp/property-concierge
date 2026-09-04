import type { ReferralRecord } from "@/domain/referral";

type Props = {
  referrals: ReferralRecord[];
};

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

/** Client-facing disclosure. Spec §7: conveyancing referrals lawful if disclosed; mortgage introducer only. */
export function ReferralDisclosure({ referrals }: Props) {
  const live = referrals.filter((referral) => referral.supersededAt === null);
  if (live.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Your introduced partners</h2>
      <p className="mt-1 text-sm text-slate-600">
        How we are paid when we introduce a partner. You are always free to use
        someone else.
      </p>
      <ul className="mt-3 space-y-3">
        {live.map((referral) => (
          <li
            key={referral.id}
            className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
          >
            <p className="font-medium text-slate-900">
              {referral.partnerName}
              {referral.partnerFirm && ` (${referral.partnerFirm})`}
              <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">
                {label(referral.partnerRole)}
              </span>
            </p>
            <p className="mt-1 text-slate-700">{referral.disclosureText}</p>
            <p className="mt-1 text-xs text-slate-500">
              Disclosed {new Date(referral.disclosedAt).toLocaleDateString("en-GB")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
