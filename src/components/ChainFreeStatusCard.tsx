type Props = {
  headline: string;
  body: string;
};

export function ChainFreeStatusCard({ headline, body }: Props) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">{headline}</h2>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
