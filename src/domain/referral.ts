import { isPartnerActorRole, type ActorRole } from "./types";

export const FEE_STATUSES = ["NONE", "EXPECTED", "RECEIVED", "WAIVED"] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

export const REFERRAL_SOURCES = ["WARM_INTRO", "ADVISOR_MARK", "REROUTE"] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** Spec §8: "Referral event (partner, case, fee status, disclosure record)". Fees are recorded, never paid here. */
export type ReferralRecord = {
  id: string;
  caseId: string;
  partnerId: string;
  partnerName: string;
  partnerFirm: string | null;
  partnerRole: ActorRole;
  source: ReferralSource;
  feeStatus: FeeStatus;
  disclosureText: string;
  disclosedAt: string;
  supersededAt: string | null;
  createdAt: string;
};

export function isFeeStatus(value: string): value is FeeStatus {
  return (FEE_STATUSES as readonly string[]).includes(value);
}

export function isReferralSource(value: string): value is ReferralSource {
  return (REFERRAL_SOURCES as readonly string[]).includes(value);
}

export function defaultFeeStatus(role: ActorRole): FeeStatus {
  return isPartnerActorRole(role) ? "EXPECTED" : "NONE";
}

const FEE_TRANSITIONS: Record<FeeStatus, readonly FeeStatus[]> = {
  NONE: ["EXPECTED", "WAIVED"],
  EXPECTED: ["RECEIVED", "WAIVED"],
  RECEIVED: [],
  WAIVED: [],
};

export function canTransitionFee(from: FeeStatus, to: FeeStatus): boolean {
  return FEE_TRANSITIONS[from].includes(to);
}

function displayName(partnerName: string, partnerFirm: string | null): string {
  return partnerFirm ? `${partnerName} (${partnerFirm})` : partnerName;
}

/**
 * England & Wales disclosure wording. Spec §7: mortgage = introducer only, no advice;
 * conveyancing referrals lawful if disclosed. Keyed by role so a future market pack can override.
 */
export function disclosureTextFor(input: {
  role: ActorRole;
  partnerName: string;
  partnerFirm: string | null;
}): string {
  const who = displayName(input.partnerName, input.partnerFirm);
  switch (input.role) {
    case "MORTGAGE_PARTNER":
      return `Property Concierge introduced you to ${who}. We act as an introducer only and do not give mortgage advice. We may receive an introducer fee from ${who} if you take a mortgage product through them. You are free to use any mortgage adviser.`;
    case "CONVEYANCER":
      return `Property Concierge referred you to ${who}. We may receive a referral fee from ${who} if you instruct them. You are free to instruct any conveyancer or solicitor.`;
    case "MOVE_PARTNER":
      return `Property Concierge referred you to ${who}. We may receive a commission from ${who} if you book with them. You are free to use any removals or relocation provider.`;
    default:
      throw new Error("Disclosure text applies to partner roles only");
  }
}
