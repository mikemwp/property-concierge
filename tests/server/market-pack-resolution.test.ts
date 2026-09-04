import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { MarketPackError } from "../../src/domain/market-packs/types";
import { createCaseRecord, loadCase } from "../../src/server/cases";

describe("market pack resolution on persisted cases", () => {
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
        { id: "mp_client", email: "mp-client@example.com", role: "CLIENT", passwordHash },
        { id: "mp_advisor", email: "mp-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function newCase() {
    return createCaseRecord({
      title: "Pack resolution case",
      entryContext: "RETURNER_OVERSEAS",
      tier: "PAID_DWY",
      clientUserId: "mp_client",
      advisorUserId: "mp_advisor",
    });
  }

  it("stores the default pack id when the caller does not name one", async () => {
    const created = await newCase();
    expect(created.marketPackId).toBe("ew");
  });

  it("refuses to create a case on a disabled pack", async () => {
    await expect(
      createCaseRecord({
        title: "AU case",
        entryContext: "RETURNER_OVERSEAS",
        tier: "PAID_DWY",
        clientUserId: "mp_client",
        advisorUserId: "mp_advisor",
        marketPackId: "au",
      }),
    ).rejects.toThrow(/not enabled/i);
  });

  it("fails closed when a stored pack id is unknown or disabled", async () => {
    const created = await newCase();

    await prisma.case.update({ where: { id: created.id }, data: { marketPackId: "zz" } });
    await expect(loadCase(created.id)).rejects.toThrow(MarketPackError);
    await expect(loadCase(created.id)).rejects.toThrow(/Unknown market pack: zz/);

    await prisma.case.update({ where: { id: created.id }, data: { marketPackId: "au" } });
    await expect(loadCase(created.id)).rejects.toThrow(/not enabled/i);
  });
});
