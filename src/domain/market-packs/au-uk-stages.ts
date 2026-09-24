import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { AU_UK_FLAGS } from "./au-uk-config";
import { ewLegalSpine } from "./ew-stages";
import type { StageTemplate } from "./types";

export function auUkStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(ewLegalSpine(entry, AU_UK_FLAGS), entry, AU_UK_FLAGS);
}
