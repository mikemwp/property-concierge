import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { canUseVault } from "../../src/server/vault";

describe("vault actions honour the ew flag", () => {
  it("enables upload policy on paid ew and keeps free attestation file-free", () => {
    const paidCase = createCase({
      id: "va1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    const free = createCase({
      id: "va2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "FREE_DIY",
    });
    expect(canUseVault(paidCase)).toBe(true);
    expect(canUseVault(free)).toBe(false);
  });
});

describe("server action body limit", () => {
  it("allows a 10 MiB vault upload through Next", () => {
    const config = readFileSync(path.resolve(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toMatch(/bodySizeLimit:\s*["']12mb["']/);
  });
});
