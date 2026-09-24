import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError, type VaultDocumentRecord } from "../../src/domain/vault";
import { authorizeVaultDownload } from "../../src/server/vault-download";

const doc: VaultDocumentRecord = {
  id: "dl_1",
  caseId: "dlcase",
  stageKey: "purchase_profile",
  evidenceKind: "profile_complete",
  uploadedByRole: "CLIENT",
  uploadedByUserId: "user_client",
  originalFilename: "profile.pdf",
  mimeType: "application/pdf",
  byteSize: 4,
  storageKey: "dlcase/dl_1",
  status: "ACTIVE",
  createdAt: "2026-09-04T10:00:00.000Z",
};

function paid() {
  return createCase({ id: "dlcase", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("authorizeVaultDownload", () => {
  it("allows the advisor and the uploading paid client, and hides the file from a partner on another stage", () => {
    const caseState = paid();
    expect(
      authorizeVaultDownload({
        caseState,
        document: doc,
        actor: { role: "ADVISOR", userId: "adv" },
        readStageKeys: [],
      }).id,
    ).toBe("dl_1");
    expect(
      authorizeVaultDownload({
        caseState,
        document: doc,
        actor: { role: "CLIENT", userId: "user_client" },
        readStageKeys: ["purchase_profile"],
      }).id,
    ).toBe("dl_1");
    expect(() =>
      authorizeVaultDownload({
        caseState,
        document: doc,
        actor: { role: "CONVEYANCER", userId: "user_conveyancer" },
        readStageKeys: ["diligence"],
      }),
    ).toThrow(VaultError);
    expect(() =>
      authorizeVaultDownload({
        caseState: { ...caseState, tier: "FREE_DIY" },
        document: doc,
        actor: { role: "CLIENT", userId: "user_client" },
        readStageKeys: ["purchase_profile"],
      }),
    ).toThrow(/FREE_TIER|FORBIDDEN|not enabled|not allowed/i);
  });
});
