import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { ManualPartnerPort } from "../../src/lib/partner-port";
import { prisma } from "../../src/lib/db";
import {
  attachPartnerParticipant,
  detachPartnerParticipant,
} from "../../src/server/case-access";
import { createCaseRecord, loadCase } from "../../src/server/cases";

let caseId: string;

describe("warm intro plumbing", () => {
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
        { id: "wi_client", email: "wi-client@example.com", role: "CLIENT", passwordHash },
        { id: "wi_advisor", email: "wi-advisor@example.com", role: "ADVISOR", passwordHash },
        { id: "wi_mort_a", email: "wi-mort-a@example.com", role: "MORTGAGE_PARTNER", passwordHash },
        { id: "wi_mort_b", email: "wi-mort-b@example.com", role: "MORTGAGE_PARTNER", passwordHash },
      ],
    });
    const created = await createCaseRecord({
      title: "Warm intro case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "wi_client",
      advisorUserId: "wi_advisor",
    });
    caseId = created.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("logs the named panel member in the WARM_INTRO_REQUESTED payload", async () => {
    const port = new ManualPartnerPort();
    const { ticketId } = await port.requestWarmIntro({
      caseId,
      partnerType: "MORTGAGE_PARTNER",
      note: "Returner, needs DIP quickly",
      panelMemberId: "seed_panel_priya",
      panelMemberName: "Priya Nair",
    });
    expect(ticketId).toMatch(/^warm-/);

    const reloaded = await loadCase(caseId);
    const event = reloaded.events.at(-1)!;
    expect(event.type).toBe("WARM_INTRO_REQUESTED");
    expect(event.actorRole).toBe("ADVISOR");
    expect(JSON.parse(event.payload!)).toEqual({
      partnerType: "MORTGAGE_PARTNER",
      note: "Returner, needs DIP quickly",
      ticketId,
      panelMemberId: "seed_panel_priya",
      panelMemberName: "Priya Nair",
    });
  });

  it("attaches the preferred partner login, falls back to any user of the role, and detaches", async () => {
    await attachPartnerParticipant(caseId, "MORTGAGE_PARTNER", "wi_mort_b");
    let participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants.map((p) => p.userId)).toEqual(["wi_mort_b"]);

    await detachPartnerParticipant(caseId, "wi_mort_b");
    participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants).toEqual([]);

    await attachPartnerParticipant(caseId, "MORTGAGE_PARTNER", null);
    participants = await prisma.caseParticipant.findMany({
      where: { caseId, role: "MORTGAGE_PARTNER" },
    });
    expect(participants).toHaveLength(1);
    expect(["wi_mort_a", "wi_mort_b"]).toContain(participants[0].userId);
  });
});
