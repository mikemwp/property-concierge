import {
  EW_COPY,
  EW_FLAGS,
  EW_LOCALE,
  EW_PARTNER_ROLE_LABELS,
} from "./ew-config";
import { ewPlaybooks } from "./ew-playbook";
import { ewStageTemplates } from "./ew-stages";
import type { MarketPack } from "./types";

/** Kept for callers that still import the helper from here; removed in Task 4. */
export { getStageTemplate } from "./types";

export const ewMarketPack: MarketPack = {
  id: "ew",
  name: "England & Wales",
  jurisdiction: "england_wales",
  enabled: true,
  locale: EW_LOCALE,
  flags: EW_FLAGS,
  copy: EW_COPY,
  partnerRoleLabels: EW_PARTNER_ROLE_LABELS,
  buildStages: ewStageTemplates,
  buildPlaybooks: ewPlaybooks,
};
