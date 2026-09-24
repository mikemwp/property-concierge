import { notFound } from "next/navigation";
import { SellerMilestoneShareCard } from "@/components/SellerMilestoneShareCard";
import {
  buildSellerMilestoneSummary,
  sellerFacingCopy,
} from "@/domain/seller-milestones";
import { loadCase } from "@/server/cases";
import {
  canUseSellerMilestones,
  verifySellerShare,
} from "@/server/seller-milestones";

type Props = {
  params: Promise<{ caseId: string; signature: string }>;
};

export default async function SellerMilestoneSharePage({ params }: Props) {
  const { caseId, signature } = await params;
  if (!verifySellerShare(caseId, signature)) {
    notFound();
  }

  let caseState;
  try {
    caseState = await loadCase(caseId);
  } catch {
    notFound();
  }

  if (!canUseSellerMilestones(caseState)) {
    notFound();
  }

  const summary = buildSellerMilestoneSummary({
    caseState,
    moduleEnabled: true,
  });
  const copy = sellerFacingCopy(summary);
  if (!copy || summary.shareStatus !== "LIVE") {
    notFound();
  }

  return <SellerMilestoneShareCard copy={copy} rows={summary.rows} />;
}
