import Link from "next/link";
import { notFound } from "next/navigation";
import { AdvisorStageControls } from "@/components/AdvisorStageControls";
import { CurrentOwnerBanner } from "@/components/CurrentOwnerBanner";
import { PlaybookPanel } from "@/components/PlaybookPanel";
import { StageTimeline } from "@/components/StageTimeline";
import { WarmIntroButton } from "@/components/WarmIntroButton";
import { advisorStageView, canUseWarmIntro } from "@/domain/freemium";
import { daysInStage, escalationLevel } from "@/domain/escalation";
import { ewMarketPack, getStageTemplate } from "@/domain/market-packs/ew";
import { getFocusStage } from "@/domain/stage-engine";
import { advisorPlaybook } from "@/lib/cockpit-playbook";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import { assertPlaybookVisible } from "@/server/cockpit-policy";
import type { EntryContext } from "@/domain/types";

type Props = {
  params: Promise<{ caseId: string }>;
};

function stageSlaDays(entryContext: EntryContext, stageKey: string): number {
  const templates = getStageTemplate(ewMarketPack, entryContext);
  return templates.find((t) => t.key === stageKey)?.slaDays ?? 7;
}

export default async function CockpitCasePage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    notFound();
  }

  const { caseId } = await params;
  let caseState;
  try {
    caseState = await loadCaseForUser(session.user.id, "ADVISOR", caseId);
  } catch (err) {
    if (err instanceof CaseAccessError) {
      notFound();
    }
    notFound();
  }

  const now = new Date();
  const views = advisorStageView(caseState, now);
  const focus = getFocusStage(caseState);
  const focusStage = focus
    ? caseState.stages.find((s) => s.key === focus.key)
    : null;

  assertPlaybookVisible("ADVISOR");
  const playbook = focus ? advisorPlaybook(caseState, focus.key) : null;

  const awaitingAcceptanceKinds =
    focusStage && focusStage.status !== "DONE"
      ? focusStage.requiredEvidenceKinds.filter(
          (kind) =>
            focusStage.submittedEvidenceKinds.includes(kind) &&
            !focusStage.acceptedEvidenceKinds.includes(kind),
        )
      : [];

  const canAdvance =
    focusStage !== undefined &&
    focusStage !== null &&
    focusStage.status === "ACTIVE" &&
    focusStage.requiredEvidenceKinds.every((kind) =>
      focusStage.acceptedEvidenceKinds.includes(kind),
    );

  const isBlocked = focusStage?.status === "BLOCKED";

  const warmIntroEvents = caseState.events.filter(
    (e) => e.type === "WARM_INTRO_REQUESTED",
  );

  return (
    <section>
      <Link
        href="/cockpit/cases"
        className="text-sm text-indigo-600 hover:underline"
      >
        ← All cases
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        Advisor case view
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {caseState.tier === "FREE_DIY" ? "Free DIY" : "Paid Done-With-You"}
      </p>

      {focus && (
        <>
          <CurrentOwnerBanner
            ownerRole={focus.ownerRole}
            stageTitle={focus.title}
            showSlaPressure
            daysInStage={daysInStage(focus, now)}
            escalation={escalationLevel(
              focus,
              stageSlaDays(caseState.entryContext, focus.key),
              now,
            )}
          />

          {playbook && (
            <PlaybookPanel playbook={playbook} stageTitle={focus.title} />
          )}
        </>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Stages</h2>
        <StageTimeline stages={views} />
      </div>

      {focus && focusStage && focusStage.status !== "DONE" && (
        <div className="mt-8">
          <AdvisorStageControls
            caseId={caseId}
            stageKey={focus.key}
            awaitingAcceptanceKinds={awaitingAcceptanceKinds}
            canAdvance={canAdvance}
            isBlocked={isBlocked}
          />
        </div>
      )}

      <div className="mt-8">
        <WarmIntroButton
          caseId={caseId}
          enabled={canUseWarmIntro(caseState)}
        />
      </div>

      {warmIntroEvents.length > 0 && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium text-slate-900">
            Warm intro history
          </h2>
          <ul className="mt-3 space-y-2">
            {warmIntroEvents.map((event, index) => (
              <li
                key={`${event.at}-${index}`}
                className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <span className="font-medium">{event.stageKey}</span>
                {" · "}
                {new Date(event.at).toLocaleString()}
                {event.payload && (
                  <span className="mt-1 block text-slate-600">
                    {event.payload}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
