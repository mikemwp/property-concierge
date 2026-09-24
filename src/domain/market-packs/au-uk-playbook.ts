import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { AU_UK_CORRIDOR_COPY, AU_UK_FLAGS } from "./au-uk-config";
import { ewLegalPlaybooks } from "./ew-playbook";
import type { StagePlaybook } from "./types";

export function auUkPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ewLegalPlaybooks(entry, AU_UK_FLAGS),
    entry,
    AU_UK_FLAGS,
    AU_UK_CORRIDOR_COPY,
  );
}

export function auUkStagePlaybook(
  stageKey: string,
  entry: EntryContext,
): StagePlaybook | null {
  return auUkPlaybooks(entry).find((playbook) => playbook.stageKey === stageKey) ?? null;
}
