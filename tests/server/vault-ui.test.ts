import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("vault surfaces", () => {
  it("keeps EvidenceSubmitForm for vault-off and free attestation, and mounts vault UI behind the flag", () => {
    const portal = read("src/app/portal/cases/[caseId]/page.tsx");
    const partner = read("src/app/partner/cases/[caseId]/page.tsx");
    const cockpit = read("src/app/cockpit/cases/[caseId]/page.tsx");
    const upload = read("src/components/VaultUploadForm.tsx");
    const panel = read("src/components/VaultPanel.tsx");

    expect(portal).toContain("canUseVault");
    expect(portal).toContain("VaultUploadForm");
    expect(portal).toContain("VaultPanel");
    expect(portal).toContain("EvidenceSubmitForm");
    expect(portal).toContain("uploadAndSubmitEvidenceAction");
    expect(portal).not.toContain("resetVaultDocumentAction");

    expect(partner).toContain("canUseVault");
    expect(partner).toContain("VaultUploadForm");
    expect(partner).toContain("uploadAndSubmitPartnerEvidenceAction");
    expect(partner).not.toContain("resetVaultDocumentAction");

    expect(cockpit).toContain("VaultPanel");
    expect(cockpit).toContain("resetVaultDocumentAction");
    expect(cockpit).not.toContain("VaultUploadForm");

    expect(upload).toContain('type="file"');
    expect(upload).toContain('name="file"');
    expect(upload).toContain("Upload and submit");
    expect(panel).toContain("/api/vault/");
    expect(panel).toContain("Reset");
  });
});
