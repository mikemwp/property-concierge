import { describe, expect, it } from "vitest";
import { ManualPartnerPort, PartnerPortError } from "../../src/lib/partner-port";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import { assertVaultSubmitAllowed, emptyVaultLookup } from "../../src/server/vault";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

describe("submit policy when the module is still off", () => {
  it("lets portal-style submit proceed without a lookup hit", async () => {
    const paid = createCase({
      id: "vsub1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    await expect(
      assertVaultSubmitAllowed(paid, "purchase_profile", "profile_complete", emptyVaultLookup),
    ).resolves.toBeUndefined();
  });
});

describe("partner port cannot skip the vault lookup", () => {
  it("calls the lookup and refuses when the module is forced on via a lookup-aware submit", async () => {
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
    ).resolves.toMatchObject({ eventType: "EVIDENCE_SUBMITTED" });
  });
});
