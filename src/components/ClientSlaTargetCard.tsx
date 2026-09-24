type CarveOut = {
  key: string;
  label: string;
};

type Props = {
  headline: string;
  body: string;
  targetDate: string;
  carveOuts: CarveOut[];
};

export function ClientSlaTargetCard({ headline, body, targetDate, carveOuts }: Props) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">{headline}</h2>
      <p className="mt-1 text-sm font-medium text-slate-800">{targetDate}</p>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {carveOuts.map((row) => (
          <li key={row.key}>{row.label}</li>
        ))}
      </ul>
    </div>
  );
}
