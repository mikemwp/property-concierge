import bcrypt from "bcryptjs";
import type { LeadAttribution } from "../domain/attribution";
import type { ParsedIntake } from "../domain/intake";
import type { Tier } from "../domain/types";
import { prisma } from "../lib/db";
import { createCaseRecord } from "./cases";

export type SignupErrorCode = "EMAIL_TAKEN" | "NO_ADVISOR";

export class SignupError extends Error {
  constructor(
    public code: SignupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SignupError";
  }
}

export async function createSelfServeCase(input: {
  intake: ParsedIntake;
  attribution: LeadAttribution;
}): Promise<{ userId: string; caseId: string; tier: Tier }> {
  const email = input.intake.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new SignupError(
      "EMAIL_TAKEN",
      "An account already exists for that email — sign in instead.",
    );
  }

  const advisor = await prisma.user.findFirst({
    where: { role: "ADVISOR" },
    orderBy: { createdAt: "asc" },
  });
  if (!advisor) {
    throw new SignupError(
      "NO_ADVISOR",
      "No advisor is available to take this case yet. Try again shortly.",
    );
  }

  const passwordHash = await bcrypt.hash(input.intake.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.intake.name,
      role: "CLIENT",
      passwordHash,
    },
  });

  const caseState = await createCaseRecord({
    title: input.intake.caseTitle,
    entryContext: input.intake.entryContext,
    tier: input.intake.tier,
    clientUserId: user.id,
    advisorUserId: advisor.id,
    attribution: input.attribution,
  });

  return { userId: user.id, caseId: caseState.id, tier: input.intake.tier };
}
