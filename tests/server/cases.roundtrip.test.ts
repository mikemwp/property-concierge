import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase } from "../../src/server/cases";
import { advanceStage, acceptEvidence, submitEvidence } from "../../src/domain/stage-engine";

describe("cases persistence", () => {
  beforeAll(async () => {
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: { id: "user_client", email: "client@example.com", role: "CLIENT" },
    });
    await prisma.user.create({
      data: { id: "user_advisor", email: "advisor@example.com", role: "ADVISOR" },
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
});
