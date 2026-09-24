import type { MarketCopy, MarketFlags, MarketLocale, PartnerRoleLabels } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";

export const UK_US_LOCALE: MarketLocale = {
  bcp47: "en-US",
  currencyCode: "USD",
  addressFieldKeys: ["line1", "line2", "city", "state", "zip"],
  regionNoun: "state",
};

/** Plan 13: reuse the paid document vault. Not a domestic AU/US product. */
export const UK_US_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
  document_vault: true,
};

export const UK_US_COPY: MarketCopy = {
  jurisdiction_scope:
    "We orchestrate United Kingdom → United States purchases. State closing, title and escrow rules are local. This is not a domestic United States-only product.",
  mortgage_posture:
    "We introduce you to a mortgage broker. We are an introducer only and do not give mortgage advice.",
  region_prompt: "Which US state are you buying in?",
  directory_intro:
    "Our curated United States panel for households buying from the United Kingdom. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const UK_US_PARTNER_ROLE_LABELS: PartnerRoleLabels = {
  CLIENT: "household",
  ADVISOR: "advisor",
  MORTGAGE_PARTNER: "mortgage broker",
  CONVEYANCER: "closing attorney",
  MOVE_PARTNER: "movers",
};

export const UK_US_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "the United Kingdom",
  destinationName: "the United States",
  currencyPair: "GBP to USD",
  visaLabel: "US visa, green card, or other right-to-reside",
};
