import {
  acceptEvidence,
  advanceStage,
  createCase,
  submitEvidence,
  type CaseState,
} from "../../src/domain/stage-engine";
import type { CaseStore } from "../../src/lib/case-store";

/** DB-free CaseStore so port and adapter behaviour is unit-testable. */
export function makeMemoryCaseStore(initial: CaseState): CaseStore & { current(): CaseState } {
  let state = initial;
  return {
    async load() {
      return state;
    },
    async save(next: CaseState) {
      state = next;
    },
    current() {
      return state;
    },
  };
}

/** A paid case walked to mortgage_path, the first stage a partner role owns. */
export function atMortgagePath(): CaseState {
  let c = createCase({ id: "pp1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
  c = submitEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "purchase_profile", kind: "profile_complete", actorRole: "ADVISOR" });
  c = advanceStage(c, { actorRole: "ADVISOR" });
  c = submitEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "CLIENT" });
  c = acceptEvidence(c, { stageKey: "money_readiness", kind: "source_of_funds", actorRole: "ADVISOR" });
  return advanceStage(c, { actorRole: "ADVISOR" });
}
