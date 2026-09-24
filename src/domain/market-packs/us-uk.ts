import { ewDisclosureText } from "./ew-disclosure";
import { ewPartnerMilestones } from "./ew-milestones";
import type { MarketPack } from "./types";
import {
  US_UK_COPY,
  US_UK_FLAGS,
  US_UK_LOCALE,
  US_UK_PARTNER_ROLE_LABELS,
} from "./us-uk-config";
import { usUkPlaybooks } from "./us-uk-playbook";
import { usUkStageTemplates } from "./us-uk-stages";

export const usUkMarketPack: MarketPack = {
  id: "us_uk",
  name: "United States → England & Wales",
  jurisdiction: "england_wales",
  enabled: true,
  locale: US_UK_LOCALE,
  flags: US_UK_FLAGS,
  copy: US_UK_COPY,
  partnerRoleLabels: US_UK_PARTNER_ROLE_LABELS,
  buildStages: usUkStageTemplates,
  buildPlaybooks: usUkPlaybooks,
  partnerMilestones: ewPartnerMilestones,
  disclosureText: ewDisclosureText,
};
