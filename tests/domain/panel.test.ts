import { describe, it, expect } from "vitest";
import {
  canViewDirectory,
  directoryEntries,
  type PanelMember,
} from "../../src/domain/panel";
import { createCase } from "../../src/domain/stage-engine";

const members: PanelMember[] = [
  {
    id: "p_conv_b",
    roleType: "CONVEYANCER",
    name: "Lena Okoro",
    firm: "Greenway Conveyancing",
    active: true,
    slaDays: 5,
    userId: null,
    marketPackId: "ew",
  },
  {
    id: "p_mort_inactive",
    roleType: "MORTGAGE_PARTNER",
    name: "Ravi Patel",
    firm: "Ledger Mortgages",
    active: false,
    slaDays: 3,
    userId: null,
    marketPackId: "ew",
  },
  {
    id: "p_mort_a",
    roleType: "MORTGAGE_PARTNER",
    name: "Priya Nair",
    firm: "Northstar Mortgages",
    active: true,
    slaDays: 3,
    userId: "seed_mortgage_partner",
    marketPackId: "ew",
  },
  {
    id: "p_conv_a",
    roleType: "CONVEYANCER",
    name: "Tom Ashby",
    firm: "Harbour Law LLP",
    active: true,
    slaDays: 5,
    userId: "seed_conveyancer",
    marketPackId: "ew",
  },
];

describe("directoryEntries", () => {
  it("lists active members only, sorted by role then name, with names and categories only", () => {
    const entries = directoryEntries(members);
    expect(entries).toEqual([
      { roleType: "CONVEYANCER", name: "Lena Okoro", firm: "Greenway Conveyancing" },
      { roleType: "CONVEYANCER", name: "Tom Ashby", firm: "Harbour Law LLP" },
      { roleType: "MORTGAGE_PARTNER", name: "Priya Nair", firm: "Northstar Mortgages" },
    ]);
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(["firm", "name", "roleType"]);
    }
  });
});

describe("canViewDirectory", () => {
  it("is true for free DIY cases and false for paid cases", () => {
    const free = createCase({ id: "d1", entryContext: "RETURNER_IN_UK", tier: "FREE_DIY" });
    const paid = createCase({ id: "d2", entryContext: "RETURNER_IN_UK", tier: "PAID_DWY" });
    expect(canViewDirectory(free)).toBe(true);
    expect(canViewDirectory(paid)).toBe(false);
  });
});
