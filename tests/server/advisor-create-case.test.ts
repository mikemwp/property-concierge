import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase } from "../../src/server/cases";
import { MarketPackError } from "../../src/domain/market-packs/types";

describe("advisor-created corridor cases", () => {
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
        { id: "adv_client", email: "adv-client@example.com", role: "CLIENT", passwordHash },
        { id: "adv_advisor", email: "adv-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a uk_au case with the AU spine for an existing client", async () => {
    const created = await createCaseRecord({
      title: "Patel UK→AU purchase (paid)",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "adv_client",
      advisorUserId: "adv_advisor",
      marketPackId: "uk_au",
    });
    const loaded = await loadCase(created.id);
    expect(loaded.marketPackId).toBe("uk_au");
    expect(loaded.stages.map((s) => s.key)).toContain("finance_path");
    expect(loaded.stages.map((s) => s.key)).toContain("settlement_complete");
  });

  it("still refuses the disabled au stub", async () => {
    await expect(
      createCaseRecord({
        title: "Should fail",
        entryContext: "RETURNER_OVERSEAS",
        tier: "PAID_DWY",
        clientUserId: "adv_client",
        advisorUserId: "adv_advisor",
        marketPackId: "au",
      }),
    ).rejects.toThrow(MarketPackError);
  });

  it("wires the cockpit list to the create action and shows marketPackId", () => {
    const action = readFileSync(
      path.resolve(process.cwd(), "src/app/actions/case-admin.ts"),
      "utf8",
    );
    const form = readFileSync(
      path.resolve(process.cwd(), "src/components/CreateAdvisorCaseForm.tsx"),
      "utf8",
    );
    const list = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/page.tsx"),
      "utf8",
    );
    expect(action).toContain("createAdvisorCaseAction");
    expect(form).toContain("createAdvisorCaseAction");
    expect(form).toContain("uk_au");
    expect(form).toContain("uk_us");
    expect(list).toContain("CreateAdvisorCaseForm");
    expect(list).toContain("marketPackId");
  });
});
