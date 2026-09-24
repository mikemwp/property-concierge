import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyCertificationOverride,
  CHAIN_FREE_REQUIRED_EVIDENCE,
  assessCertification,
  clientCertificationCopy,
  type PartnerParticipationSignal,
} from "../../src/domain/chain-free";
import { createCase, type CaseState } from "../../src/domain/stage-engine";

function acceptKinds(caseState: CaseState, kinds: readonly string[]): CaseState {
  return {
    ...caseState,
    stages: caseState.stages.map((stage) => ({
      ...stage,
      acceptedEvidenceKinds: [
        ...new Set([
          ...stage.acceptedEvidenceKinds,
          ...kinds.filter((kind) => stage.requiredEvidenceKinds.includes(kind)),
        ]),
      ],
    })),
  };
}

const signals: PartnerParticipationSignal[] = [
  {
    partnerId: "p_mortgage",
    roleType: "MORTGAGE_PARTNER",
    hasReferral: true,
    participatedOnCase: true,
    scorecardRating: "STRONG",
    participationRate: 0.8,
  },
];

describe("portal copy surface", () => {
  it("shows copy only for CERTIFIED and IN_PROGRESS", () => {
    const paid = createCase({
      id: "cfp_p",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(
      clientCertificationCopy(
        assessCertification({ caseState: paid, moduleEnabled: true, partnerSignals: [] }),
      )?.status,
    ).toBe("IN_PROGRESS");

    const certified = applyCertificationOverride(
      acceptKinds(paid, CHAIN_FREE_REQUIRED_EVIDENCE),
      {
        action: "CERTIFY",
        reason: "Ledger gates green; no onward chain.",
        actorRole: "ADVISOR",
        moduleEnabled: true,
        partnerSignals: signals,
      },
    );
    expect(
      clientCertificationCopy(
        assessCertification({
          caseState: certified,
          moduleEnabled: true,
          partnerSignals: signals,
        }),
      )?.status,
    ).toBe("CERTIFIED");

    const ineligible = applyCertificationOverride(certified, {
      action: "INELIGIBLE",
      reason: "Household still selling a flat.",
      actorRole: "ADVISOR",
      moduleEnabled: true,
      partnerSignals: signals,
    });
    expect(
      clientCertificationCopy(
        assessCertification({
          caseState: ineligible,
          moduleEnabled: true,
          partnerSignals: signals,
        }),
      ),
    ).toBeNull();
  });

  it("keeps scorecard numbers, partner SLA and guarantee language out of the portal page", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const card = readFileSync(
      path.resolve(process.cwd(), "src/components/ChainFreeStatusCard.tsx"),
      "utf8",
    );
    expect(portal).toContain("ChainFreeStatusCard");
    expect(portal).toContain("clientCertificationCopy");
    expect(portal).not.toContain("qualityScore");
    expect(portal).not.toContain("participationRate");
    expect(portal).not.toContain("advisorCertificationView");
    expect(card).not.toMatch(/slaDays|guarantee|qualityScore/i);
  });
});
