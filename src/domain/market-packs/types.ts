import type { ActorRole, EntryContext } from "../types";

export type StageTemplate = {
  key: string;
  title: string;
  defaultOwnerRole: ActorRole;
  slaDays: number;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
};

export type MarketPack = {
  id: string;
  name: string;
  jurisdiction: "england_wales";
  buildStages: (entry: EntryContext) => StageTemplate[];
};

export function getStageTemplate(
  pack: MarketPack,
  entry: EntryContext,
): StageTemplate[] {
  return pack.buildStages(entry);
}
