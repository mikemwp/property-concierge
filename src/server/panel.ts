import type { PartnerPanel } from "@prisma/client";
import type { PanelMember } from "../domain/panel";
import type { ActorRole } from "../domain/types";
import { DEFAULT_MARKET_PACK_ID } from "../domain/market-packs/registry";
import { prisma } from "../lib/db";

export class PartnerNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerNetworkError";
  }
}

export function toPanelMember(row: PartnerPanel): PanelMember {
  return {
    id: row.id,
    roleType: row.roleType as ActorRole,
    name: row.name,
    firm: row.firm,
    active: row.active,
    slaDays: row.slaDays,
    userId: row.userId,
    marketPackId: row.marketPackId,
  };
}

export async function listPanel(
  options: { activeOnly?: boolean; marketPackId?: string } = {},
): Promise<PanelMember[]> {
  const rows = await prisma.partnerPanel.findMany({
    where: {
      ...(options.activeOnly ? { active: true } : {}),
      ...(options.marketPackId ? { marketPackId: options.marketPackId } : {}),
    },
    orderBy: [{ roleType: "asc" }, { name: "asc" }],
  });
  return rows.map(toPanelMember);
}

export async function getPanelMember(id: string): Promise<PanelMember | null> {
  const row = await prisma.partnerPanel.findUnique({ where: { id } });
  return row ? toPanelMember(row) : null;
}

/** Active member for a role in one market; members with a portal login come first. */
export async function findActivePanelMemberForRole(
  role: ActorRole,
  marketPackId: string = DEFAULT_MARKET_PACK_ID,
): Promise<PanelMember | null> {
  const rows = await prisma.partnerPanel.findMany({
    where: { roleType: role, active: true, marketPackId },
    orderBy: { name: "asc" },
  });
  const members = rows.map(toPanelMember);
  return members.find((m) => m.userId !== null) ?? members[0] ?? null;
}

/** Spec §10: panels are local. A case may only be introduced to its own market's panel. */
export function assertPanelMemberInMarket(
  member: PanelMember,
  marketPackId: string,
): void {
  if (member.marketPackId !== marketPackId) {
    throw new PartnerNetworkError(
      `${member.name} is not on the ${marketPackId} panel`,
    );
  }
}

export async function setPanelMemberActive(
  id: string,
  active: boolean,
): Promise<PanelMember> {
  const existing = await prisma.partnerPanel.findUnique({ where: { id } });
  if (!existing) {
    throw new PartnerNetworkError("Unknown panel member");
  }
  const row = await prisma.partnerPanel.update({ where: { id }, data: { active } });
  return toPanelMember(row);
}
