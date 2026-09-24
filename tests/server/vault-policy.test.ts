import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import {
  assertVaultEnabled,
  assertVaultSubmitAllowed,
  canUseVault,
  emptyVaultLookup,
  partnerScopeForCase,
  visibleVaultDocuments,
} from "../../src/server/vault";
import type { VaultDocumentRecord } from "../../src/domain/vault";

function paid(id = "vp1") {
  return createCase({ id, entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

const sample: VaultDocumentRecord = {
  id: "doc_1",
  caseId: "vp1",
  stageKey: "purchase_profile",
  evidenceKind: "profile_complete",
  uploadedByRole: "CLIENT",
  uploadedByUserId: "user_client",
  originalFilename: "profile.pdf",
  mimeType: "application/pdf",
  byteSize: 12,
  storageKey: "vp1/doc_1",
  status: "ACTIVE",
  createdAt: "2026-09-04T10:00:00.000Z",
};

describe("document_vault module gate", () => {
  it("is open for paid England & Wales and paid corridor packs, and closed otherwise", async () => {
    expect(canUseVault(paid())).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "au_uk" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "uk_au" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "us_uk" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "uk_us" })).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "au" })).toBe(false);
    expect(canUseVault({ ...paid("vp2"), tier: "FREE_DIY" })).toBe(false);
    expect(canUseVault({ ...paid("vp3"), tier: "FREE_DIY", marketPackId: "au_uk" })).toBe(false);
    expect(() => assertVaultEnabled(paid())).not.toThrow();
    expect(() => assertVaultEnabled({ ...paid(), marketPackId: "au_uk" })).not.toThrow();
    expect(() => assertVaultEnabled({ ...paid(), marketPackId: "au" })).toThrow(VaultError);

    await expect(
      assertVaultSubmitAllowed(
        { ...paid(), marketPackId: "au_uk" },
        "purchase_profile",
        "profile_complete",
        emptyVaultLookup,
      ),
    ).rejects.toMatchObject({ code: "VAULT_REQUIRED" });
  });
});

describe("visibility filter", () => {
  it("shows the client their upload, the advisor everything, and a stranger nothing", () => {
    const caseState = paid();
    expect(
      visibleVaultDocuments([sample], {
        role: "CLIENT",
        userId: "user_client",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }).map((row) => row.id),
    ).toEqual(["doc_1"]);
    expect(
      visibleVaultDocuments([sample], {
        role: "CLIENT",
        userId: "other",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toEqual([]);
    expect(
      visibleVaultDocuments([sample], {
        role: "ADVISOR",
        userId: "adv",
        tier: "PAID_DWY",
        readStageKeys: [],
      }),
    ).toHaveLength(1);
    expect(
      partnerScopeForCase(caseState, "MORTGAGE_PARTNER", {
        assigned: true,
        hasActiveReferral: false,
      }),
    ).toEqual(["mortgage_path"]);
  });
});
