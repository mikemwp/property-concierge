import { describe, it, expect } from "vitest";
import {
  assertOneTimeUpload,
  assertResetReason,
  assertSafeStorageKey,
  assertValidVaultFile,
  assertVaultAttachedForSubmit,
  canResetVaultDocument,
  canUploadVaultDocument,
  decodeVaultEventPayload,
  documentVisibleTo,
  encodeVaultEventPayload,
  MIN_VAULT_RESET_REASON_LENGTH,
  partnerReadStageKeys,
  sanitizeVaultFilename,
  VAULT_ALLOWED_MIME_TYPES,
  VAULT_MAX_BYTES,
  vaultPermission,
  vaultStorageKey,
  VaultError,
  type VaultDocumentRecord,
} from "../../src/domain/vault";

function doc(overrides: Partial<VaultDocumentRecord> = {}): VaultDocumentRecord {
  return {
    id: "doc_1",
    caseId: "case_1",
    stageKey: "purchase_profile",
    evidenceKind: "profile_complete",
    uploadedByRole: "CLIENT",
    uploadedByUserId: "user_client",
    originalFilename: "profile.pdf",
    mimeType: "application/pdf",
    byteSize: 128,
    storageKey: "case_1/doc_1",
    status: "ACTIVE",
    createdAt: "2026-09-04T10:00:00.000Z",
    ...overrides,
  };
}

const STAGES = [
  { key: "purchase_profile", ownerRole: "CLIENT" as const },
  { key: "mortgage_path", ownerRole: "MORTGAGE_PARTNER" as const },
  { key: "diligence", ownerRole: "CONVEYANCER" as const },
];

describe("one-time upload", () => {
  it("refuses a second ACTIVE file for the same kind and allows upload after RESET", () => {
    expect(() => assertOneTimeUpload(doc())).toThrow(VaultError);
    try {
      assertOneTimeUpload(doc());
    } catch (err) {
      expect((err as VaultError).code).toBe("ONE_TIME_UPLOAD");
    }
    expect(() => assertOneTimeUpload(null)).not.toThrow();
    expect(() => assertOneTimeUpload(doc({ status: "RESET" }))).not.toThrow();
  });
});

describe("submit requires an attached file only when the vault is on", () => {
  it("is a no-op when the module is off, even with no document", () => {
    expect(() =>
      assertVaultAttachedForSubmit({
        vaultEnabled: false,
        hasActiveDocument: false,
        kind: "profile_complete",
      }),
    ).not.toThrow();
  });

  it("throws VAULT_REQUIRED when the module is on and no ACTIVE document exists", () => {
    try {
      assertVaultAttachedForSubmit({
        vaultEnabled: true,
        hasActiveDocument: false,
        kind: "profile_complete",
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VaultError);
      expect((err as VaultError).code).toBe("VAULT_REQUIRED");
      expect((err as Error).message).toMatch(/profile_complete/);
    }
  });

  it("allows submit when the module is on and an ACTIVE document exists", () => {
    expect(() =>
      assertVaultAttachedForSubmit({
        vaultEnabled: true,
        hasActiveDocument: true,
        kind: "profile_complete",
      }),
    ).not.toThrow();
  });
});

describe("role ACL", () => {
  it("gives advisors RESET (which includes read) on every paid or free case", () => {
    expect(vaultPermission({ role: "ADVISOR", tier: "PAID_DWY" })).toBe("RESET");
    expect(vaultPermission({ role: "ADVISOR", tier: "FREE_DIY" })).toBe("RESET");
    expect(canResetVaultDocument("ADVISOR")).toBe(true);
    expect(canResetVaultDocument("CLIENT")).toBe(false);
    expect(canResetVaultDocument("CONVEYANCER")).toBe(false);
  });

  it("hides the vault from FREE_DIY clients and partners — attestation stays note-only", () => {
    expect(vaultPermission({ role: "CLIENT", tier: "FREE_DIY" })).toBe("NONE");
    expect(vaultPermission({ role: "MORTGAGE_PARTNER", tier: "FREE_DIY" })).toBe("NONE");
    expect(
      canUploadVaultDocument({
        role: "CLIENT",
        tier: "FREE_DIY",
        stageOwnerRole: "CLIENT",
        assigned: true,
        evidenceKind: "profile_complete",
        requiredKinds: ["profile_complete"],
      }),
    ).toBe(false);
    expect(
      documentVisibleTo(doc(), {
        role: "CLIENT",
        userId: "user_client",
        tier: "FREE_DIY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toBe(false);
  });

  it("lets a paid client upload on a client-owned required kind and read only their own files", () => {
    expect(vaultPermission({ role: "CLIENT", tier: "PAID_DWY" })).toBe("UPLOAD");
    expect(
      canUploadVaultDocument({
        role: "CLIENT",
        tier: "PAID_DWY",
        stageOwnerRole: "CLIENT",
        assigned: true,
        evidenceKind: "profile_complete",
        requiredKinds: ["profile_complete"],
      }),
    ).toBe(true);
    expect(
      canUploadVaultDocument({
        role: "CLIENT",
        tier: "PAID_DWY",
        stageOwnerRole: "MORTGAGE_PARTNER",
        assigned: true,
        evidenceKind: "dip_aip",
        requiredKinds: ["dip_aip"],
      }),
    ).toBe(false);
    expect(
      documentVisibleTo(doc(), {
        role: "CLIENT",
        userId: "user_client",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toBe(true);
    expect(
      documentVisibleTo(doc({ uploadedByUserId: "other_client" }), {
        role: "CLIENT",
        userId: "user_client",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toBe(false);
  });

  it("scopes partners to stages they own or were referred on", () => {
    expect(
      partnerReadStageKeys({
        stages: STAGES,
        partnerRole: "MORTGAGE_PARTNER",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).toEqual(["mortgage_path"]);
    expect(
      partnerReadStageKeys({
        stages: STAGES,
        partnerRole: "CONVEYANCER",
        assigned: false,
        hasActiveReferral: true,
      }),
    ).toEqual(["diligence"]);
    expect(
      partnerReadStageKeys({
        stages: STAGES,
        partnerRole: "MOVE_PARTNER",
        assigned: false,
        hasActiveReferral: false,
      }),
    ).toEqual([]);

    const partnerDoc = doc({
      stageKey: "mortgage_path",
      evidenceKind: "dip_aip",
      uploadedByRole: "MORTGAGE_PARTNER",
      uploadedByUserId: "user_mortgage",
    });
    expect(
      documentVisibleTo(partnerDoc, {
        role: "MORTGAGE_PARTNER",
        userId: "user_mortgage",
        tier: "PAID_DWY",
        readStageKeys: ["mortgage_path"],
      }),
    ).toBe(true);
    expect(
      documentVisibleTo(partnerDoc, {
        role: "CONVEYANCER",
        userId: "user_conveyancer",
        tier: "PAID_DWY",
        readStageKeys: ["diligence"],
      }),
    ).toBe(false);
    expect(
      canUploadVaultDocument({
        role: "MORTGAGE_PARTNER",
        tier: "PAID_DWY",
        stageOwnerRole: "MORTGAGE_PARTNER",
        assigned: true,
        evidenceKind: "dip_aip",
        requiredKinds: ["dip_aip"],
      }),
    ).toBe(true);
    expect(
      canUploadVaultDocument({
        role: "MORTGAGE_PARTNER",
        tier: "PAID_DWY",
        stageOwnerRole: "MORTGAGE_PARTNER",
        assigned: false,
        evidenceKind: "dip_aip",
        requiredKinds: ["dip_aip"],
      }),
    ).toBe(false);
  });

  it("lets the advisor read every document including RESET history", () => {
    const reset = doc({ status: "RESET" });
    expect(
      documentVisibleTo(reset, {
        role: "ADVISOR",
        userId: "user_advisor",
        tier: "PAID_DWY",
        readStageKeys: [],
      }),
    ).toBe(true);
  });
});

describe("file rules", () => {
  it("accepts an allowlisted PDF under the size cap and rejects everything else", () => {
    expect(() =>
      assertValidVaultFile({
        originalFilename: "offer.pdf",
        mimeType: "application/pdf",
        byteSize: 1024,
      }),
    ).not.toThrow();
    expect(VAULT_ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(VAULT_ALLOWED_MIME_TYPES).toContain("image/png");
    expect(VAULT_ALLOWED_MIME_TYPES).toContain("image/webp");
    expect(VAULT_ALLOWED_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    try {
      assertValidVaultFile({
        originalFilename: "notes.exe",
        mimeType: "application/x-msdownload",
        byteSize: 10,
      });
      expect.unreachable();
    } catch (err) {
      expect((err as VaultError).code).toBe("INVALID_FILE");
    }
    try {
      assertValidVaultFile({
        originalFilename: "huge.pdf",
        mimeType: "application/pdf",
        byteSize: VAULT_MAX_BYTES + 1,
      });
      expect.unreachable();
    } catch (err) {
      expect((err as VaultError).code).toBe("INVALID_FILE");
    }
  });

  it("strips path separators from filenames and refuses empty or dot names", () => {
    expect(sanitizeVaultFilename("C:\\\\tmp\\\\a/b.pdf")).toBe("C:tmpab.pdf");
    expect(sanitizeVaultFilename(`  ${"x".repeat(250)}.pdf  `).length).toBe(200);
    expect(() => sanitizeVaultFilename("..")).toThrow(VaultError);
    expect(() => sanitizeVaultFilename("")).toThrow(VaultError);
  });

  it("builds a storage key from ids and rejects traversal", () => {
    expect(vaultStorageKey("case_1", "doc_1")).toBe("case_1/doc_1");
    expect(() => assertSafeStorageKey("case_1/doc_1")).not.toThrow();
    expect(() => assertSafeStorageKey("../etc/passwd")).toThrow(VaultError);
    expect(() => assertSafeStorageKey("case_1/../doc_1")).toThrow(VaultError);
    expect(() => vaultStorageKey("case/1", "doc_1")).toThrow(VaultError);
  });
});

describe("reset reason and event payload", () => {
  it("requires a written reason and round-trips the ledger payload", () => {
    expect(MIN_VAULT_RESET_REASON_LENGTH).toBe(8);
    expect(() => assertResetReason("short")).toThrow(VaultError);
    expect(() => assertResetReason("Wrong file uploaded")).not.toThrow();
    const encoded = encodeVaultEventPayload({
      documentId: "doc_1",
      evidenceKind: "profile_complete",
      stageKey: "purchase_profile",
      filename: "profile.pdf",
      reason: "Wrong file uploaded",
    });
    expect(decodeVaultEventPayload(encoded)).toEqual({
      documentId: "doc_1",
      evidenceKind: "profile_complete",
      stageKey: "purchase_profile",
      filename: "profile.pdf",
      reason: "Wrong file uploaded",
    });
    expect(decodeVaultEventPayload("not-json")).toBeNull();
  });
});
