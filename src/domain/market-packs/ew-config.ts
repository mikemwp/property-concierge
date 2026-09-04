import type {
  MarketCopy,
  MarketFlags,
  MarketLocale,
  PartnerRoleLabels,
} from "./types";

export const EW_LOCALE: MarketLocale = {
  bcp47: "en-GB",
  currencyCode: "GBP",
  addressFieldKeys: ["line1", "line2", "town", "county", "postcode"],
  regionNoun: "region",
};

/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 dependency rule: chain-free
 * inventory and hard SLAs stay off until the ledger proves speed. Corridors are Plan 7.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
};

export const EW_COPY: MarketCopy = {
  jurisdiction_scope:
    "We orchestrate purchases in England & Wales. Scotland and Northern Ireland are not covered in v1.",
  mortgage_posture:
    "We introduce you to a mortgage adviser. We are an introducer only and do not give mortgage advice.",
  region_prompt: "Where in England & Wales are you buying?",
  directory_intro:
    "Our curated England & Wales panel. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const EW_PARTNER_ROLE_LABELS: PartnerRoleLabels = {
  CLIENT: "household",
  ADVISOR: "advisor",
  MORTGAGE_PARTNER: "mortgage adviser",
  CONVEYANCER: "conveyancer",
  MOVE_PARTNER: "removals partner",
};
