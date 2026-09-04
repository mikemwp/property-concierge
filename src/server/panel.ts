import type { PartnerPanel } from "@prisma/client";
import type { PanelMember } from "../domain/panel";
import type { ActorRole } from "../domain/types";
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
  };
}

export async function listPanel(
  options: { activeOnly?: boolean } = {},
): Promise<PanelMember[]> {
  const rows = await prisma.partnerPanel.findMany({
    where: options.activeOnly ? { active: true } : undefined,
    orderBy: [{ roleType: "asc" }, { name: "asc" }],
  });
  return rows.map(toPanelMember);
}

export async function getPanelMember(id: string): Promise<PanelMember | null> {
  const row = await prisma.partnerPanel.findUnique({ where: { id } });
  return row ? toPanelMember(row) : null;
}

/** Active member for a role; members with a portal login come first so intros land in the mini-view. */
export async function findActivePanelMemberForRole(
  role: ActorRole,
): Promise<PanelMember | null> {
  const rows = await prisma.partnerPanel.findMany({
    where: { roleType: role, active: true },
    orderBy: { name: "asc" },
  });
  const members = rows.map(toPanelMember);
  return members.find((m) => m.userId !== null) ?? members[0] ?? null;
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
