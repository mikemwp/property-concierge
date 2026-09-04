import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import {
  acceptEvidence,
  advanceStage,
  submitEvidence,
} from "../../src/domain/stage-engine";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase, saveCase } from "../../src/server/cases";
import { createReferral } from "../../src/server/referrals";
import { loadPanelScorecards } from "../../src/server/scorecards";

describe("loadPanelScorecards", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.referral.deleteMany();
    await prisma.partnerPanel.deleteMany();
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.createMany({
      data: [
        { id: "sc_client", email: "sc-client@example.com", role: "CLIENT", passwordHash },
        { id: "sc_advisor", email: "sc-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        { id: "sc_priya", roleType: "MORTGAGE_PARTNER", name: "Priya Nair", firm: null, slaDays: 3 },
        { id: "sc_tom", roleType: "CONVEYANCER", name: "Tom Ashby", firm: null, slaDays: 5 },
      ],
    });

    const created = await createCaseRecord({
      title: "Scorecard case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "sc_client",
      advisorUserId: "sc_advisor",
    });

    let c = await loadCase(created.id);
    const t = (iso: string) => new Date(iso);
    c = submitEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "CLIENT", now: t("2026-08-25T10:00:00.000Z") });
    c = acceptEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "ADVISOR", now: t("2026-08-25T11:00:00.000Z") });
    c = advanceStage(c, { actorRole: "ADVISOR", now: t("2026-08-25T12:00:00.000Z") });
    c = submitEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "CLIENT", now: t("2026-08-30T10:00:00.000Z") });
    c = acceptEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "ADVISOR", now: t("2026-08-30T11:00:00.000Z") });
    c = advanceStage(c, { actorRole: "ADVISOR", now: t("2026-09-01T10:00:00.000Z") });
    await saveCase(c);

    await createReferral({
      caseId: created.id,
      partnerId: "sc_priya",
      source: "WARM_INTRO",
      now: t("2026-08-26T10:00:00.000Z"),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("builds one row per panel member with ledger-derived metrics", async () => {
    const rows = await loadPanelScorecards(new Date("2026-09-08T10:00:00.000Z"));
    expect(rows.map((r) => r.member.id)).toEqual(["sc_tom", "sc_priya"]);

    const priya = rows.find((r) => r.member.id === "sc_priya")!.scorecard;
    expect(priya.stagesAssigned).toBe(1);
    expect(priya.openStages).toBe(1);
    expect(priya.missed).toBe(1);
    expect(priya.breaches).toBe(1);
    expect(priya.participationRate).toBe(0);
    expect(priya.rating).toBe("UNDERPERFORMING");
    expect(priya.recommendReroute).toBe(true);

    const tom = rows.find((r) => r.member.id === "sc_tom")!.scorecard;
    expect(tom.rating).toBe("NO_DATA");
  });
});
