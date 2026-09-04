import type { StagePlaybook } from "@/domain/market-packs/ew-playbook";

type Props = {
  playbook: StagePlaybook;
  stageTitle: string;
};

export function PlaybookPanel({ playbook, stageTitle }: Props) {
  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
          Advisor playbook — {stageTitle}
        </h2>
        <span className="rounded bg-indigo-900 px-2 py-0.5 text-xs font-medium text-indigo-50">
          Never shown to clients
        </span>
      </div>

      <p className="mt-2 text-sm text-indigo-900">{playbook.objective}</p>

      <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
        Actions
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-indigo-900">
        {playbook.actions.map((step) => (
          <li key={`${step.day}-${step.action}`}>
            <span className="font-medium">Day {step.day}</span>{" "}
            <span className="text-indigo-700">
              ({step.owner.replace(/_/g, " ").toLowerCase()})
            </span>{" "}
            {step.action}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
        Evidence standard
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-indigo-900">
        {playbook.evidenceStandard.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>

      <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
        Escalation
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-indigo-900">
        {playbook.escalation.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>

      {playbook.partnerScript && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase text-indigo-800">
            Partner script
          </h3>
          <p className="mt-1 text-sm italic text-indigo-900">
            {playbook.partnerScript}
          </p>
        </>
      )}
    </div>
  );
}
