import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyClientSlaAction,
  assessClientSla,
  CLIENT_SLA_CARVE_OUTS,
  clientSlaTargetCopy,
  type SlaScorecardSignal,
} from "../../src/domain/client-sla";
import { createCase, type CaseState } from "../../src/domain/stage-engine";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const TARGET = "2026-12-15";

function acceptAny(caseState: CaseState): CaseState {
  const kind = caseState.stages[0]?.requiredEvidenceKinds[0];
  if (!kind) {
    return caseState;
  }
  return {
    ...caseState,
    stages: caseState.stages.map((stage, index) =>
      index === 0
        ? { ...stage, acceptedEvidenceKinds: [...stage.acceptedEvidenceKinds, kind] }
        : stage,
    ),
  };
}

const signals: SlaScorecardSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

describe("portal copy surface", () => {
  it("shows a target card only for PUBLISHED and AMENDED", () => {
    const paid = acceptAny(
      createCase({
        id: "slap_p",
        entryContext: "UK_RESIDENT_SPEED",
        tier: "PAID_DWY",
        now: NOW,
      }),
    );
    expect(
      clientSlaTargetCopy(
        assessClientSla({ caseState: paid, moduleEnabled: true, partnerSignals: signals }),
      ),
    ).toBeNull();

    const published = applyClientSlaAction(paid, {
      action: "PUBLISH",
      targetDate: TARGET,
      reason: "Ledger is live; partner scorecard supports a target.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
      now: NOW,
    });
    const publishedCopy = clientSlaTargetCopy(
      assessClientSla({
        caseState: published,
        moduleEnabled: true,
        partnerSignals: signals,
      }),
    );
    expect(publishedCopy?.status).toBe("PUBLISHED");
    expect(publishedCopy?.carveOuts).toEqual(CLIENT_SLA_CARVE_OUTS);

    const withdrawn = applyClientSlaAction(published, {
      action: "WITHDRAW",
      targetDate: null,
      reason: "Client paused the purchase.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
      now: NOW,
    });
    expect(
      clientSlaTargetCopy(
        assessClientSla({
          caseState: withdrawn,
          moduleEnabled: true,
          partnerSignals: signals,
        }),
      ),
    ).toBeNull();
  });

  it("keeps scorecard numbers, publish controls and guarantee language out of the portal page", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const card = readFileSync(
      path.resolve(process.cwd(), "src/components/ClientSlaTargetCard.tsx"),
      "utf8",
    );
    expect(portal).toContain("ClientSlaTargetCard");
    expect(portal).toContain("clientSlaTargetCopy");
    expect(portal).not.toContain("ClientSlaPublishPanel");
    expect(portal).not.toContain("qualityScore");
    expect(portal).not.toContain("participationRate");
    expect(portal).not.toContain("advisorSlaView");
    expect(card).not.toMatch(/guarante|qualityScore|canPublish/i);
    expect(card).toMatch(/carveOuts/);
  });
});
