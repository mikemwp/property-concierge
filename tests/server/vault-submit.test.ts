import { describe, expect, it } from "vitest";
import { ManualPartnerPort } from "../../src/lib/partner-port";
import { allowAllVaultLookup, emptyVaultLookup } from "../../src/server/vault";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

describe("partner port cannot skip the vault lookup once the module is on", () => {
  it("refuses submit when the lookup is empty", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store, emptyVaultLookup);
    await expect(
      port.submitPartnerEvidence({
        caseId: "pp1",
        role: "MORTGAGE_PARTNER",
        panelMemberId: "seed_panel_priya",
        panelMemberName: "Priya Nair",
        stageKey: "mortgage_path",
        kind: "dip_aip",
      }),
    ).rejects.toMatchObject({ code: "VAULT_REQUIRED" });
  });

  it("allows submit when the lookup reports an ACTIVE file", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store, allowAllVaultLookup);
    await expect(
      port.submitPartnerEvidence({
        caseId: "pp1",
        role: "MORTGAGE_PARTNER",
        panelMemberId: "seed_panel_priya",
        panelMemberName: "Priya Nair",
        stageKey: "mortgage_path",
        kind: "dip_aip",
      }),
    ).resolves.toMatchObject({ eventType: "EVIDENCE_SUBMITTED" });
  });
});
