import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Spec §10: the stage engine is country-agnostic; local rules, copy and currency
 * live in market packs. These files are engine-global, so they may resolve a pack
 * through the registry but must never import the England & Wales pack directly and
 * must never contain a jurisdiction literal.
 */
const ENGINE_GLOBAL_FILES = [
  "src/domain/stage-engine.ts",
  "src/domain/case-admin.ts",
  "src/domain/escalation.ts",
  "src/domain/freemium.ts",
  "src/domain/panel.ts",
  "src/domain/scorecard.ts",
  "src/domain/partner-ops.ts",
  "src/server/mappers.ts",
  "src/lib/case-pack.ts",
];

const JURISDICTION_LITERAL = /£|\bGBP\b|en-GB|england|wales/i;
const EW_PACK_IMPORT = /from\s+["'][^"']*market-packs\/(ew|ew-config|ew-stages|ew-playbook|ew-disclosure)["']/;

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("engine-global modules stay country-agnostic", () => {
  it("contains no jurisdiction literal", () => {
    for (const file of ENGINE_GLOBAL_FILES) {
      expect(JURISDICTION_LITERAL.test(read(file)), `${file} has a jurisdiction literal`).toBe(
        false,
      );
    }
  });

  it("never imports the England & Wales pack directly", () => {
    for (const file of ENGINE_GLOBAL_FILES) {
      expect(EW_PACK_IMPORT.test(read(file)), `${file} imports the ew pack`).toBe(false);
    }
  });
});
