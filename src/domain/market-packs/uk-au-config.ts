import type { MarketCopy, MarketFlags, MarketLocale, PartnerRoleLabels } from "./types";
import type { CorridorPlaybookCopy } from "./corridor";

export const UK_AU_LOCALE: MarketLocale = {
  bcp47: "en-AU",
  currencyCode: "AUD",
  addressFieldKeys: ["line1", "line2", "suburb", "state", "postcode"],
  regionNoun: "state",
};

export const UK_AU_FLAGS: MarketFlags = {
  fx_deposit: true,
  corridor_inbound: true,
  corridor_outbound: true,
};

export const UK_AU_COPY: MarketCopy = {
  jurisdiction_scope:
    "We orchestrate United Kingdom → Australia purchases. State land-title rules are local. This is not a domestic Australia-only product and it does not enable the disabled au stub.",
  mortgage_posture:
    "We introduce you to a mortgage broker. We are an introducer only and do not give credit assistance or mortgage advice.",
  region_prompt: "Which Australian state are you buying in?",
  directory_intro:
    "Our curated Australia panel for households buying from the United Kingdom. On Done-With-You your advisor makes the introduction, stays in the thread, and chases on your behalf.",
};

export const UK_AU_PARTNER_ROLE_LABELS: PartnerRoleLabels = {
  CLIENT: "household",
  ADVISOR: "advisor",
  MORTGAGE_PARTNER: "mortgage broker",
  CONVEYANCER: "conveyancer",
  MOVE_PARTNER: "removalist",
};

export const UK_AU_CORRIDOR_COPY: CorridorPlaybookCopy = {
  originName: "the United Kingdom",
  destinationName: "Australia",
  currencyPair: "GBP to AUD",
  visaLabel: "Australian visa or right-to-reside",
};
