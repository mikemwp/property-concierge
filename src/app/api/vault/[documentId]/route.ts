import { auth } from "@/lib/auth";
import type { ActorRole } from "@/domain/types";
import { isPartnerActorRole } from "@/domain/types";
import { VaultError } from "@/domain/vault";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import { activeReferralForRole } from "@/server/referrals";
import { authorizeVaultDownload } from "@/server/vault-download";
import { partnerScopeForCase } from "@/server/vault";
import { getVaultDocumentById, readVaultBytes } from "@/server/vault-store";

function statusFor(err: unknown): number {
  if (err instanceof VaultError) {
    if (err.code === "NOT_FOUND") return 404;
    if (err.code === "FORBIDDEN" || err.code === "FREE_TIER" || err.code === "VAULT_DISABLED") {
      return 403;
    }
    return 400;
  }
  if (err instanceof CaseAccessError) {
    return 403;
  }
  return 500;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;
  try {
    const document = await getVaultDocumentById(documentId);
    if (!document) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const role = session.user.role as ActorRole;
    const caseState = await loadCaseForUser(session.user.id, role, document.caseId);
    const referral = isPartnerActorRole(role)
      ? await activeReferralForRole(document.caseId, role)
      : null;
    const readStageKeys = isPartnerActorRole(role)
      ? partnerScopeForCase(caseState, role, {
          assigned: true,
          hasActiveReferral: referral !== null,
        })
      : [];

    authorizeVaultDownload({
      caseState,
      document,
      actor: { role, userId: session.user.id },
      readStageKeys,
    });

    const bytes = readVaultBytes(document.storageKey);
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.byteSize),
        "Content-Disposition": `attachment; filename="${document.originalFilename.replace(/"/g, "")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return Response.json({ ok: false, error: message }, { status: statusFor(err) });
  }
}
