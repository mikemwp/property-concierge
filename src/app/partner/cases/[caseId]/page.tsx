import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acknowledgeCaseAction,
  reportMilestoneAction,
} from "@/app/actions/partner-integration";
import { submitPartnerEvidenceAction } from "@/app/actions/partner";
import { EvidenceSubmitForm } from "@/components/EvidenceSubmitForm";
import { PartnerCaseContext } from "@/components/PartnerCaseContext";
import { PartnerIntegrationControls } from "@/components/PartnerIntegrationControls";
import { StageTimeline } from "@/components/StageTimeline";
import { daysInStage } from "@/domain/escalation";
import { advisorStageView } from "@/domain/freemium";
import {
  milestonesForRole,
  partnerRoleLabel,
} from "@/domain/market-packs/types";
import {
  openTicketForRole,
  partnerActivity,
} from "@/domain/partner-activity";
import { partnerEvidenceInbox } from "@/domain/partner-integration";
import { getFocusStage } from "@/domain/stage-engine";
import { auth } from "@/lib/auth";
import { casePack, stageSlaDays } from "@/lib/case-pack";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import {
  canPartnerSubmit,
  canUseSpeedRails,
  isPartnerRole,
} from "@/server/partner-policy";
import type { ActorRole } from "@/domain/types";

type Props = {
  params: Promise<{ caseId: string }>;
};

function formatActivityLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export default async function PartnerCasePage({ params }: Props) {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!session?.user || !role || !isPartnerRole(role)) {
    notFound();
  }

  const { caseId } = await params;
  let caseState;
  try {
    caseState = await loadCaseForUser(session.user.id, role, caseId);
  } catch (err) {
    if (err instanceof CaseAccessError) {
      notFound();
    }
    notFound();
  }

  const now = new Date();
  const views = advisorStageView(caseState, now);
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

  const pack = casePack(caseState);
  const focusStage = caseState.stages.find((s) => s.key === focus.key);
  const canSubmit = canPartnerSubmit(caseState, role, focus.key);
  const inbox =
    focusStage && canSubmit
      ? partnerEvidenceInbox(focusStage)
      : { toSubmit: [], awaitingAcceptance: [], accepted: [], complete: false };

  const evidenceRows = inbox.toSubmit.map((kind) => ({
    kind,
    onSubmit: async () =>
      submitPartnerEvidenceAction(caseId, focus.key, kind),
  }));

  const ticket = openTicketForRole(caseState, role);
  const activity = partnerActivity(caseState).filter((row) => row.role === role);
  const railsEnabled = canUseSpeedRails(caseState);

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

      <PartnerCaseContext
        packName={pack.name}
        roleLabel={partnerRoleLabel(pack, role)}
        stageTitle={focus.title}
        slaDays={stageSlaDays(caseState, focus.key)}
        daysInStage={daysInStage(focus, now)}
        blockedReason={focus.status === "BLOCKED" ? focus.blockedReason : null}
        ticket={ticket}
      />

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Stages</h2>
        <StageTimeline stages={views} />
      </div>

      {canSubmit && !inbox.complete && (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
            Required evidence
          </h2>
          <EvidenceSubmitForm
            rows={evidenceRows}
            awaitingKinds={inbox.awaitingAcceptance}
          />
          {inbox.accepted.length > 0 && (
            <ul className="mt-4 space-y-2">
              {inbox.accepted.map((kind) => (
                <li
                  key={kind}
                  className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                >
                  {kind.replace(/_/g, " ")} — accepted
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canSubmit && inbox.complete && (
        <p className="mt-8 text-sm text-emerald-700">
          All required evidence accepted for this stage.
        </p>
      )}

      {railsEnabled && (
        <PartnerIntegrationControls
          caseId={caseId}
          acknowledged={ticket?.acknowledgedAt != null}
          milestones={milestonesForRole(pack, role)}
          onAcknowledge={() => acknowledgeCaseAction(caseId)}
          onReportMilestone={(milestoneKey, note) =>
            reportMilestoneAction(caseId, milestoneKey, note)
          }
        />
      )}

      {activity.length > 0 && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium text-slate-900">Your activity</h2>
          <ul className="mt-3 space-y-2">
            {activity.map((row) => (
              <li
                key={`${row.at}-${row.type}`}
                className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <span className="font-medium">
                  {formatActivityLabel(row.type)}
                </span>
                <span className="text-slate-500">
                  {" "}
                  · {new Date(row.at).toLocaleString()}
                </span>
                {row.status && (
                  <span className="text-slate-600">
                    {" "}
                    · {formatActivityLabel(row.status)}
                  </span>
                )}
                {row.milestoneKey && (
                  <span className="text-slate-600">
                    {" "}
                    · {row.milestoneKey.replace(/_/g, " ")}
                  </span>
                )}
                {row.detail && (
                  <span className="text-slate-600"> · {row.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
