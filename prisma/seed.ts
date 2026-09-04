import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { createCaseRecord } from "../src/server/cases";

async function main() {
  await prisma.referral.deleteMany();
  await prisma.partnerPanel.deleteMany();
  await prisma.stageEvent.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.caseParticipant.deleteMany();
  await prisma.case.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password", 10);

  const advisor = await prisma.user.create({
    data: {
      id: "seed_advisor",
      email: "advisor@example.com",
      name: "Demo Advisor",
      role: "ADVISOR",
      passwordHash,
    },
  });

  const client = await prisma.user.create({
    data: {
      id: "seed_client",
      email: "client@example.com",
      name: "Demo Client",
      role: "CLIENT",
      passwordHash,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        id: "seed_mortgage_partner",
        email: "mortgage@example.com",
        name: "Demo Mortgage Partner",
        role: "MORTGAGE_PARTNER",
        passwordHash,
      },
      {
        id: "seed_conveyancer",
        email: "conveyancer@example.com",
        name: "Demo Conveyancer",
        role: "CONVEYANCER",
        passwordHash,
      },
      {
        id: "seed_move_partner",
        email: "move@example.com",
        name: "Demo Move Partner",
        role: "MOVE_PARTNER",
        passwordHash,
      },
    ],
  });

  await prisma.partnerPanel.createMany({
    data: [
      {
        id: "seed_panel_priya",
        roleType: "MORTGAGE_PARTNER",
        name: "Priya Nair",
        firm: "Northstar Mortgages",
        slaDays: 3,
        userId: "seed_mortgage_partner",
        marketPackId: "ew",
      },
      {
        id: "seed_panel_ravi",
        roleType: "MORTGAGE_PARTNER",
        name: "Ravi Patel",
        firm: "Ledger Mortgages",
        slaDays: 3,
        active: false,
        marketPackId: "ew",
      },
      {
        id: "seed_panel_tom",
        roleType: "CONVEYANCER",
        name: "Tom Ashby",
        firm: "Harbour Law LLP",
        slaDays: 5,
        userId: "seed_conveyancer",
        marketPackId: "ew",
      },
      {
        id: "seed_panel_lena",
        roleType: "CONVEYANCER",
        name: "Lena Okoro",
        firm: "Greenway Conveyancing",
        slaDays: 5,
        marketPackId: "ew",
      },
      {
        id: "seed_panel_dan",
        roleType: "MOVE_PARTNER",
        name: "Dan Whitfield",
        firm: "Compass Removals",
        slaDays: 4,
        userId: "seed_move_partner",
        marketPackId: "ew",
      },
    ],
  });

  await createCaseRecord({
    title: "Bloggs return (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    attribution: {
      leadSource: "DIASPORA_AU_UK",
      leadCampaign: "poms-in-oz-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Smith DIY journey",
    entryContext: "UK_RESIDENT_SPEED",
    tier: "FREE_DIY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    attribution: {
      leadSource: "ORGANIC",
      leadCampaign: null,
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Okafor US return (free)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "FREE_DIY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    attribution: {
      leadSource: "DIASPORA_US_UK",
      leadCampaign: "brits-in-america-sept",
      leadReferrer: null,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
