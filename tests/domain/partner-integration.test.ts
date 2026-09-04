import { describe, it, expect } from "vitest";
import {
  decodePartnerEventPayload,
  encodePartnerEventPayload,
  intentForStatus,
  isPartnerStatus,
  mintTicketId,
  partnerEvidenceInbox,
  PARTNER_INTEGRATION_EVENT_TYPES,
} from "../../src/domain/partner-integration";
import type { StageState } from "../../src/domain/stage-engine";

function stage(overrides: Partial<StageState> = {}): StageState {
  return {
    key: "mortgage_path",
    title: "Mortgage path",
    sortOrder: 2,
    status: "ACTIVE",
    ownerRole: "MORTGAGE_PARTNER",
    dueAt: null,
    activatedAt: "2026-09-01T09:00:00.000Z",
    completedAt: null,
    blockedReason: null,
    requiredEvidenceKinds: ["dip_aip", "lender_pack"],
    freeVisible: true,
    freeCanSelfAdvance: false,
    acceptedEvidenceKinds: [],
    submittedEvidenceKinds: [],
    ...overrides,
  };
}

describe("integration vocabulary", () => {
  it("closes the status set and the additive event-type set", () => {
    expect(isPartnerStatus("EVIDENCE_READY")).toBe(true);
    expect(isPartnerStatus("SHIPPED")).toBe(false);
    expect(PARTNER_INTEGRATION_EVENT_TYPES).toEqual([
      "PARTNER_CASE_ACKNOWLEDGED",
      "PARTNER_STATUS_SYNCED",
      "PARTNER_MILESTONE_REPORTED",
      "PARTNER_UPDATE_REJECTED",
    ]);
  });

  it("mints stable, prefixed, collision-resistant ticket ids", () => {
    const id = mintTicketId({ prefix: "ack", caseId: "c1", at: "2026-09-01T09:00:00.000Z" });
    expect(id).toBe("ack-c1-1788253200000");
    expect(mintTicketId({ prefix: "warm", caseId: "c1", at: "2026-09-01T09:00:00.000Z" })).toBe(
      "warm-c1-1788253200000",
    );
  });
});

describe("payload codec", () => {
  it("round-trips the envelope", () => {
    const envelope = {
      ticketId: "ack-c1-1",
      adapterId: "stub-mortgage",
      role: "MORTGAGE_PARTNER" as const,
      panelMemberId: "seed_panel_priya",
      status: "IN_PROGRESS" as const,
      note: "Fact find booked",
    };
    expect(decodePartnerEventPayload(encodePartnerEventPayload(envelope))).toEqual(envelope);
  });

  it("normalises the frozen warm-intro payload into the same envelope", () => {
    const legacy = JSON.stringify({
      partnerType: "CONVEYANCER",
      note: "Needs instructing this week",
      ticketId: "warm-c1-99",
      panelMemberId: "seed_panel_tom",
      panelMemberName: "Tom Ashby",
    });
    expect(decodePartnerEventPayload(legacy)).toMatchObject({
      ticketId: "warm-c1-99",
      role: "CONVEYANCER",
      adapterId: "manual",
      panelMemberName: "Tom Ashby",
    });
  });

  it("returns null for a bare string payload or malformed JSON", () => {
    expect(decodePartnerEventPayload("dip_aip")).toBeNull();
    expect(decodePartnerEventPayload(undefined)).toBeNull();
    expect(decodePartnerEventPayload("{oops")).toBeNull();
  });
});

describe("intentForStatus", () => {
  it("acknowledges receipt without touching evidence", () => {
    expect(intentForStatus({ status: "RECEIVED", role: "MORTGAGE_PARTNER", stage: stage() })).toEqual({
      kind: "ACKNOWLEDGE",
    });
  });

  it("records progress and client-blocked as notes, never as engine blocks", () => {
    expect(intentForStatus({ status: "IN_PROGRESS", role: "MORTGAGE_PARTNER", stage: stage() }).kind).toBe(
      "NOTE_ONLY",
    );
    expect(
      intentForStatus({ status: "BLOCKED_ON_CLIENT", role: "MORTGAGE_PARTNER", stage: stage() }),
    ).toEqual({ kind: "NOTE_ONLY", note: "Partner is waiting on the client" });
  });

  it("submits only the outstanding kinds for EVIDENCE_READY and COMPLETE alike", () => {
    expect(
      intentForStatus({
        status: "EVIDENCE_READY",
        role: "MORTGAGE_PARTNER",
        stage: stage({ acceptedEvidenceKinds: ["dip_aip"] }),
      }),
    ).toEqual({ kind: "SUBMIT_EVIDENCE", kinds: ["lender_pack"] });
    expect(intentForStatus({ status: "COMPLETE", role: "MORTGAGE_PARTNER", stage: stage() })).toEqual({
      kind: "SUBMIT_EVIDENCE",
      kinds: ["dip_aip", "lender_pack"],
    });
  });

  it("rejects a wrong-role update and any update on a closed stage", () => {
    expect(
      intentForStatus({ status: "EVIDENCE_READY", role: "CONVEYANCER", stage: stage() }),
    ).toEqual({ kind: "REJECT", reason: "Stage owner is MORTGAGE_PARTNER, not CONVEYANCER" });
    expect(
      intentForStatus({
        status: "IN_PROGRESS",
        role: "MORTGAGE_PARTNER",
        stage: stage({ status: "DONE" }),
      }),
    ).toEqual({ kind: "REJECT", reason: "Stage is not open for partner updates" });
  });

  it("notes rather than resubmits when nothing is outstanding", () => {
    expect(
      intentForStatus({
        status: "EVIDENCE_READY",
        role: "MORTGAGE_PARTNER",
        stage: stage({ acceptedEvidenceKinds: ["dip_aip"], submittedEvidenceKinds: ["lender_pack"] }),
      }),
    ).toEqual({ kind: "NOTE_ONLY", note: "All required evidence is already with the advisor" });
  });
});

describe("partnerEvidenceInbox", () => {
  it("splits required kinds into to-submit, awaiting acceptance and accepted", () => {
    expect(
      partnerEvidenceInbox(
        stage({ acceptedEvidenceKinds: ["dip_aip"], requiredEvidenceKinds: ["dip_aip", "lender_pack", "id_check"], submittedEvidenceKinds: ["lender_pack"] }),
      ),
    ).toEqual({
      toSubmit: ["id_check"],
      awaitingAcceptance: ["lender_pack"],
      accepted: ["dip_aip"],
      complete: false,
    });
  });

  it("reports complete when every required kind is accepted", () => {
    expect(
      partnerEvidenceInbox(
        stage({ requiredEvidenceKinds: ["dip_aip"], acceptedEvidenceKinds: ["dip_aip"] }),
      ).complete,
    ).toBe(true);
  });
});
