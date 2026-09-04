import type { CaseState } from "./stage-engine";
import type { ActorRole } from "./types";

export type PanelMember = {
  id: string;
  roleType: ActorRole;
  name: string;
  firm: string | null;
  active: boolean;
  slaDays: number;
  userId: string | null;
};

/** What a Free DIY client may see: names and categories only. No SLA, no ids, no scores. */
export type DirectoryEntry = {
  roleType: ActorRole;
  name: string;
  firm: string | null;
};

export function directoryEntries(members: PanelMember[]): DirectoryEntry[] {
  return members
    .filter((member) => member.active)
    .sort((left, right) =>
      left.roleType !== right.roleType
        ? left.roleType.localeCompare(right.roleType)
        : left.name.localeCompare(right.name),
    )
    .map((member) => ({
      roleType: member.roleType,
      name: member.name,
      firm: member.firm,
    }));
}

/** Spec §5: free gets a partner directory, not a warm intro. Paid gets named intros instead. */
export function canViewDirectory(caseState: CaseState): boolean {
  return caseState.tier === "FREE_DIY";
}
