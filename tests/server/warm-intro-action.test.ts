import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import {
  attachPartnerParticipant,
  createCaseRecord,
} from "../../src/server/cases";
import {
  activeReferralForRole,
  createReferral,
  listReferralsForCase,
} from "../../src/server/referrals";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let caseId: string;

describe("warmIntroAction", () => {
  beforeAll(async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "wia_advisor", role: "ADVISOR" },
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
        { id: "wia_client", email: "wia-client@example.com", role: "CLIENT", passwordHash },
        { id: "wia_advisor", email: "wia-advisor@example.com", role: "ADVISOR", passwordHash },
        { id: "wia_mort_a", email: "wia-mort-a@example.com", role: "MORTGAGE_PARTNER", passwordHash },
        { id: "wia_mort_b", email: "wia-mort-b@example.com", role: "MORTGAGE_PARTNER", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        {
          id: "wia_panel_priya",
          roleType: "MORTGAGE_PARTNER",
          name: "Priya Nair",
          firm: "Northstar Mortgages",
          slaDays: 3,
          userId: "wia_mort_a",
          active: true,
        },
        {
          id: "wia_panel_ravi",
          roleType: "MORTGAGE_PARTNER",
          name: "Ravi Patel",
          firm: "Ledger Mortgages",
          slaDays: 3,
          active: true,
        },
        {
          id: "wia_panel_ben",
          roleType: "MORTGAGE_PARTNER",
          name: "Ben Okoro",
          firm: "Summit Mortgages",
          slaDays: 3,
          userId: "wia_mort_b",
          active: true,
        },
      ],
    });

    const created = await createCaseRecord({
      title: "Warm intro action case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "wia_client",
      advisorUserId: "wia_advisor",
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a disclosed referral without attaching another firm's login for a no-login panel member", async () => {
    const { warmIntroAction } = await import("@/app/actions/cockpit");

    const result = await warmIntroAction(caseId, "wia_panel_ravi", "Needs DIP quickly");
    expect(result).toEqual({ ok: true });

    const referrals = await listReferralsForCase(caseId);
    expect(referrals).toHaveLength(1);
    expect(referrals[0].partnerId).toBe("wia_panel_ravi");
    expect(referrals[0].source).toBe("WARM_INTRO");
    expect(referrals[0].supersededAt).toBeNull();

    const participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants).toEqual([]);
  });

  it("supersedes the prior same-role referral and swaps attached partner logins", async () => {
    await attachPartnerParticipant(caseId, "MORTGAGE_PARTNER", "wia_mort_a");
    await createReferral({
      caseId,
      partnerId: "wia_panel_priya",
      source: "WARM_INTRO",
    });

    const { warmIntroAction } = await import("@/app/actions/cockpit");
    const result = await warmIntroAction(caseId, "wia_panel_ben", "Switching broker");
    expect(result).toEqual({ ok: true });

    const referrals = await listReferralsForCase(caseId);
    const priyaReferral = referrals.find((r) => r.partnerId === "wia_panel_priya");
    const raviReferral = referrals.find((r) => r.partnerId === "wia_panel_ravi");
    const benReferral = referrals.find((r) => r.partnerId === "wia_panel_ben");

    expect(raviReferral?.supersededAt).not.toBeNull();
    expect(priyaReferral?.supersededAt).not.toBeNull();
    expect(benReferral?.source).toBe("WARM_INTRO");
    expect(benReferral?.supersededAt).toBeNull();
    expect((await activeReferralForRole(caseId, "MORTGAGE_PARTNER"))?.partnerId).toBe(
      "wia_panel_ben",
    );

    const participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants.map((p) => p.userId)).toEqual(["wia_mort_b"]);
  });
});

describe("markReferralAction", () => {
  let markCaseId: string;

  beforeAll(async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "mra_advisor", role: "ADVISOR" },
    } as Awaited<ReturnType<typeof auth>>);

    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.user.createMany({
      data: [
        { id: "mra_client", email: "mra-client@example.com", role: "CLIENT", passwordHash },
        { id: "mra_advisor", email: "mra-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        {
          id: "mra_panel_a",
          roleType: "CONVEYANCER",
          name: "Tom Ashby",
          firm: "Harbour Law LLP",
          slaDays: 5,
          active: true,
        },
        {
          id: "mra_panel_b",
          roleType: "CONVEYANCER",
          name: "Lena Okoro",
          firm: "Greenway Conveyancing",
          slaDays: 5,
          active: true,
        },
      ],
    });

    const created = await createCaseRecord({
      title: "Mark referral case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "mra_client",
      advisorUserId: "mra_advisor",
    });
    markCaseId = created.id;
  });

  it("supersedes the prior same-role referral when marking a different panel member", async () => {
    const { markReferralAction } = await import("@/app/actions/partner-network");

    const first = await markReferralAction(markCaseId, "mra_panel_a", "EXPECTED");
    expect(first).toEqual({ ok: true });

    const second = await markReferralAction(markCaseId, "mra_panel_b", "EXPECTED");
    expect(second).toEqual({ ok: true });

    const referrals = await listReferralsForCase(markCaseId);
    const panelA = referrals.find((r) => r.partnerId === "mra_panel_a");
    const panelB = referrals.find((r) => r.partnerId === "mra_panel_b");

    expect(panelA?.supersededAt).not.toBeNull();
    expect(panelB?.supersededAt).toBeNull();
    expect((await activeReferralForRole(markCaseId, "CONVEYANCER"))?.partnerId).toBe(
      "mra_panel_b",
    );
  });
});
