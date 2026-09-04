import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import {
  attachPartnerParticipant,
  createCaseRecord,
} from "../../src/server/cases";
import { createReferral, listReferralsForCase } from "../../src/server/referrals";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let caseId: string;

describe("reroutePartnerAction", () => {
  beforeAll(async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "rr_advisor", role: "ADVISOR" },
    } as Awaited<ReturnType<typeof auth>>);

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
        { id: "rr_client", email: "rr-client@example.com", role: "CLIENT", passwordHash },
        { id: "rr_advisor", email: "rr-advisor@example.com", role: "ADVISOR", passwordHash },
        { id: "rr_mort_priya", email: "rr-priya@example.com", role: "MORTGAGE_PARTNER", passwordHash },
        { id: "rr_mort_other", email: "rr-other@example.com", role: "MORTGAGE_PARTNER", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        {
          id: "rr_panel_priya",
          roleType: "MORTGAGE_PARTNER",
          name: "Priya Nair",
          firm: "Northstar Mortgages",
          slaDays: 3,
          userId: "rr_mort_priya",
          active: true,
        },
        {
          id: "rr_panel_ravi",
          roleType: "MORTGAGE_PARTNER",
          name: "Ravi Patel",
          firm: "Ledger Mortgages",
          slaDays: 3,
          active: true,
        },
      ],
    });

    const created = await createCaseRecord({
      title: "Re-route case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "rr_client",
      advisorUserId: "rr_advisor",
    });
    caseId = created.id;

    await attachPartnerParticipant(caseId, "MORTGAGE_PARTNER", "rr_mort_priya");
    await createReferral({
      caseId,
      partnerId: "rr_panel_priya",
      source: "WARM_INTRO",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not re-attach a prior partner when re-routing to a panel member with no login", async () => {
    const { reroutePartnerAction } = await import("@/app/actions/partner-network");

    const result = await reroutePartnerAction(caseId, "rr_panel_ravi");
    expect(result).toEqual({ ok: true });

    const referrals = await listReferralsForCase(caseId);
    const priyaReferral = referrals.find((r) => r.partnerId === "rr_panel_priya");
    const raviReferral = referrals.find((r) => r.partnerId === "rr_panel_ravi");

    expect(priyaReferral?.supersededAt).not.toBeNull();
    expect(raviReferral?.source).toBe("REROUTE");
    expect(raviReferral?.supersededAt).toBeNull();

    const participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants).toEqual([]);
  });
});
