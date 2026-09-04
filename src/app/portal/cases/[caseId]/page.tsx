import Link from "next/link";
import { notFound } from "next/navigation";
import { submitEvidenceAction } from "@/app/actions/portal";
import { CurrentOwnerBanner } from "@/components/CurrentOwnerBanner";
import { EvidenceSubmitForm } from "@/components/EvidenceSubmitForm";
import { StageTimeline } from "@/components/StageTimeline";
import { UpgradeCallout } from "@/components/UpgradeCallout";
import { canViewSlaPressure, clientStageView } from "@/domain/freemium";
import { daysInStage, escalationLevel } from "@/domain/escalation";
import { ewMarketPack, getStageTemplate } from "@/domain/market-packs/ew";
import { getFocusStage } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import { canPortalSubmit } from "@/server/portal-policy";

import type { EntryContext } from "@/domain/types";

type Props = {
  params: Promise<{ caseId: string }>;
};

function stageSlaDays(entryContext: EntryContext, stageKey: string): number {
  const templates = getStageTemplate(ewMarketPack, entryContext);
  return templates.find((t) => t.key === stageKey)?.slaDays ?? 7;
}

export default async function PortalCasePage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    notFound();
  }

  const { caseId } = await params;
  let caseState;
  try {
    caseState = await loadCaseForUser(session.user.id, "CLIENT", caseId);
  } catch (err) {
    if (err instanceof CaseAccessError) {
      notFound();
    }
    notFound();
  }

  const now = new Date();
  const views = clientStageView(caseState, now);
  const focus = getFocusStage(caseState);
  const limitedCount = views.filter((v) => v.limited).length;
  const showUpgrade = caseState.tier === "FREE_DIY" && limitedCount > 0;

  const canSubmit =
    focus !== null && canPortalSubmit(caseState, focus.key);

  const focusStage = focus
    ? caseState.stages.find((s) => s.key === focus.key)
    : null;

  const awaitingKinds =
    focusStage && canSubmit && caseState.tier === "PAID_DWY"
      ? focusStage.requiredEvidenceKinds.filter(
          (kind) =>
            focusStage.submittedEvidenceKinds.includes(kind) &&
            !focusStage.acceptedEvidenceKinds.includes(kind),
        )
      : [];

  const pendingSubmitKinds =
    focusStage && canSubmit
      ? focusStage.requiredEvidenceKinds.filter(
          (kind) =>
            !focusStage.submittedEvidenceKinds.includes(kind) &&
            !focusStage.acceptedEvidenceKinds.includes(kind),
        )
      : [];

  const evidenceRows = pendingSubmitKinds.map((kind) => ({
    kind,
    onSubmit: async () => submitEvidenceAction(caseId, focus!.key, kind),
  }));

  return (
    <section>
      <Link
        href="/portal"
        className="text-sm text-blue-600 hover:underline"
      >
        ← All cases
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        Case timeline
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {caseState.tier === "FREE_DIY" ? "Free DIY" : "Paid Done-With-You"}
      </p>

      {showUpgrade && <UpgradeCallout limitedCount={limitedCount} />}

      {focus &&
        (caseState.tier === "PAID_DWY" ||
          !views.find((v) => v.key === focus.key)?.limited) && (
          <CurrentOwnerBanner
            ownerRole={focus.ownerRole}
            stageTitle={focus.title}
            showSlaPressure={canViewSlaPressure(caseState)}
            daysInStage={
              canViewSlaPressure(caseState)
                ? daysInStage(focus, now)
                : undefined
            }
            escalation={
              canViewSlaPressure(caseState)
                ? escalationLevel(
                    focus,
                    stageSlaDays(caseState.entryContext, focus.key),
                    now,
                  )
                : undefined
            }
          />
        )}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Stages</h2>
        <StageTimeline stages={views} />
      </div>

      {canSubmit && (pendingSubmitKinds.length > 0 || awaitingKinds.length > 0) && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
            Submit evidence
          </h2>
          <EvidenceSubmitForm rows={evidenceRows} awaitingKinds={awaitingKinds} />
        </div>
      )}
    </section>
  );
}
