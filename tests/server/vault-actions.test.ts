import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import { performVaultReset, performVaultUpload } from "../../src/server/vault";

function paid() {
  return createCase({ id: "va1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("vault actions refuse work while the module is off", () => {
  it("does not upload or reset on ew until the flag flips", async () => {
    await expect(
      performVaultUpload({
        caseState: paid(),
        actor: { role: "CLIENT", userId: "user_client" },
        stageKey: "purchase_profile",
        evidenceKind: "profile_complete",
        assigned: true,
        file: {
          originalFilename: "profile.pdf",
          mimeType: "application/pdf",
          bytes: new Uint8Array([37, 80, 68, 70]),
        },
      }),
    ).rejects.toBeInstanceOf(VaultError);

    await expect(
      performVaultReset({
        caseState: paid(),
        actor: { role: "ADVISOR", userId: "user_advisor" },
        documentId: "missing",
        reason: "Wrong file uploaded",
      }),
    ).rejects.toMatchObject({ code: "VAULT_DISABLED" });
  });
});

describe("server action body limit", () => {
  it("allows a 10 MiB vault upload through Next", () => {
    const config = readFileSync(path.resolve(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toMatch(/bodySizeLimit:\s*["']12mb["']/);
  });
});
