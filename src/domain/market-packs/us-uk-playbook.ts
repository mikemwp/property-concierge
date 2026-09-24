import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { ewLegalPlaybooks } from "./ew-playbook";
import type { StagePlaybook } from "./types";
import { US_UK_CORRIDOR_COPY, US_UK_FLAGS } from "./us-uk-config";

export function usUkPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ewLegalPlaybooks(entry, US_UK_FLAGS),
    entry,
    US_UK_FLAGS,
    US_UK_CORRIDOR_COPY,
  );
}
