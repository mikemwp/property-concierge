import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import {
  assertVaultSubmitAllowed,
  canUseVault,
  emptyVaultLookup,
} from "../../src/server/vault";

function paidCorridor(id: string, marketPackId: "au_uk" | "uk_au" | "us_uk" | "uk_us") {
  return createCase({
    id,
    entryContext: "RETURNER_OVERSEAS",
    tier: "PAID_DWY",
    marketPackId,
  });
}

describe("corridor cases reuse the document vault", () => {
  it("opens the same gate on each live corridor pack", async () => {
    for (const id of ["au_uk", "uk_au", "us_uk", "uk_us"] as const) {
      const caseState = paidCorridor(`vc_${id}`, id);
      expect(caseState.marketPackId).toBe(id);
      expect(canUseVault(caseState)).toBe(true);
      await expect(
        assertVaultSubmitAllowed(caseState, "purchase_profile", "profile_complete", emptyVaultLookup),
      ).rejects.toBeInstanceOf(VaultError);
    }
  });

  it("does not hard-code England & Wales in the vault surfaces", () => {
    const portal = readFileSync(
      path.resolve(process.cwd(), "src/app/portal/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const partner = readFileSync(
      path.resolve(process.cwd(), "src/app/partner/cases/[caseId]/page.tsx"),
      "utf8",
    );
    const cockpit = readFileSync(
      path.resolve(process.cwd(), "src/app/cockpit/cases/[caseId]/page.tsx"),
      "utf8",
    );
    for (const source of [portal, partner, cockpit]) {
      expect(source).toMatch(/canUseVault/);
      expect(source).not.toMatch(/marketPackId === ["']ew["']/);
      expect(source).not.toMatch(/document_vault.*ew only/i);
    }
  });
});
