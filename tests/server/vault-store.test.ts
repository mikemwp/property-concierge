import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { createCaseRecord } from "../../src/server/cases";
import {
  findActiveVaultDocument,
  insertVaultDocument,
  listVaultDocuments,
  markVaultDocumentReset,
  readVaultBytes,
  vaultRoot,
  writeVaultBytes,
} from "../../src/server/vault-store";
import { setVaultStorageForTests } from "../../src/server/vault-storage";
import { vaultStorageKey } from "../../src/domain/vault";

let caseId = "";
let root = "";

describe("vault store writes bytes to disk, not SQLite", () => {
  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "vault-store-"));
    process.env.VAULT_ROOT = root;
    setVaultStorageForTests(null);
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.vaultDocument.deleteMany();
    await prisma.referral.deleteMany();
    await prisma.partnerPanel.deleteMany();
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.createMany({
      data: [
        { id: "vs_client", email: "vs-client@example.com", role: "CLIENT", passwordHash },
        { id: "vs_advisor", email: "vs-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    const created = await createCaseRecord({
      title: "Vault store case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "vs_client",
      advisorUserId: "vs_advisor",
    });
    caseId = created.id;
  });

  beforeEach(async () => {
    process.env.VAULT_ROOT = root;
    await prisma.vaultDocument.deleteMany({ where: { caseId } });
  });

  afterAll(async () => {
    rmSync(root, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("stores metadata in Prisma and the file under VAULT_ROOT", async () => {
    const documentId = "docstore1";
    const storageKey = vaultStorageKey(caseId, documentId);
    const bytes = new Uint8Array([37, 80, 68, 70]);
    writeVaultBytes(storageKey, bytes);
    await insertVaultDocument({
      id: documentId,
      caseId,
      stageKey: "purchase_profile",
      evidenceKind: "profile_complete",
      uploadedByRole: "CLIENT",
      uploadedByUserId: "vs_client",
      originalFilename: "profile.pdf",
      mimeType: "application/pdf",
      byteSize: bytes.byteLength,
      storageKey,
    });

    const active = await findActiveVaultDocument(caseId, "purchase_profile", "profile_complete");
    expect(active?.id).toBe(documentId);
    expect(active?.storageKey).toBe(storageKey);
    expect(readVaultBytes(storageKey)).toEqual(bytes);
    expect(vaultRoot()).toBe(root);
    const row = await prisma.vaultDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(row).not.toHaveProperty("bytes");
    expect(Object.keys(row)).not.toContain("base64");
  });

  it("treats RESET as history so a new ACTIVE row can be attached", async () => {
    const firstId = "docreset1";
    const storageKey = vaultStorageKey(caseId, firstId);
    writeVaultBytes(storageKey, new Uint8Array([1]));
    await insertVaultDocument({
      id: firstId,
      caseId,
      stageKey: "purchase_profile",
      evidenceKind: "profile_complete",
      uploadedByRole: "CLIENT",
      uploadedByUserId: "vs_client",
      originalFilename: "old.pdf",
      mimeType: "application/pdf",
      byteSize: 1,
      storageKey,
    });
    await markVaultDocumentReset(firstId);
    expect(await findActiveVaultDocument(caseId, "purchase_profile", "profile_complete")).toBeNull();
    const listed = await listVaultDocuments(caseId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe("RESET");
  });

  it("delegates byte I/O through getVaultStorage", async () => {
    const storeSource = readFileSync(
      path.resolve(process.cwd(), "src/server/vault-store.ts"),
      "utf8",
    );
    expect(storeSource).toMatch(/getVaultStorage/);
    expect(storeSource).toMatch(/\.write\(/);
    expect(storeSource).toMatch(/\.read\(/);
  });
});
