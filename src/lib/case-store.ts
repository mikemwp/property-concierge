import type { CaseState } from "@/domain/stage-engine";
import { loadCase, saveCase } from "@/server/cases";

/** Persistence seam. Adapters depend on this, never on Prisma, so they unit-test clean. */
export type CaseStore = {
  load(caseId: string): Promise<CaseState>;
  save(caseState: CaseState): Promise<void>;
};

export const prismaCaseStore: CaseStore = {
  load: loadCase,
  save: saveCase,
};
