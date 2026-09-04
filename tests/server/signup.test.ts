import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { loadCase } from "../../src/server/cases";
import { createSelfServeCase, SignupError } from "../../src/server/signup";
import type { ParsedIntake } from "../../src/domain/intake";

const intake: ParsedIntake = {
  name: "Bloggs household",
  email: "signup-client@example.com",
  password: "returning2026",
  entryContext: "RETURNER_OVERSEAS",
  tier: "PAID_DWY",
  targetRegion: "Bristol",
  caseTitle: "Bloggs household — Bristol",
};

describe("createSelfServeCase", () => {
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
        id: "signup_advisor",
        email: "signup-advisor@example.com",
        role: "ADVISOR",
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a client user and an attributed paid case owned by the advisor", async () => {
    const created = await createSelfServeCase({
      intake,
      attribution: {
        leadSource: "DIASPORA_AU_UK",
        leadCampaign: "poms-in-oz-sept",
        leadReferrer: null,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: created.userId },
    });
    expect(user.role).toBe("CLIENT");
    expect(user.email).toBe("signup-client@example.com");
    expect(await bcrypt.compare("returning2026", user.passwordHash)).toBe(true);

    const caseState = await loadCase(created.caseId);
    expect(caseState.tier).toBe("PAID_DWY");
    expect(caseState.entryContext).toBe("RETURNER_OVERSEAS");
    expect(caseState.attribution.leadSource).toBe("DIASPORA_AU_UK");

    const participants = await prisma.caseParticipant.findMany({
      where: { caseId: created.caseId },
    });
    expect(participants.map((p) => p.role).sort()).toEqual([
      "ADVISOR",
      "CLIENT",
    ]);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      createSelfServeCase({
        intake,
        attribution: {
          leadSource: "DIRECT",
          leadCampaign: null,
          leadReferrer: null,
        },
      }),
    ).rejects.toThrow(SignupError);
  });
});
