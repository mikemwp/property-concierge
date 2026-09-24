import type { EntryContext } from "../types";
import { applyCorridorEvidence } from "./corridor";
import { ewLegalSpine } from "./ew-stages";
import { US_UK_FLAGS } from "./us-uk-config";
import type { StageTemplate } from "./types";

export function usUkStageTemplates(entry: EntryContext): StageTemplate[] {
  return applyCorridorEvidence(ewLegalSpine(entry, US_UK_FLAGS), entry, US_UK_FLAGS);
}
