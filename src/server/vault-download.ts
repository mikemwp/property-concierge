import type { CaseState } from "../domain/stage-engine";
import {
  documentVisibleTo,
  VaultError,
  type VaultActor,
  type VaultDocumentRecord,
} from "../domain/vault";
import { canUseVault } from "./vault";

export function authorizeVaultDownload(input: {
  caseState: CaseState;
  document: VaultDocumentRecord;
  actor: VaultActor;
  readStageKeys: readonly string[];
}): VaultDocumentRecord {
  if (input.document.caseId !== input.caseState.id) {
    throw new VaultError("NOT_FOUND", "Vault document not found");
  }
  if (input.actor.role !== "ADVISOR" && !canUseVault(input.caseState)) {
    throw new VaultError("FORBIDDEN", "Document vault is not allowed for this case");
  }
  const allowed = documentVisibleTo(input.document, {
    role: input.actor.role,
    userId: input.actor.userId,
    tier: input.caseState.tier,
    readStageKeys: input.readStageKeys,
  });
  if (!allowed) {
    throw new VaultError("FORBIDDEN", "Not allowed to download this vault document");
  }
  return input.document;
}
