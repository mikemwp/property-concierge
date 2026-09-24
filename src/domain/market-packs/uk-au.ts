import { auDisclosureText } from "./au-disclosure";
import { auPartnerMilestones } from "./au-milestones";
import type { MarketPack } from "./types";
import {
  UK_AU_COPY,
  UK_AU_FLAGS,
  UK_AU_LOCALE,
  UK_AU_PARTNER_ROLE_LABELS,
} from "./uk-au-config";
import { ukAuPlaybooks } from "./uk-au-playbook";
import { ukAuStageTemplates } from "./uk-au-stages";

export const ukAuMarketPack: MarketPack = {
  id: "uk_au",
  name: "United Kingdom → Australia",
  jurisdiction: "australia",
  enabled: true,
  locale: UK_AU_LOCALE,
  flags: UK_AU_FLAGS,
  copy: UK_AU_COPY,
  partnerRoleLabels: UK_AU_PARTNER_ROLE_LABELS,
  buildStages: ukAuStageTemplates,
  buildPlaybooks: ukAuPlaybooks,
  partnerMilestones: auPartnerMilestones,
  disclosureText: auDisclosureText,
};
