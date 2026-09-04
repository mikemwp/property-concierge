import { describe, it, expect } from "vitest";
import { caseTitleFor, parseIntake } from "../../src/domain/intake";

const valid = {
  name: "Bloggs household",
  email: "Jo@Example.com",
  password: "returning2026",
  entryContext: "RETURNER_OVERSEAS",
  plan: "paid",
  targetRegion: "Bristol",
};

describe("parseIntake", () => {
  it("normalises a valid submission", () => {
    const result = parseIntake(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("jo@example.com");
    expect(result.value.tier).toBe("PAID_DWY");
    expect(result.value.entryContext).toBe("RETURNER_OVERSEAS");
    expect(result.value.caseTitle).toBe("Bloggs household — Bristol");
  });

  it("defaults to the paid tier when no plan is supplied", () => {
    const result = parseIntake({ ...valid, plan: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe("PAID_DWY");
  });

  it("only drops to free when free is explicitly chosen", () => {
    const free = parseIntake({ ...valid, plan: "free" });
    expect(free.ok && free.value.tier).toBe("FREE_DIY");

    const junk = parseIntake({ ...valid, plan: "premium-plus" });
    expect(junk.ok && junk.value.tier).toBe("PAID_DWY");
  });

  it("collects field errors instead of throwing", () => {
    const result = parseIntake({
      name: "  ",
      email: "not-an-email",
      password: "short",
      entryContext: "MARS_RESIDENT",
      plan: "paid",
      targetRegion: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "email",
      "entryContext",
      "name",
      "password",
      "targetRegion",
    ]);
  });
});

describe("caseTitleFor", () => {
  it("builds a household case title", () => {
    expect(caseTitleFor(" Okafor household ", " Leeds ")).toBe(
      "Okafor household — Leeds",
    );
  });
});
