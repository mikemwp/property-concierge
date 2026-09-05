/**
 * Stub inbound rail secret check. Exported for route handler and tests.
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
