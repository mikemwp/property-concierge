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
