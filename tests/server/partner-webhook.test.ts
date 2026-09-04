import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import {
  acceptEvidence,
  advanceStage,
  submitEvidence,
} from "../../src/domain/stage-engine";
import { openTicketForRole } from "../../src/domain/partner-activity";
import { partnerPortForCase } from "../../src/lib/partner-adapters/registry";
import { prisma } from "../../src/lib/db";
import { createCaseRecord, loadCase, saveCase } from "../../src/server/cases";

async function advanceToMortgagePath(caseId: string): Promise<void> {
  let c = await loadCase(caseId);
  c = submitEvidence(c, {
    stageKey: "purchase_profile",
    kind: "profile_complete",
    actorRole: "CLIENT",
  });
  c = acceptEvidence(c, {
    stageKey: "purchase_profile",
    kind: "profile_complete",
    actorRole: "ADVISOR",
  });
  c = advanceStage(c, { actorRole: "ADVISOR" });
  c = submitEvidence(c, {
    stageKey: "money_readiness",
    kind: "source_of_funds",
    actorRole: "CLIENT",
  });
  c = acceptEvidence(c, {
    stageKey: "money_readiness",
    kind: "source_of_funds",
    actorRole: "ADVISOR",
  });
  c = advanceStage(c, { actorRole: "ADVISOR" });
  await saveCase(c);
}

async function postUpdate(body: unknown, secret: string | null = "dev-partner-secret") {
  const { POST } = await import("../../src/app/api/partner-updates/route");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) {
    headers["x-partner-signature"] = secret;
  }
  return POST(
    new Request("http://localhost/api/partner-updates", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

let caseId: string;

describe("webhook secret", () => {
  beforeEach(() => {
    process.env.PARTNER_WEBHOOK_SECRET = "dev-partner-secret";
  });

  it("accepts the configured secret and rejects everything else", async () => {
    const { verifyWebhookSecret } = await import("../../src/lib/partner-webhook-secret");
    expect(verifyWebhookSecret("dev-partner-secret")).toBe(true);
    expect(verifyWebhookSecret("dev-partner-secre")).toBe(false);
    expect(verifyWebhookSecret("")).toBe(false);
    expect(verifyWebhookSecret(null)).toBe(false);
  });

  it("fails closed when no secret is configured", async () => {
    delete process.env.PARTNER_WEBHOOK_SECRET;
    const { verifyWebhookSecret } = await import("../../src/lib/partner-webhook-secret");
    expect(verifyWebhookSecret("anything")).toBe(false);
  });
});

describe("POST /api/partner-updates", () => {
  beforeAll(async () => {
    process.env.PARTNER_WEBHOOK_SECRET = "dev-partner-secret";

    const passwordHash = await bcrypt.hash("password", 10);
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
        { id: "wh_client", email: "wh-client@example.com", role: "CLIENT", passwordHash },
        { id: "wh_advisor", email: "wh-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });

    const created = await createCaseRecord({
      title: "Webhook case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "wh_client",
      advisorUserId: "wh_advisor",
    });
    caseId = created.id;
    await advanceToMortgagePath(caseId);

    const caseState = await loadCase(caseId);
    const port = partnerPortForCase(caseState, "MORTGAGE_PARTNER");
    await port.acknowledgeCase({
      caseId,
      role: "MORTGAGE_PARTNER",
      panelMemberId: "seed_panel_priya",
      panelMemberName: "Priya Nair",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 401 when the shared secret is wrong or missing", async () => {
    const ticket = openTicketForRole(await loadCase(caseId), "MORTGAGE_PARTNER")!;
    const body = {
      caseId,
      ticketId: ticket.ticketId,
      role: "MORTGAGE_PARTNER",
      status: "IN_PROGRESS",
    };

    const badSecret = await postUpdate(body, "wrong-secret");
    expect(badSecret.status).toBe(401);
    expect(await badSecret.json()).toEqual({ ok: false, error: "Unauthorized" });

    const missing = await postUpdate(body, null);
    expect(missing.status).toBe(401);
  });

  it("returns 400 for a malformed body", async () => {
    const res = await postUpdate({ caseId, status: "SHIPPED" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(typeof json.error).toBe("string");
  });

  it("returns 409 when rails are off or the ticket is unknown", async () => {
    const ticket = openTicketForRole(await loadCase(caseId), "MORTGAGE_PARTNER")!;

    const unknownTicket = await postUpdate({
      caseId,
      ticketId: "not-a-real-ticket",
      role: "MORTGAGE_PARTNER",
      status: "RECEIVED",
    });
    expect(unknownTicket.status).toBe(409);
    expect((await unknownTicket.json()).ok).toBe(false);

    const railsCase = await createCaseRecord({
      title: "Rails off webhook case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "wh_client",
      advisorUserId: "wh_advisor",
    });
    await advanceToMortgagePath(railsCase.id);
    const railsPort = partnerPortForCase(await loadCase(railsCase.id), "MORTGAGE_PARTNER");
    const { ticketId: railsTicketId } = await railsPort.acknowledgeCase({
      caseId: railsCase.id,
      role: "MORTGAGE_PARTNER",
      panelMemberId: null,
      panelMemberName: null,
    });
    await saveCase({ ...(await loadCase(railsCase.id)), tier: "FREE_DIY" });

    const railsOff = await postUpdate({
      caseId: railsCase.id,
      ticketId: railsTicketId,
      role: "MORTGAGE_PARTNER",
      status: "RECEIVED",
    });
    expect(railsOff.status).toBe(409);
    expect((await railsOff.json()).error).toMatch(/paid|rails/i);
  });

  it("returns 200 with applied intent on success", async () => {
    const ticket = openTicketForRole(await loadCase(caseId), "MORTGAGE_PARTNER")!;
    const res = await postUpdate({
      caseId,
      ticketId: ticket.ticketId,
      role: "MORTGAGE_PARTNER",
      status: "IN_PROGRESS",
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, applied: "NOTE_ONLY" });
    expect(json.eventTypes).toContain("PARTNER_STATUS_SYNCED");
  });
});
