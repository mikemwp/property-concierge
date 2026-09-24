import Link from "next/link";
import { notFound } from "next/navigation";
import { resetVaultDocumentAction } from "@/app/actions/vault";
import { AdvisorStageControls } from "@/components/AdvisorStageControls";
import { CurrentOwnerBanner } from "@/components/CurrentOwnerBanner";
import { PartnerIntegrationPanel } from "@/components/PartnerIntegrationPanel";
import { PartnerOpsControls } from "@/components/PartnerOpsControls";
import { PlaybookPanel } from "@/components/PlaybookPanel";
import { ReferralPanel } from "@/components/ReferralPanel";
import { StageTimeline } from "@/components/StageTimeline";
import { CaseAdminControls } from "@/components/CaseAdminControls";
import { ChainFreeCertificationPanel } from "@/components/ChainFreeCertificationPanel";
import { ClientSlaPublishPanel } from "@/components/ClientSlaPublishPanel";
import { ThreadPanel } from "@/components/ThreadPanel";
import { VaultPanel } from "@/components/VaultPanel";
import { WarmIntroButton } from "@/components/WarmIntroButton";
import { advisorCertificationView } from "@/domain/chain-free";
import { advisorSlaView } from "@/domain/client-sla";
import { advisorStageView, canUseWarmIntro } from "@/domain/freemium";
import { daysInStage, escalationLevel } from "@/domain/escalation";
import {
  milestonesForRole,
  partnerRoleLabel,
} from "@/domain/market-packs/types";
import { partnerActivity, partnerTickets } from "@/domain/partner-activity";
import { getFocusStage } from "@/domain/stage-engine";
import { advisorPlaybook } from "@/lib/cockpit-playbook";
import { casePack, stageSlaDays } from "@/lib/case-pack";
import { auth } from "@/lib/auth";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import {
  assertCertificationVisible,
  assertClientSlaVisible,
  assertPlaybookVisible,
} from "@/server/cockpit-policy";
import { canUseChainFree, loadCertification } from "@/server/chain-free";
import { canUseClientSla, loadClientSla } from "@/server/client-sla";
import { listPanel } from "@/server/panel";
import { activeReferralForRole, listReferralsForCase } from "@/server/referrals";
import { displayTicketAdapterId } from "@/lib/partner-adapters/registry";
import { canUseSpeedRails } from "@/server/partner-policy";
import { canPostThread } from "@/domain/threads";
import {
  canUseThreads,
  loadVisibleCaseMessages,
  threadViewerFor,
} from "@/server/threads";
import { canUseVault, listVaultDocuments } from "@/server/vault";
import { isPartnerActorRole, PARTNER_ROLES } from "@/domain/types";

type Props = {
  params: Promise<{ caseId: string }>;
};

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
  const panel = await listPanel({
    activeOnly: true,
    marketPackId: caseState.marketPackId,
  });
  const referrals = await listReferralsForCase(caseId);
  const views = advisorStageView(caseState, now);
  const focus = getFocusStage(caseState);
  const focusOwnerRole =
    focus && isPartnerActorRole(focus.ownerRole) ? focus.ownerRole : null;
  const currentReferral = focusOwnerRole
    ? await activeReferralForRole(caseId, focusOwnerRole)
    : null;
  const rerouteOptions = focusOwnerRole
    ? panel.filter((member) => member.roleType === focusOwnerRole)
    : [];
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

  const pack = casePack(caseState);

  const vaultOn = canUseVault(caseState);
  const vaultDocuments = vaultOn ? await listVaultDocuments(caseId) : [];
  const threadsOn = canUseThreads(caseState);
  const threadViewer = threadViewerFor(
    caseState,
    { role: "ADVISOR", userId: session.user.id },
    { assigned: true, hasActiveReferral: false },
  );
  const threadMessages = threadsOn
    ? await loadVisibleCaseMessages(caseState, threadViewer)
    : [];
  const threadCanPost = threadsOn && canPostThread(threadViewer);

  assertCertificationVisible("ADVISOR");
  const chainFreeEnabled = canUseChainFree(caseState);
  const chainFree = chainFreeEnabled ? await loadCertification(caseState, now) : null;
  const chainFreeView = chainFree
    ? advisorCertificationView(chainFree.certification)
    : null;

  assertClientSlaVisible("ADVISOR");
  const clientSlaEnabled = canUseClientSla(caseState);
  const clientSla = clientSlaEnabled ? await loadClientSla(caseState) : null;
  const clientSlaView = clientSla ? advisorSlaView(clientSla.commitment) : null;

  const tickets = partnerTickets(caseState, now).map((ticket) => ({
    ...ticket,
    adapterId: displayTicketAdapterId(caseState, ticket),
  }));
  const activity = partnerActivity(caseState);
  const railsEnabled = canUseSpeedRails(caseState);
  const syncableRoles =
    railsEnabled && focusOwnerRole ? [focusOwnerRole] : [];
  const focusTicket = focusOwnerRole
    ? tickets.find((ticket) => ticket.role === focusOwnerRole && ticket.closedAt === null)
    : null;
  const unacknowledgedPartner =
    focusTicket != null &&
    focusTicket.acknowledgedAt === null &&
    focusTicket.openDays >= 1;

  const roleLabels = Object.fromEntries(
    PARTNER_ROLES.map((role) => [role, partnerRoleLabel(pack, role)]),
  ) as Partial<Record<(typeof PARTNER_ROLES)[number], string>>;
  const milestoneLabels: Record<string, string> = {};
  for (const role of PARTNER_ROLES) {
    for (const milestone of milestonesForRole(pack, role)) {
      milestoneLabels[`${role}:${milestone.key}`] = milestone.label;
    }
  }

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
              stageSlaDays(caseState, focus.key),
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

      {vaultOn && <VaultPanel caseId={caseId} documents={vaultDocuments} canReset />}

      {threadsOn && (
        <ThreadPanel
          caseId={caseId}
          messages={threadMessages}
          canPost={threadCanPost}
        />
      )}

      <div className="mt-8">
        <WarmIntroButton
          caseId={caseId}
          enabled={canUseWarmIntro(caseState)}
          panel={panel}
        />
      </div>

      <PartnerOpsControls
        caseId={caseId}
        paid={caseState.tier === "PAID_DWY"}
        focusOwnerRole={focusOwnerRole}
        currentPartner={
          currentReferral
            ? { id: currentReferral.partnerId, name: currentReferral.partnerName }
            : null
        }
        rerouteOptions={rerouteOptions}
        unacknowledgedPartner={unacknowledgedPartner}
      />

      <ReferralPanel caseId={caseId} referrals={referrals} panel={panel} />

      {chainFreeView && (
        <ChainFreeCertificationPanel caseId={caseId} view={chainFreeView} />
      )}

      {clientSlaView && (
        <ClientSlaPublishPanel caseId={caseId} view={clientSlaView} />
      )}

      <CaseAdminControls
        caseId={caseId}
        tier={caseState.tier}
        entryContext={caseState.entryContext}
        entryLocked={
          caseState.stages.find((s) => s.key === "offer_instruct")?.status !==
          "PENDING"
        }
        leadSource={caseState.attribution.leadSource}
      />

      <PartnerIntegrationPanel
        caseId={caseId}
        tickets={tickets}
        activity={activity}
        railsEnabled={railsEnabled}
        syncableRoles={syncableRoles}
        roleLabels={roleLabels}
        milestoneLabels={milestoneLabels}
      />
    </section>
  );
}
