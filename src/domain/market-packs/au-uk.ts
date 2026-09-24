import {
  AU_UK_COPY,
  AU_UK_FLAGS,
  AU_UK_LOCALE,
  AU_UK_PARTNER_ROLE_LABELS,
} from "./au-uk-config";
import { auUkPlaybooks } from "./au-uk-playbook";
import { auUkStageTemplates } from "./au-uk-stages";
import { ewDisclosureText } from "./ew-disclosure";
import { ewPartnerMilestones } from "./ew-milestones";
import type { MarketPack } from "./types";

export const auUkMarketPack: MarketPack = {
  id: "au_uk",
  name: "Australia → England & Wales",
  jurisdiction: "england_wales",
  enabled: true,
  locale: AU_UK_LOCALE,
  flags: AU_UK_FLAGS,
  copy: AU_UK_COPY,
  partnerRoleLabels: AU_UK_PARTNER_ROLE_LABELS,
  buildStages: auUkStageTemplates,
  buildPlaybooks: auUkPlaybooks,
  partnerMilestones: ewPartnerMilestones,
  disclosureText: ewDisclosureText,
};
