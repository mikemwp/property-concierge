import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { createCaseRecord } from "../src/server/cases";

async function main() {
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
      {
        id: "seed_panel_priya_au_uk",
        roleType: "MORTGAGE_PARTNER",
        name: "Priya Nair",
        firm: "Northstar Mortgages",
        slaDays: 3,
        marketPackId: "au_uk",
      },
      {
        id: "seed_panel_tom_au_uk",
        roleType: "CONVEYANCER",
        name: "Tom Ashby",
        firm: "Harbour Law LLP",
        slaDays: 5,
        marketPackId: "au_uk",
      },
      {
        id: "seed_panel_dan_au_uk",
        roleType: "MOVE_PARTNER",
        name: "Dan Whitfield",
        firm: "Compass Removals",
        slaDays: 4,
        marketPackId: "au_uk",
      },
      {
        id: "seed_panel_priya_us_uk",
        roleType: "MORTGAGE_PARTNER",
        name: "Priya Nair",
        firm: "Northstar Mortgages",
        slaDays: 3,
        marketPackId: "us_uk",
      },
      {
        id: "seed_panel_tom_us_uk",
        roleType: "CONVEYANCER",
        name: "Tom Ashby",
        firm: "Harbour Law LLP",
        slaDays: 5,
        marketPackId: "us_uk",
      },
      {
        id: "seed_panel_dan_us_uk",
        roleType: "MOVE_PARTNER",
        name: "Dan Whitfield",
        firm: "Compass Removals",
        slaDays: 4,
        marketPackId: "us_uk",
      },
      {
        id: "seed_panel_mia_uk_au",
        roleType: "MORTGAGE_PARTNER",
        name: "Mia Chen",
        firm: "Harbour Brokers",
        slaDays: 3,
        marketPackId: "uk_au",
      },
      {
        id: "seed_panel_owen_uk_au",
        roleType: "CONVEYANCER",
        name: "Owen Blake",
        firm: "Southern Title",
        slaDays: 5,
        marketPackId: "uk_au",
      },
      {
        id: "seed_panel_sam_uk_au",
        roleType: "MOVE_PARTNER",
        name: "Sam Reid",
        firm: "Southern Cross Removalists",
        slaDays: 4,
        marketPackId: "uk_au",
      },
      {
        id: "seed_panel_jordan_uk_us",
        roleType: "MORTGAGE_PARTNER",
        name: "Jordan Hale",
        firm: "Liberty Lending",
        slaDays: 3,
        marketPackId: "uk_us",
      },
      {
        id: "seed_panel_riley_uk_us",
        roleType: "CONVEYANCER",
        name: "Riley Cho",
        firm: "Harbor Title",
        slaDays: 5,
        marketPackId: "uk_us",
      },
      {
        id: "seed_panel_pat_uk_us",
        roleType: "MOVE_PARTNER",
        name: "Pat Nguyen",
        firm: "Atlantic Movers",
        slaDays: 4,
        marketPackId: "uk_us",
      },
    ],
  });

  const bloggs = await createCaseRecord({
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

  await prisma.caseMessage.create({
    data: {
      caseId: bloggs.id,
      authorUserId: advisor.id,
      authorRole: "ADVISOR",
      body: "Welcome to the Bloggs case thread. I will stay in this conversation with every partner we introduce.",
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

  await createCaseRecord({
    title: "Chen AU→UK return (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "au_uk",
    attribution: {
      leadSource: "DIASPORA_AU_UK",
      leadCampaign: "poms-in-oz-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Morales US→UK return (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "us_uk",
    attribution: {
      leadSource: "DIASPORA_US_UK",
      leadCampaign: "brits-in-america-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Patel UK→AU purchase (paid)",
    entryContext: "UK_RESIDENT_SPEED",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "uk_au",
    attribution: {
      leadSource: "DIASPORA_UK_AU",
      leadCampaign: "brits-to-australia-sept",
      leadReferrer: null,
    },
  });

  await createCaseRecord({
    title: "Hughes UK→US purchase (paid)",
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    clientUserId: client.id,
    advisorUserId: advisor.id,
    marketPackId: "uk_us",
    attribution: {
      leadSource: "DIASPORA_UK_US",
      leadCampaign: "brits-to-america-sept",
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
