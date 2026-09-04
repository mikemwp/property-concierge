import Link from "next/link";
import { notFound } from "next/navigation";
import { submitPartnerEvidenceAction } from "@/app/actions/partner";
import { CurrentOwnerBanner } from "@/components/CurrentOwnerBanner";
import { EvidenceSubmitForm } from "@/components/EvidenceSubmitForm";
import { StageTimeline } from "@/components/StageTimeline";
import { clientStageView } from "@/domain/freemium";
import { getFocusStage } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { isPartnerRole } from "@/server/partner-policy";
import { loadCase } from "@/server/cases";
import { canPartnerSubmit } from "@/server/partner-policy";
import type { ActorRole } from "@/domain/types";

type Props = {
  params: Promise<{ caseId: string }>;
};

export default async function PartnerCasePage({ params }: Props) {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!role || !isPartnerRole(role)) {
    notFound();
  }

  const { caseId } = await params;
  let caseState;
  try {
    caseState = await loadCase(caseId);
  } catch {
    notFound();
  }

  const now = new Date();
  const views = clientStageView(caseState, now);
  const focus = getFocusStage(caseState);

  if (!focus || focus.ownerRole !== role) {
    return (
      <section>
        <Link
          href="/partner"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Assigned stages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          No assigned stage
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This case is not currently waiting on your role ({role.replace(/_/g, " ")}
          ).
        </p>
      </section>
    );
  }

  const focusStage = caseState.stages.find((s) => s.key === focus.key);
  const canSubmit = canPartnerSubmit(caseState, role, focus.key);

  const pendingKinds =
    focusStage && canSubmit
      ? focusStage.requiredEvidenceKinds.filter(
          (kind) => !focusStage.acceptedEvidenceKinds.includes(kind),
        )
      : [];

  const evidenceRows =
    focus && canSubmit
      ? pendingKinds.map((kind) => ({
          kind,
          action: async (_formData: FormData) => {
            "use server";
            await submitPartnerEvidenceAction(caseId, focus.key, kind);
          },
        }))
      : [];

  return (
    <section>
      <Link
        href="/partner"
        className="text-sm text-emerald-700 hover:underline"
      >
        ← Assigned stages
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        Partner case view
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Submit evidence for your assigned stage. An advisor accepts and advances
        the case — partners cannot advance stages.
      </p>

      <CurrentOwnerBanner
        ownerRole={focus.ownerRole}
        stageTitle={focus.title}
        showSlaPressure={false}
      />

      {focus.status === "BLOCKED" && focus.blockedReason && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Stage blocked: {focus.blockedReason}. You may still submit evidence.
        </p>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Stages</h2>
        <StageTimeline stages={views} />
      </div>

      {canSubmit && pendingKinds.length > 0 && (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
            Submit evidence
          </h2>
          <EvidenceSubmitForm rows={evidenceRows} />
        </div>
      )}

      {canSubmit && pendingKinds.length === 0 && (
        <p className="mt-8 text-sm text-emerald-700">
          All required evidence submitted — awaiting advisor acceptance.
        </p>
      )}
    </section>
  );
}
