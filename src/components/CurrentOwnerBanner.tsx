import type { EscalationLevel } from "@/domain/escalation";
import type { ActorRole } from "@/domain/types";

const escalationStyles: Record<EscalationLevel, string> = {
  OK: "bg-emerald-50 border-emerald-200 text-emerald-900",
  WARN: "bg-amber-50 border-amber-300 text-amber-900",
  BREACH: "bg-red-50 border-red-300 text-red-900",
};

const escalationLabels: Record<EscalationLevel, string> = {
  OK: "On track",
  WARN: "Over SLA",
  BREACH: "Escalation",
};

function formatRole(role: ActorRole): string {
  return role.replace(/_/g, " ").toLowerCase();
}

type Props = {
  ownerRole: ActorRole;
  stageTitle: string;
  showSlaPressure?: boolean;
  daysInStage?: number;
  escalation?: EscalationLevel;
};

export function CurrentOwnerBanner({
  ownerRole,
  stageTitle,
  showSlaPressure = true,
  daysInStage,
  escalation,
}: Props) {
  const containerClass = showSlaPressure
    ? escalationStyles[escalation ?? "OK"]
    : "bg-slate-50 border-slate-200 text-slate-900";

  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 ${containerClass}`}>
      <p className="text-sm font-medium uppercase tracking-wide opacity-70">
        Current stage owner
      </p>
      <p className="mt-1 text-lg font-semibold capitalize">
        {formatRole(ownerRole)} · {stageTitle}
      </p>
      {showSlaPressure && daysInStage !== undefined && escalation !== undefined && (
        <p className="mt-1 text-sm">
          {daysInStage} day{daysInStage === 1 ? "" : "s"} in stage ·{" "}
          {escalationLabels[escalation]}
        </p>
      )}
    </div>
  );
}
