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
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are
 * adapter plumbing. Spec §13 sub-project 6: chain_free_inventory is on as
 * buyer-side certification/matching data — not seller listings. Spec §8:
 * document_vault is on for ew only. Spec §5/§9: hard_client_sla is on for ew
 * only as published target timelines with legal carve-outs — not a marketing
 * guarantee. Spec §8: case_threads is on for ew only as the append-only
 * multi-party case thread. Spec §9 Phase 4: seller_milestone_views is on for
 * ew only as a read-only buyer-ledger projection — not a seller login or
 * inventory product.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
  chain_free_inventory: true,
  document_vault: true,
  hard_client_sla: true,
  case_threads: true,
  seller_milestone_views: true,
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
