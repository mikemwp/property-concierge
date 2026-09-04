const STAGE_PLAYBOOK: Record<string, string> = {
  purchase_profile: "Confirm profile completeness and budget band before money stage.",
  money_readiness: "Verify source-of-funds docs within 5 business days.",
  mortgage_path: "Playbook: chase lender pack within 48h",
  move_logistics: "Confirm move quote and vehicle path before search readiness.",
  search_readiness: "Ensure buyer-ready checklist signed off with client.",
  offer_instruct: "Chase conveyancer instruction within 24h of offer acceptance.",
  legal_exchange: "Monitor searches and enquiries; escalate blockers daily.",
  completion: "Confirm funds and keys handover with all parties.",
  post_move: "Close loop on utilities and address updates within 7 days.",
};

export function advisorPlaybookText(stageKey: string): string {
  return STAGE_PLAYBOOK[stageKey] ?? "No playbook notes for this stage yet.";
}
