import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import {
  assertCaseAccess,
  CaseAccessError,
  createCaseRecord,
  loadCase,
  saveCase,
} from "../../src/server/cases";
import {
  acceptEvidence,
  advanceStage,
  submitEvidence,
} from "../../src/domain/stage-engine";

describe("case access", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.createMany({
      data: [
        {
          id: "acl_client",
          email: "acl-client@example.com",
          role: "CLIENT",
          passwordHash,
        },
        {
          id: "acl_advisor",
          email: "acl-advisor@example.com",
          role: "ADVISOR",
          passwordHash,
        },
        {
          id: "acl_other",
          email: "acl-other@example.com",
          role: "CLIENT",
          passwordHash,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows participants and rejects outsiders", async () => {
    const created = await createCaseRecord({
      title: "ACL test case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "acl_client",
      advisorUserId: "acl_advisor",
    });

    await expect(
      assertCaseAccess("acl_client", "CLIENT", created.id),
    ).resolves.toBeUndefined();
    await expect(
      assertCaseAccess("acl_advisor", "ADVISOR", created.id),
    ).resolves.toBeUndefined();
    await expect(
      assertCaseAccess("acl_other", "CLIENT", created.id),
    ).rejects.toThrow(CaseAccessError);
  });
});

describe("cases persistence", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: {
        id: "user_client",
        email: "client@example.com",
        role: "CLIENT",
        passwordHash,
      },
    });
    await prisma.user.create({
      data: {
        id: "user_advisor",
        email: "advisor@example.com",
        role: "ADVISOR",
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("round-trips a created case", async () => {
    const created = await createCaseRecord({
      title: "Bloggs return",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
    });
    const loaded = await loadCase(created.id);
    expect(loaded.stages).toHaveLength(9);
    expect(loaded.stages.filter((s) => s.status === "ACTIVE")).toHaveLength(1);
  });

  it("persists advance and appends events without rewriting history", async () => {
    const created = await createCaseRecord({
      title: "Advance persist",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
    });

    let caseState = await loadCase(created.id);
    const initialEventCount = caseState.events.length;

    caseState = submitEvidence(caseState, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    await saveCase(caseState);

    caseState = await loadCase(created.id);
    caseState = acceptEvidence(caseState, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "ADVISOR",
    });
    await saveCase(caseState);

    caseState = await loadCase(created.id);
    caseState = advanceStage(caseState, { actorRole: "ADVISOR" });
    await saveCase(caseState);

    const reloaded = await loadCase(created.id);
    expect(reloaded.stages.find((s) => s.key === "money_readiness")?.status).toBe(
      "ACTIVE",
    );
    expect(reloaded.events.length).toBeGreaterThan(initialEventCount);
    expect(reloaded.events.some((e) => e.type === "STAGE_ADVANCED")).toBe(true);
    expect(
      reloaded.stages.find((s) => s.key === "purchase_profile")
        ?.submittedEvidenceKinds,
    ).not.toContain("profile_complete");
  });

  it("round-trips lead attribution on a case", async () => {
    const created = await createCaseRecord({
      title: "Diaspora signup",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
      attribution: {
        leadSource: "DIASPORA_AU_UK",
        leadCampaign: "poms-in-oz-sept",
        leadReferrer: "sarah-w",
      },
    });

    expect(created.attribution.leadSource).toBe("DIASPORA_AU_UK");

    const loaded = await loadCase(created.id);
    expect(loaded.attribution).toEqual({
      leadSource: "DIASPORA_AU_UK",
      leadCampaign: "poms-in-oz-sept",
      leadReferrer: "sarah-w",
    });
  });

  it("defaults existing cases without attribution to DIRECT", async () => {
    const created = await createCaseRecord({
      title: "No attribution",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "FREE_DIY",
      clientUserId: "user_client",
      advisorUserId: "user_advisor",
    });
    const loaded = await loadCase(created.id);
    expect(loaded.attribution.leadSource).toBe("DIRECT");
    expect(loaded.attribution.leadCampaign).toBeNull();
  });
});
