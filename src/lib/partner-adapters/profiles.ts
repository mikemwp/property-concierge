import type { PartnerStatus } from "@/domain/partner-integration";
import type { ActorRole } from "@/domain/types";

/**
 * A stub vendor's shape: how fast it acknowledges, how fast it works, and the status
 * ladder it walks. Everything here is a simulation parameter, not a service contract.
 */
export type AdapterProfile = {
  adapterId: string;
  role: ActorRole;
  /** Simulated turnaround per rung of the ladder, in whole days. */
  cadenceDays: number;
  statusLadder: PartnerStatus[];
};

export const MORTGAGE_STUB_PROFILE: AdapterProfile = {
  adapterId: "stub-mortgage",
  role: "MORTGAGE_PARTNER",
  cadenceDays: 3,
  statusLadder: ["RECEIVED", "IN_PROGRESS", "BLOCKED_ON_CLIENT", "EVIDENCE_READY"],
};

export const CONVEYANCER_STUB_PROFILE: AdapterProfile = {
  adapterId: "stub-conveyancer",
  role: "CONVEYANCER",
  cadenceDays: 5,
  statusLadder: ["RECEIVED", "IN_PROGRESS", "IN_PROGRESS", "EVIDENCE_READY"],
};

/** Removals and FX quotes come back in hours, so this is the fastest rail. */
export const MOVE_STUB_PROFILE: AdapterProfile = {
  adapterId: "stub-move",
  role: "MOVE_PARTNER",
  cadenceDays: 2,
  statusLadder: ["RECEIVED", "IN_PROGRESS", "EVIDENCE_READY"],
};

const BY_ROLE: Partial<Record<ActorRole, AdapterProfile>> = {
  MORTGAGE_PARTNER: MORTGAGE_STUB_PROFILE,
  CONVEYANCER: CONVEYANCER_STUB_PROFILE,
  MOVE_PARTNER: MOVE_STUB_PROFILE,
};

export function profileForRole(role: ActorRole): AdapterProfile | null {
  return BY_ROLE[role] ?? null;
}
