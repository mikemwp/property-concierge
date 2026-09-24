import type { CaseState } from "@/domain/stage-engine";
import { isModuleEnabled } from "@/domain/market-packs/types";
import type { ActorRole } from "@/domain/types";
import { type CaseStore, prismaCaseStore } from "@/lib/case-store";
import { casePack } from "@/lib/case-pack";
import { ManualPartnerPort, type PartnerPort } from "@/lib/partner-port";
import { prismaVaultPresenceLookup, type VaultPresenceLookup } from "@/server/vault";
import { profileForRole } from "./profiles";
import { StubPartnerAdapter } from "./stub-adapter";

/** Deliberate twin of canUseSpeedRails in src/server/partner-policy.ts — lib must not import server. */
function railsEnabled(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "partner_speed_rails");
  } catch {
    return false;
  }
}

export function partnerPortForRole(
  role: ActorRole,
  store: CaseStore = prismaCaseStore,
  vaultLookup: VaultPresenceLookup = prismaVaultPresenceLookup,
): PartnerPort {
  const profile = profileForRole(role);
  return profile
    ? new StubPartnerAdapter(profile, store, vaultLookup)
    : new ManualPartnerPort(store, vaultLookup);
}

/**
 * Rails are opt-in per market and per tier. A pack without partner_speed_rails, a free
 * case, or an unresolvable pack all fall back to manual ops — the v1 behaviour.
 */
export function partnerPortForCase(
  caseState: CaseState,
  role: ActorRole,
  store: CaseStore = prismaCaseStore,
  vaultLookup: VaultPresenceLookup = prismaVaultPresenceLookup,
): PartnerPort {
  return railsEnabled(caseState)
    ? partnerPortForRole(role, store, vaultLookup)
    : new ManualPartnerPort(store, vaultLookup);
}

/** UI overlay: warm-intro tickets omit adapterId in the ledger until the first stub event. */
export function displayTicketAdapterId(
  caseState: CaseState,
  ticket: { role: ActorRole; adapterId: string },
): string {
  if (railsEnabled(caseState) && ticket.adapterId === "manual") {
    return partnerPortForCase(caseState, ticket.role).adapterId;
  }
  return ticket.adapterId;
}
