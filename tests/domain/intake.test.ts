import { describe, it, expect } from "vitest";
import { DEFAULT_MARKET_PACK_ID } from "../../src/domain/market-packs/registry";
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

  it("defaults marketPackId to the beachhead pack", () => {
    const result = parseIntake(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.marketPackId).toBe(DEFAULT_MARKET_PACK_ID);
  });

  it("accepts diaspora self-serve corridor packs and copies their region prompt on empty region", () => {
    const auUk = parseIntake({ ...valid, marketPackId: "au_uk", targetRegion: "Bristol" });
    expect(auUk.ok && auUk.value.marketPackId).toBe("au_uk");

    const usUk = parseIntake({ ...valid, marketPackId: "us_uk" });
    expect(usUk.ok && usUk.value.marketPackId).toBe("us_uk");

    const missingRegion = parseIntake({
      ...valid,
      marketPackId: "au_uk",
      targetRegion: "",
    });
    expect(missingRegion.ok).toBe(false);
    if (missingRegion.ok) return;
    expect(missingRegion.errors.targetRegion).toMatch(/England & Wales/);
    expect(missingRegion.errors.targetRegion).toMatch(/Australia/);
  });

  it("refuses advisor-only and disabled packs on the public funnel", () => {
    const outbound = parseIntake({ ...valid, marketPackId: "uk_au" });
    expect(outbound.ok).toBe(false);
    if (outbound.ok) return;
    expect(outbound.errors.marketPackId).toMatch(/advisor/i);

    const stub = parseIntake({ ...valid, marketPackId: "au" });
    expect(stub.ok).toBe(false);
    if (stub.ok) return;
    expect(stub.errors.marketPackId).toMatch(/not enabled|not available/i);

    const unknown = parseIntake({ ...valid, marketPackId: "zz" });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.errors.marketPackId).toMatch(/unknown|not available/i);
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
