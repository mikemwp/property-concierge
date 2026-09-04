import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ADAPTER_FILES = [
  "src/lib/partner-port.ts",
  "src/lib/partner-adapters/profiles.ts",
  "src/lib/partner-adapters/stub-adapter.ts",
  "src/lib/partner-adapters/registry.ts",
  "src/server/partner-integration.ts",
];

/** Spec §8: the stage engine is the source of truth and the advisor drives it. */
const ADVISOR_ONLY_POWERS = [
  "acceptEvidence",
  "advanceStage",
  "blockStage",
  "resumeStage",
  "reroutePartner",
  "createReferral",
];

const LIVE_VENDOR_CALL = /\bfetch\s*\(|\baxios\b|https?:\/\/(?!localhost)/;

function read(relative: string): string {
  const full = path.resolve(process.cwd(), relative);
  if (!existsSync(full)) {
    return "";
  }
  return readFileSync(full, "utf8");
}

describe("adapters never take advisor powers", () => {
  it("references no state transition the advisor owns, and no randomness", () => {
    for (const file of ADAPTER_FILES) {
      const source = read(file);
      if (!source) {
        continue;
      }
      for (const power of [...ADVISOR_ONLY_POWERS, "Math.random"]) {
        expect(source.includes(power), `${file} references ${power}`).toBe(false);
      }
    }
  });

  it("makes no outbound call to a third party", () => {
    const dir = "src/lib/partner-adapters";
    for (const entry of readdirSync(path.resolve(process.cwd(), dir))) {
      expect(LIVE_VENDOR_CALL.test(read(`${dir}/${entry}`)), `${dir}/${entry} calls out`).toBe(false);
    }
  });
});
