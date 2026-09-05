import { describe, it, expect } from "vitest";
import { decodePartnerEventPayload } from "../../src/domain/partner-integration";
import { ManualPartnerPort, PartnerPortError } from "../../src/lib/partner-port";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

const NOW = new Date("2026-09-10T09:00:00.000Z");

function context() {
  return {
    caseId: "pp1",
    role: "MORTGAGE_PARTNER" as const,
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
    now: NOW,
  };
}

describe("ManualPartnerPort implements the whole integration surface", () => {
  it("acknowledges as the partner, then reuses that ticket id for later calls", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store);

    const { ticketId } = await port.acknowledgeCase({ ...context(), note: "Called the client" });

    expect(port.adapterId).toBe("manual");
    expect(ticketId).toMatch(/^ack-pp1-/);
    const event = store.current().events.at(-1)!;
    expect(event).toMatchObject({
      type: "PARTNER_CASE_ACKNOWLEDGED",
      actorRole: "MORTGAGE_PARTNER",
      stageKey: "mortgage_path",
    });
    expect(decodePartnerEventPayload(event.payload)).toMatchObject({
      adapterId: "manual",
      status: "RECEIVED",
      note: "Called the client",
    });

    const milestone = await port.reportMilestone({ ...context(), milestoneKey: "dip_submitted" });
    expect(milestone.ticketId).toBe(ticketId);
    expect(store.current().events.at(-1)!.type).toBe("PARTNER_MILESTONE_REPORTED");
  });

  it("submits partner evidence through the engine with the frozen bare-kind payload", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store);

    await port.submitPartnerEvidence({ ...context(), stageKey: "mortgage_path", kind: "dip_aip" });

    const event = store.current().events.at(-1)!;
    expect(event.type).toBe("EVIDENCE_SUBMITTED");
    expect(event.payload).toBe("dip_aip");
    expect(store.current().stages.find((s) => s.key === "mortgage_path")!.submittedEvidenceKinds).toEqual([
      "dip_aip",
    ]);
  });

  it("reports the last known status on sync without inventing progress", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store);

    const before = await port.syncStatus(context());
    expect(before.status).toBe("RECEIVED");

    await port.acknowledgeCase(context());
    await port.submitPartnerEvidence({ ...context(), stageKey: "mortgage_path", kind: "dip_aip" });
    const after = await port.syncStatus(context());
    expect(after.status).toBe("EVIDENCE_READY");
    expect(store.current().events.at(-1)!.type).toBe("PARTNER_STATUS_SYNCED");
  });

  it("refuses a non-owning role and a milestone that is not this role's in this pack", async () => {
    const port = new ManualPartnerPort(makeMemoryCaseStore(atMortgagePath()));

    await expect(port.acknowledgeCase({ ...context(), role: "CONVEYANCER" })).rejects.toBeInstanceOf(
      PartnerPortError,
    );
    await expect(
      port.reportMilestone({ ...context(), milestoneKey: "searches_ordered" }),
    ).rejects.toThrow(/milestone/i);
  });
});
