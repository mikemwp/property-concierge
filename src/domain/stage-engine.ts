import type { ActorRole, EntryContext, StageStatus, Tier } from "./types";
import { ewMarketPack, getStageTemplate } from "./market-packs/ew";
import type { MarketPack } from "./market-packs/types";

export type StageState = {
  key: string;
  title: string;
  sortOrder: number;
  status: StageStatus;
  ownerRole: ActorRole;
  dueAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  requiredEvidenceKinds: string[];
  freeVisible: boolean;
  freeCanSelfAdvance: boolean;
  acceptedEvidenceKinds: string[];
};

export type CaseState = {
  id: string;
  marketPackId: string;
  entryContext: EntryContext;
  tier: Tier;
  stages: StageState[];
  events: Array<{
    type: string;
    stageKey: string;
    actorRole: ActorRole;
    at: string;
    payload?: string;
  }>;
};

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function resolveMarketPack(marketPackId: string): MarketPack {
  if (marketPackId === "ew") {
    return ewMarketPack;
  }
  throw new Error(`Unknown market pack: ${marketPackId}`);
}

export function createCase(input: {
  id: string;
  entryContext: EntryContext;
  tier: Tier;
  marketPackId?: string;
  now?: Date;
}): CaseState {
  const marketPackId = input.marketPackId ?? "ew";
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const pack = resolveMarketPack(marketPackId);
  const templates = getStageTemplate(pack, input.entryContext);

  const stages: StageState[] = templates.map((template, index) => {
    const isFirst = index === 0;
    return {
      key: template.key,
      title: template.title,
      sortOrder: index,
      status: isFirst ? "ACTIVE" : "PENDING",
      ownerRole: template.defaultOwnerRole,
      dueAt: isFirst ? addDays(nowIso, template.slaDays) : null,
      activatedAt: isFirst ? nowIso : null,
      completedAt: null,
      blockedReason: null,
      requiredEvidenceKinds: [...template.requiredEvidenceKinds],
      freeVisible: template.freeVisible,
      freeCanSelfAdvance: template.freeCanSelfAdvance,
      acceptedEvidenceKinds: [],
    };
  });

  return {
    id: input.id,
    marketPackId,
    entryContext: input.entryContext,
    tier: input.tier,
    stages,
    events: [
      {
        type: "CASE_CREATED",
        stageKey: stages[0].key,
        actorRole: stages[0].ownerRole,
        at: nowIso,
      },
    ],
  };
}

export function getCurrentStage(caseState: CaseState): StageState | null {
  return caseState.stages.find((s) => s.status === "ACTIVE") ?? null;
}
