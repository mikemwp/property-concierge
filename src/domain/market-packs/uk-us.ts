import type { MarketPack } from "./types";
import { usDisclosureText } from "./us-disclosure";
import { usPartnerMilestones } from "./us-milestones";
import {
  UK_US_COPY,
  UK_US_FLAGS,
  UK_US_LOCALE,
  UK_US_PARTNER_ROLE_LABELS,
} from "./uk-us-config";
import { ukUsPlaybooks } from "./uk-us-playbook";
import { ukUsStageTemplates } from "./uk-us-stages";

export const ukUsMarketPack: MarketPack = {
  id: "uk_us",
  name: "United Kingdom → United States",
  jurisdiction: "united_states",
  enabled: true,
  locale: UK_US_LOCALE,
  flags: UK_US_FLAGS,
  copy: UK_US_COPY,
  partnerRoleLabels: UK_US_PARTNER_ROLE_LABELS,
  buildStages: ukUsStageTemplates,
  buildPlaybooks: ukUsPlaybooks,
  partnerMilestones: usPartnerMilestones,
  disclosureText: usDisclosureText,
};
