import {
  EW_COPY,
  EW_FLAGS,
  EW_LOCALE,
  EW_PARTNER_ROLE_LABELS,
} from "./ew-config";
import { ewDisclosureText } from "./ew-disclosure";
import { ewPartnerMilestones } from "./ew-milestones";
import { ewPlaybooks } from "./ew-playbook";
import { ewStageTemplates } from "./ew-stages";
import type { MarketPack } from "./types";

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
  partnerMilestones: ewPartnerMilestones,
  disclosureText: ewDisclosureText,
};
