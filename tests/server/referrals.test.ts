import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { createCaseRecord } from "../../src/server/cases";
import { PartnerNetworkError } from "../../src/server/panel";
import {
  activeReferralForRole,
  createReferral,
  listReferralsForCase,
  setReferralFeeStatus,
  supersedeActiveReferrals,
} from "../../src/server/referrals";

let caseId: string;

describe("referrals persistence", () => {
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
        { id: "ref_client", email: "ref-client@example.com", role: "CLIENT", passwordHash },
        { id: "ref_advisor", email: "ref-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    await prisma.partnerPanel.createMany({
      data: [
        { id: "ref_conv_a", roleType: "CONVEYANCER", name: "Tom Ashby", firm: "Harbour Law LLP", slaDays: 5 },
        { id: "ref_conv_b", roleType: "CONVEYANCER", name: "Lena Okoro", firm: null, slaDays: 5 },
        { id: "ref_mort_off", roleType: "MORTGAGE_PARTNER", name: "Ravi Patel", firm: null, slaDays: 3, active: false },
      ],
    });
    const created = await createCaseRecord({
      title: "Referral case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "ref_client",
      advisorUserId: "ref_advisor",
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a disclosed referral with the default fee status", async () => {
    const referral = await createReferral({
      caseId,
      partnerId: "ref_conv_a",
      source: "WARM_INTRO",
      now: new Date("2026-09-04T12:00:00.000Z"),
    });
    expect(referral.partnerRole).toBe("CONVEYANCER");
    expect(referral.partnerName).toBe("Tom Ashby");
    expect(referral.partnerFirm).toBe("Harbour Law LLP");
    expect(referral.source).toBe("WARM_INTRO");
    expect(referral.feeStatus).toBe("EXPECTED");
    expect(referral.disclosureText).toMatch(/referral fee/i);
    expect(referral.disclosedAt).toBe("2026-09-04T12:00:00.000Z");
    expect(referral.createdAt).toBe("2026-09-04T12:00:00.000Z");
    expect(referral.supersededAt).toBeNull();
  });

  it("rejects unknown or inactive panel members", async () => {
    await expect(
      createReferral({ caseId, partnerId: "nope", source: "ADVISOR_MARK" }),
    ).rejects.toThrow(PartnerNetworkError);
    await expect(
      createReferral({ caseId, partnerId: "ref_mort_off", source: "ADVISOR_MARK" }),
    ).rejects.toThrow(/not active/i);
  });

  it("enforces fee status transitions", async () => {
    const [referral] = await listReferralsForCase(caseId);
    const received = await setReferralFeeStatus(referral.id, "RECEIVED");
    expect(received.feeStatus).toBe("RECEIVED");
    await expect(setReferralFeeStatus(referral.id, "WAIVED")).rejects.toThrow(
      /RECEIVED to WAIVED/,
    );
  });

  it("rejects fee updates when the referral belongs to a different case", async () => {
    const other = await createCaseRecord({
      title: "Other referral case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "ref_client",
      advisorUserId: "ref_advisor",
    });
    const [referral] = await listReferralsForCase(caseId);

    await expect(setReferralFeeStatus(referral.id, "WAIVED", other.id)).rejects.toThrow(
      PartnerNetworkError,
    );
    await expect(setReferralFeeStatus(referral.id, "WAIVED", other.id)).rejects.toThrow(
      /does not belong to this case/i,
    );
  });

  it("supersedes the active referral for a role and records the replacement", async () => {
    const before = await activeReferralForRole(caseId, "CONVEYANCER");
    expect(before?.partnerId).toBe("ref_conv_a");

    const superseded = await supersedeActiveReferrals(
      caseId,
      "CONVEYANCER",
      new Date("2026-09-10T09:00:00.000Z"),
    );
    expect(superseded?.partnerId).toBe("ref_conv_a");

    await createReferral({
      caseId,
      partnerId: "ref_conv_b",
      source: "REROUTE",
      now: new Date("2026-09-10T09:00:01.000Z"),
    });

    const all = await listReferralsForCase(caseId);
    expect(all.map((r) => [r.partnerId, r.supersededAt])).toEqual([
      ["ref_conv_a", "2026-09-10T09:00:00.000Z"],
      ["ref_conv_b", null],
    ]);
    expect((await activeReferralForRole(caseId, "CONVEYANCER"))?.partnerId).toBe("ref_conv_b");
    expect(await activeReferralForRole(caseId, "MORTGAGE_PARTNER")).toBeNull();
    expect(await supersedeActiveReferrals(caseId, "MOVE_PARTNER")).toBeNull();
  });
});
