import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { createCaseRecord } from "../../src/server/cases";
import {
  getCaseMessageById,
  insertCaseMessage,
  listCaseMessages,
} from "../../src/server/thread-store";
import { assertAppendOnly } from "../../src/domain/threads";

let caseId = "";

describe("thread store is insert + list only", () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.caseMessage.deleteMany();
    await prisma.vaultDocument.deleteMany();
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
        {
          id: "ts_client",
          email: "ts-client@example.com",
          name: "Store Client",
          role: "CLIENT",
          passwordHash,
        },
        {
          id: "ts_advisor",
          email: "ts-advisor@example.com",
          name: "Store Advisor",
          role: "ADVISOR",
          passwordHash,
        },
      ],
    });
    const created = await createCaseRecord({
      title: "Thread store case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "ts_client",
      advisorUserId: "ts_advisor",
    });
    caseId = created.id;
  });

  beforeEach(async () => {
    await prisma.caseMessage.deleteMany({ where: { caseId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("inserts in createdAt order and resolves authorName from User", async () => {
    await insertCaseMessage({
      id: "ts_msg_1",
      caseId,
      authorUserId: "ts_advisor",
      authorRole: "ADVISOR",
      body: "First post.",
      createdAt: new Date("2026-09-04T10:00:00.000Z"),
    });
    await insertCaseMessage({
      id: "ts_msg_2",
      caseId,
      authorUserId: "ts_client",
      authorRole: "CLIENT",
      body: "Second post.",
      createdAt: new Date("2026-09-04T10:05:00.000Z"),
    });

    const listed = await listCaseMessages(caseId);
    expect(listed.map((row) => row.id)).toEqual(["ts_msg_1", "ts_msg_2"]);
    expect(listed[0]?.authorName).toBe("Store Advisor");
    expect(listed[1]?.authorName).toBe("Store Client");
    expect(listed[0]?.createdAt).toBe("2026-09-04T10:00:00.000Z");

    const existing = await getCaseMessageById("ts_msg_1");
    expect(existing?.body).toBe("First post.");
    expect(() => assertAppendOnly(existing)).toThrow(/append-only/i);
  });
});
