import type { PublicStageView } from "@/domain/freemium";

const statusStyles: Record<string, string> = {
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ACTIVE: "bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-400",
  BLOCKED: "bg-red-100 text-red-800 border-red-200",
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
  SKIPPED: "bg-slate-50 text-slate-400 border-slate-200",
};

function formatRole(role: string | null): string {
  if (!role) return "—";
  return role.replace(/_/g, " ").toLowerCase();
}

type Props = {
  stages: PublicStageView[];
};

export function StageTimeline({ stages }: Props) {
  return (
    <ol className="space-y-2">
      {stages.map((stage, index) => (
        <li
          key={stage.key}
          className={`rounded-lg border px-4 py-3 ${
            stage.isCurrent
              ? "border-blue-400 bg-blue-50 shadow-sm"
              : "border-slate-200 bg-white"
          } ${stage.limited ? "opacity-75" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">
                  {index + 1}
                </span>
                <h3 className="font-medium text-slate-900">{stage.title}</h3>
                {stage.isCurrent && (
                  <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    Current
                  </span>
                )}
              </div>
              {stage.limited ? (
                <p className="mt-1 text-sm text-slate-500">
                  Upgrade to see owner and progress details
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Owner:{" "}
                  <span className="font-medium capitalize">
                    {formatRole(stage.ownerRole)}
                  </span>
                  {stage.daysInStage !== null && (
                    <>
                      {" · "}
                      {stage.daysInStage} day{stage.daysInStage === 1 ? "" : "s"}{" "}
                      in stage
                    </>
                  )}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                statusStyles[stage.status] ?? statusStyles.PENDING
              }`}
            >
              {stage.limited && stage.status === "PENDING"
                ? "Locked"
                : stage.status}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
