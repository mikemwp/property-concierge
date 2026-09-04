export type EntryContext =
  | "RETURNER_OVERSEAS"
  | "RETURNER_IN_UK"
  | "UK_RESIDENT_SPEED";

export type Tier = "FREE_DIY" | "PAID_DWY";

export type ActorRole =
  | "CLIENT"
  | "ADVISOR"
  | "MORTGAGE_PARTNER"
  | "CONVEYANCER"
  | "MOVE_PARTNER";

export type StageStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "DONE" | "SKIPPED";

export const PARTNER_ROLES: readonly ActorRole[] = [
  "MORTGAGE_PARTNER",
  "CONVEYANCER",
  "MOVE_PARTNER",
];

export function isPartnerActorRole(role: ActorRole): boolean {
  return PARTNER_ROLES.includes(role);
}
