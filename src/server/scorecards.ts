import type { PanelMember } from "../domain/panel";
import {
  buildScorecard,
  type PanelScorecardRow,
  type ScorecardAttribution,
} from "../domain/scorecard";
import type { CaseState } from "../domain/stage-engine";
import { prisma } from "../lib/db";
import { loadCase } from "./cases";
import { listPanel } from "./panel";

async function attributionsByPartner(): Promise<Map<string, ScorecardAttribution[]>> {
  const referrals = await prisma.referral.findMany({
    select: { partnerId: true, caseId: true, createdAt: true, supersededAt: true },
    orderBy: { createdAt: "asc" },
  });

  const caseCache = new Map<string, CaseState>();
  const byPartner = new Map<string, ScorecardAttribution[]>();

  for (const referral of referrals) {
    let caseState = caseCache.get(referral.caseId);
    if (!caseState) {
      caseState = await loadCase(referral.caseId);
      caseCache.set(referral.caseId, caseState);
    }
    const list = byPartner.get(referral.partnerId) ?? [];
    list.push({
      caseState,
      referralCreatedAt: referral.createdAt.toISOString(),
      supersededAt: referral.supersededAt ? referral.supersededAt.toISOString() : null,
    });
    byPartner.set(referral.partnerId, list);
  }

  return byPartner;
}

export async function loadPanelScorecards(
  now: Date = new Date(),
): Promise<PanelScorecardRow[]> {
  const [members, attributions] = await Promise.all([
    listPanel(),
    attributionsByPartner(),
  ]);

  return members.map((member: PanelMember) => ({
    member,
    scorecard: buildScorecard(member, attributions.get(member.id) ?? [], now),
  }));
}
