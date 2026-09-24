import type { MarketCopy, MarketFlags } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";
import { EW_COPY, EW_LOCALE, EW_PARTNER_ROLE_LABELS } from "./ew-config";

export { EW_LOCALE as AU_UK_LOCALE, EW_PARTNER_ROLE_LABELS as AU_UK_PARTNER_ROLE_LABELS };

/** Plan 13: reuse the paid document vault. Not a domestic AU/US product. */
export const AU_UK_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
  document_vault: true,
};

export const AU_UK_COPY: MarketCopy = {
  ...EW_COPY,
  jurisdiction_scope:
    "We orchestrate Australia → England & Wales purchases. Scotland and Northern Ireland are not covered. This is not a domestic Australia product.",
  region_prompt: "Where in England & Wales are you buying on the way home from Australia?",
  directory_intro:
    "Our curated England & Wales panel for households buying from Australia. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const AU_UK_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "Australia",
  destinationName: "England & Wales",
  currencyPair: "AUD to GBP",
  visaLabel: "UK visa, settled status, or other right-to-reside",
};
