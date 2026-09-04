import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import {
  assertPanelMemberInMarket,
  findActivePanelMemberForRole,
  getPanelMember,
  listPanel,
  PartnerNetworkError,
  setPanelMemberActive,
} from "../../src/server/panel";

describe("panel persistence", () => {
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
    await prisma.user.create({
      data: {
        id: "panel_mortgage_user",
        email: "panel-mortgage@example.com",
        role: "MORTGAGE_PARTNER",
        passwordHash,
      },
    });
    await prisma.partnerPanel.createMany({
      data: [
        {
          id: "panel_mort_linked",
          roleType: "MORTGAGE_PARTNER",
          name: "Priya Nair",
          firm: "Northstar Mortgages",
          slaDays: 3,
          userId: "panel_mortgage_user",
          marketPackId: "ew",
        },
        {
          id: "panel_mort_unlinked",
          roleType: "MORTGAGE_PARTNER",
          name: "Aaron Blake",
          firm: null,
          slaDays: 3,
          marketPackId: "ew",
        },
        {
          id: "panel_conv_inactive",
          roleType: "CONVEYANCER",
          name: "Zed Legal",
          firm: "Zed Legal LLP",
          slaDays: 5,
          active: false,
          marketPackId: "ew",
        },
        {
          id: "panel_mort_other_market",
          roleType: "MORTGAGE_PARTNER",
          name: "Ada Ng",
          firm: "Southern Cross Broking",
          slaDays: 3,
          marketPackId: "au",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists members ordered by role then name and filters to active", async () => {
    const all = await listPanel();
    expect(all.map((m) => m.id)).toEqual([
      "panel_conv_inactive",
      "panel_mort_unlinked",
      "panel_mort_other_market",
      "panel_mort_linked",
    ]);
    const active = await listPanel({ activeOnly: true });
    expect(active.map((m) => m.id)).toEqual([
      "panel_mort_unlinked",
      "panel_mort_other_market",
      "panel_mort_linked",
    ]);
  });

  it("maps rows to PanelMember with a typed role and nullable link", async () => {
    const member = await getPanelMember("panel_mort_linked");
    expect(member).toEqual({
      id: "panel_mort_linked",
      roleType: "MORTGAGE_PARTNER",
      name: "Priya Nair",
      firm: "Northstar Mortgages",
      active: true,
      slaDays: 3,
      userId: "panel_mortgage_user",
      marketPackId: "ew",
    });
    expect(await getPanelMember("missing")).toBeNull();
  });

  it("prefers an active member with a linked login for a role", async () => {
    const member = await findActivePanelMemberForRole("MORTGAGE_PARTNER");
    expect(member?.id).toBe("panel_mort_linked");
    expect(await findActivePanelMemberForRole("CONVEYANCER")).toBeNull();
  });

  it("demotes and reinstates a member", async () => {
    const demoted = await setPanelMemberActive("panel_mort_linked", false);
    expect(demoted.active).toBe(false);
    expect((await findActivePanelMemberForRole("MORTGAGE_PARTNER"))?.id).toBe(
      "panel_mort_unlinked",
    );
    const reinstated = await setPanelMemberActive("panel_mort_linked", true);
    expect(reinstated.active).toBe(true);
  });

  it("scopes the panel to one market", async () => {
    const ew = await listPanel({ marketPackId: "ew" });
    expect(ew.map((m) => m.id)).not.toContain("panel_mort_other_market");
    const au = await listPanel({ marketPackId: "au" });
    expect(au.map((m) => m.id)).toEqual(["panel_mort_other_market"]);
  });

  it("never picks a member from another market for a role", async () => {
    expect((await findActivePanelMemberForRole("MORTGAGE_PARTNER", "ew"))?.id).toBe(
      "panel_mort_linked",
    );
    expect((await findActivePanelMemberForRole("MORTGAGE_PARTNER", "au"))?.id).toBe(
      "panel_mort_other_market",
    );
  });

  it("rejects a panel member that is not on the case's market panel", async () => {
    const member = await getPanelMember("panel_mort_other_market");
    expect(() => assertPanelMemberInMarket(member!, "ew")).toThrow(PartnerNetworkError);
    expect(() => assertPanelMemberInMarket(member!, "ew")).toThrow(/ew panel/);
    expect(() => assertPanelMemberInMarket(member!, "au")).not.toThrow();
  });
});
