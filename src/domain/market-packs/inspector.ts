import type { ActorRole, EntryContext } from "../types";
import {
  getStageTemplate,
  MARKET_COPY_KEYS,
  packEvidenceKinds,
  packModules,
  type MarketCopyKey,
  type MarketLocale,
  type MarketModuleRow,
  type MarketPack,
} from "./types";

export type MarketPackStageRow = {
  key: string;
  title: string;
  ownerRole: ActorRole;
  slaDays: number;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
};

/**
 * Read-only configuration view for the advisor cockpit. Deliberately carries no
 * playbook prose: playbook IP renders only through PlaybookPanel.
 */
export type MarketPackSummary = {
  id: string;
  name: string;
  jurisdiction: string;
  enabled: boolean;
  locale: MarketLocale;
  modules: MarketModuleRow[];
  copy: Array<{ key: MarketCopyKey; text: string }>;
  partnerRoleLabels: Array<{ role: ActorRole; label: string }>;
  entryContext: EntryContext;
  stages: MarketPackStageRow[];
  evidenceKinds: string[];
  playbookStageKeys: string[];
};

export function marketPackSummary(
  pack: MarketPack,
  entry: EntryContext,
): MarketPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    jurisdiction: pack.jurisdiction,
    enabled: pack.enabled,
    locale: pack.locale,
    modules: packModules(pack),
    copy: MARKET_COPY_KEYS.map((key) => ({ key, text: pack.copy[key] })),
    partnerRoleLabels: Object.entries(pack.partnerRoleLabels).map(([role, label]) => ({
      role: role as ActorRole,
      label,
    })),
    entryContext: entry,
    stages: getStageTemplate(pack, entry).map((template) => ({
      key: template.key,
      title: template.title,
      ownerRole: template.defaultOwnerRole,
      slaDays: template.slaDays,
      requiredEvidenceKinds: [...template.requiredEvidenceKinds],
      freeVisible: template.freeVisible,
      freeCanSelfAdvance: template.freeCanSelfAdvance,
    })),
    evidenceKinds: packEvidenceKinds(pack),
    playbookStageKeys: pack.buildPlaybooks(entry).map((p) => p.stageKey),
  };
}
