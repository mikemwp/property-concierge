import { describe, it, expect } from "vitest";
import { PartnerIntegrationError, applyPartnerUpdate, parseInboundUpdate } from "../../src/server/partner-integration";
import { decodePartnerEventPayload } from "../../src/domain/partner-integration";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

const NOW = new Date("2026-09-12T09:00:00.000Z");

async function storeWithOpenTicket() {
  const store = makeMemoryCaseStore(atMortgagePath());
  const { partnerPortForCase } = await import("../../src/lib/partner-adapters/registry");
  const port = partnerPortForCase(await store.load("pp1"), "MORTGAGE_PARTNER", store);
  const { ticketId } = await port.acknowledgeCase({
    caseId: "pp1",
    role: "MORTGAGE_PARTNER",
    panelMemberId: "seed_panel_priya",
    panelMemberName: "Priya Nair",
    now: new Date("2026-09-11T09:00:00.000Z"),
  });
  return { store, ticketId };
}

describe("parseInboundUpdate", () => {
  it("accepts a well-formed update", () => {
    expect(
      parseInboundUpdate({
        caseId: "pp1",
        ticketId: "ack-pp1-1",
        role: "MORTGAGE_PARTNER",
        status: "EVIDENCE_READY",
      }),
    ).toMatchObject({ caseId: "pp1", status: "EVIDENCE_READY" });
  });

  it("rejects unknown statuses, non-partner roles and missing fields", () => {
    const base = { caseId: "pp1", ticketId: "t", role: "MORTGAGE_PARTNER", status: "RECEIVED" };
    expect(() => parseInboundUpdate({ ...base, status: "SHIPPED" })).toThrow(PartnerIntegrationError);
    expect(() => parseInboundUpdate({ ...base, role: "ADVISOR" })).toThrow(PartnerIntegrationError);
    expect(() => parseInboundUpdate({ ...base, caseId: undefined })).toThrow(PartnerIntegrationError);
    expect(() => parseInboundUpdate("nope")).toThrow(PartnerIntegrationError);
  });
});

describe("applyPartnerUpdate", () => {
  it("turns EVIDENCE_READY into submitted evidence through the port", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const result = await applyPartnerUpdate(
      { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER", status: "EVIDENCE_READY" },
      { now: NOW, store },
    );

    expect(result.applied).toBe("SUBMIT_EVIDENCE");
    expect(result.eventTypes).toEqual(["EVIDENCE_SUBMITTED"]);
    const stage = (await store.load("pp1")).stages.find((s) => s.key === "mortgage_path")!;
    expect(stage.submittedEvidenceKinds).toEqual(["dip_aip"]);
    expect(stage.status).toBe("ACTIVE");
  });

  it("records a note for BLOCKED_ON_CLIENT without blocking the stage", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const result = await applyPartnerUpdate(
      { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER", status: "BLOCKED_ON_CLIENT" },
      { now: NOW, store },
    );

    expect(result.applied).toBe("NOTE_ONLY");
    const state = await store.load("pp1");
    expect(state.stages.find((s) => s.key === "mortgage_path")!.status).toBe("ACTIVE");
    expect(state.events.at(-1)!.type).toBe("PARTNER_STATUS_SYNCED");
  });

  it("audits a wrong-role update instead of dropping it", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const result = await applyPartnerUpdate(
      { caseId: "pp1", ticketId, role: "CONVEYANCER", status: "EVIDENCE_READY" },
      { now: NOW, store },
    );

    expect(result.applied).toBe("REJECT");
    const event = (await store.load("pp1")).events.at(-1)!;
    expect(event.type).toBe("PARTNER_UPDATE_REJECTED");
    expect(decodePartnerEventPayload(event.payload)!.reason).toMatch(/owner/i);
  });

  it("refuses an unknown ticket and never invents one", async () => {
    const { store } = await storeWithOpenTicket();
    const before = (await store.load("pp1")).events.length;
    await expect(
      applyPartnerUpdate(
        { caseId: "pp1", ticketId: "not-a-ticket", role: "MORTGAGE_PARTNER", status: "RECEIVED" },
        { now: NOW, store },
      ),
    ).rejects.toThrow(/ticket/i);
    expect((await store.load("pp1")).events).toHaveLength(before);
  });

  it("refuses a free case even with a valid ticket", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    await store.save({ ...(await store.load("pp1")), tier: "FREE_DIY" });
    await expect(
      applyPartnerUpdate(
        { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER", status: "RECEIVED" },
        { now: NOW, store },
      ),
    ).rejects.toThrow(/paid/i);
  });

  it("reports a valid milestone alongside the status, and refuses another role's", async () => {
    const { store, ticketId } = await storeWithOpenTicket();
    const base = { caseId: "pp1", ticketId, role: "MORTGAGE_PARTNER" as const, status: "IN_PROGRESS" as const };

    const result = await applyPartnerUpdate({ ...base, milestoneKey: "dip_submitted" }, { now: NOW, store });
    expect(result.eventTypes).toEqual(["PARTNER_STATUS_SYNCED", "PARTNER_MILESTONE_REPORTED"]);

    await expect(
      applyPartnerUpdate({ ...base, milestoneKey: "searches_ordered" }, { now: NOW, store }),
    ).rejects.toThrow(/milestone/i);
  });
});
