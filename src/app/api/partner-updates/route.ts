import {
  applyPartnerUpdate,
  parseInboundUpdate,
  type InboundPartnerUpdate,
} from "@/server/partner-integration";

/**
 * Stub inbound rail. Spec §7: partner ops sit behind a clean interface so a real
 * integration can land later without a rewrite. This endpoint is a local loopback for
 * the demo — one shared secret, no vendor signing scheme, no live partner calls out.
 */
export function verifyWebhookSecret(header: string | null): boolean {
  const expected = process.env.PARTNER_WEBHOOK_SECRET;
  if (!expected || !header || header.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return mismatch === 0;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

export async function POST(request: Request): Promise<Response> {
  if (!verifyWebhookSecret(request.headers.get("x-partner-signature"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let update: InboundPartnerUpdate;
  try {
    update = parseInboundUpdate(await request.json());
  } catch (err) {
    return Response.json({ ok: false, error: message(err) }, { status: 400 });
  }
  try {
    const result = await applyPartnerUpdate(update);
    return Response.json({ ok: true, applied: result.applied, eventTypes: result.eventTypes });
  } catch (err) {
    return Response.json({ ok: false, error: message(err) }, { status: 409 });
  }
}
