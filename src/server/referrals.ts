import type { PartnerPanel, Referral } from "@prisma/client";
import {
  canTransitionFee,
  defaultFeeStatus,
  type FeeStatus,
  type ReferralRecord,
  type ReferralSource,
} from "../domain/referral";
import { resolveMarketPack } from "../domain/market-packs/registry";
import type { ActorRole } from "../domain/types";
import { prisma } from "../lib/db";
import { getPanelMember, PartnerNetworkError } from "./panel";

type ReferralRow = Referral & { partner: PartnerPanel };

function toReferralRecord(row: ReferralRow): ReferralRecord {
  return {
    id: row.id,
    caseId: row.caseId,
    partnerId: row.partnerId,
    partnerName: row.partner.name,
    partnerFirm: row.partner.firm,
    partnerRole: row.partnerRole as ActorRole,
    source: row.source as ReferralSource,
    feeStatus: row.feeStatus as FeeStatus,
    disclosureText: row.disclosureText,
    disclosedAt: row.disclosedAt.toISOString(),
    supersededAt: row.supersededAt ? row.supersededAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createReferral(input: {
  caseId: string;
  partnerId: string;
  source: ReferralSource;
  feeStatus?: FeeStatus;
  now?: Date;
}): Promise<ReferralRecord> {
  const caseRow = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: { marketPackId: true },
  });
  if (!caseRow) {
    throw new PartnerNetworkError("Unknown case");
  }
  const pack = resolveMarketPack(caseRow.marketPackId);

  const member = await getPanelMember(input.partnerId);
  if (!member) {
    throw new PartnerNetworkError("Unknown panel member");
  }
  if (!member.active) {
    throw new PartnerNetworkError("Panel member is not active");
  }

  const at = input.now ?? new Date();
  const row = await prisma.referral.create({
    data: {
      caseId: input.caseId,
      partnerId: member.id,
      partnerRole: member.roleType,
      source: input.source,
      feeStatus: input.feeStatus ?? defaultFeeStatus(member.roleType),
      disclosureText: pack.disclosureText({
        role: member.roleType,
        partnerName: member.name,
        partnerFirm: member.firm,
      }),
      disclosedAt: at,
      createdAt: at,
    },
    include: { partner: true },
  });
  return toReferralRecord(row);
}

export async function listReferralsForCase(caseId: string): Promise<ReferralRecord[]> {
  const rows = await prisma.referral.findMany({
    where: { caseId },
    include: { partner: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toReferralRecord);
}

export async function activeReferralForRole(
  caseId: string,
  role: ActorRole,
): Promise<ReferralRecord | null> {
  const row = await prisma.referral.findFirst({
    where: { caseId, partnerRole: role, supersededAt: null },
    include: { partner: true },
    orderBy: { createdAt: "desc" },
  });
  return row ? toReferralRecord(row) : null;
}

/** Marks every live referral for the role as superseded; returns the one that was current. */
export async function supersedeActiveReferrals(
  caseId: string,
  role: ActorRole,
  now: Date = new Date(),
): Promise<ReferralRecord | null> {
  const current = await activeReferralForRole(caseId, role);
  if (!current) {
    return null;
  }
  await prisma.referral.updateMany({
    where: { caseId, partnerRole: role, supersededAt: null },
    data: { supersededAt: now },
  });
  return current;
}

export async function setReferralFeeStatus(
  referralId: string,
  next: FeeStatus,
  caseId?: string,
): Promise<ReferralRecord> {
  const existing = await prisma.referral.findUnique({
    where: { id: referralId },
    include: { partner: true },
  });
  if (!existing) {
    throw new PartnerNetworkError("Unknown referral");
  }
  if (caseId !== undefined && existing.caseId !== caseId) {
    throw new PartnerNetworkError("Referral does not belong to this case");
  }
  const from = existing.feeStatus as FeeStatus;
  if (!canTransitionFee(from, next)) {
    throw new PartnerNetworkError(`Cannot move fee status from ${from} to ${next}`);
  }
  const row = await prisma.referral.update({
    where: { id: referralId },
    data: { feeStatus: next },
    include: { partner: true },
  });
  return toReferralRecord(row);
}
