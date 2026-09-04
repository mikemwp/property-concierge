import { ENTRY_CONTEXTS, type ActorRole, type EntryContext } from "../types";

export type StageTemplate = {
  key: string;
  title: string;
  defaultOwnerRole: ActorRole;
  slaDays: number;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
};

/** Thrown for any unresolvable or not-yet-enabled market pack. Lives here so packs can throw it. */
export class MarketPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketPackError";
  }
}

/** Money, dates and geography naming. Spec §8: "currency, address, legal steps as config/data". */
export type MarketLocale = {
  /** BCP-47 tag; every date and number rendered for this market uses it. */
  bcp47: string;
  /** ISO 4217 code, e.g. "GBP". */
  currencyCode: string;
  /** Ordered address input keys this market expects. */
  addressFieldKeys: string[];
  /** What this market calls the geography a buyer picks, e.g. "region", "state". */
  regionNoun: string;
};

/** Modules a pack may switch on. Spec §8: "feature-flag future segments and modules". */
export type MarketModuleKey =
  | "fx_deposit"
  | "corridor_inbound"
  | "corridor_outbound"
  | "chain_free_inventory"
  | "hard_client_sla"
  | "document_vault"
  | "partner_speed_rails";

export const MARKET_MODULE_KEYS: readonly MarketModuleKey[] = [
  "fx_deposit",
  "corridor_inbound",
  "corridor_outbound",
  "chain_free_inventory",
  "hard_client_sla",
  "document_vault",
  "partner_speed_rails",
];

/** Partial on purpose: a module is off unless a pack explicitly turns it on. */
export type MarketFlags = Partial<Record<MarketModuleKey, boolean>>;

export type MarketCopyKey =
  | "jurisdiction_scope"
  | "mortgage_posture"
  | "region_prompt"
  | "directory_intro";

export const MARKET_COPY_KEYS: readonly MarketCopyKey[] = [
  "jurisdiction_scope",
  "mortgage_posture",
  "region_prompt",
  "directory_intro",
];

export type MarketCopy = Record<MarketCopyKey, string>;

export type PartnerRoleLabels = Record<ActorRole, string>;

export type MarketPack = {
  id: string;
  name: string;
  /** Free-form legal jurisdiction slug. Never narrowed to one country. */
  jurisdiction: string;
  /** Only an enabled pack may back a live case. */
  enabled: boolean;
  locale: MarketLocale;
  flags: MarketFlags;
  copy: MarketCopy;
  partnerRoleLabels: PartnerRoleLabels;
  buildStages: (entry: EntryContext) => StageTemplate[];
};

export function getStageTemplate(
  pack: MarketPack,
  entry: EntryContext,
): StageTemplate[] {
  return pack.buildStages(entry);
}

export function stageTemplateFor(
  pack: MarketPack,
  entry: EntryContext,
  stageKey: string,
): StageTemplate | null {
  return getStageTemplate(pack, entry).find((t) => t.key === stageKey) ?? null;
}

/** Every evidence kind the pack can require, across all entry contexts. */
export function packEvidenceKinds(pack: MarketPack): string[] {
  const kinds = new Set<string>();
  for (const entry of ENTRY_CONTEXTS) {
    for (const template of getStageTemplate(pack, entry)) {
      for (const kind of template.requiredEvidenceKinds) {
        kinds.add(kind);
      }
    }
  }
  return [...kinds].sort();
}

export function isModuleEnabled(flags: MarketFlags, key: MarketModuleKey): boolean {
  return flags[key] === true;
}

export function partnerRoleLabel(pack: MarketPack, role: ActorRole): string {
  return pack.partnerRoleLabels[role];
}
