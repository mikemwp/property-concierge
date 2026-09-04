"use server";

import { parseAttribution } from "@/domain/attribution";
import { parseIntake } from "@/domain/intake";
import { createSelfServeCase, SignupError } from "@/server/signup";

export type SignupActionResult =
  | { ok: true; caseId: string; email: string }
  | { ok: false; errors: Record<string, string> };

function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

export async function signUpAction(
  formData: FormData,
): Promise<SignupActionResult> {
  const parsed = parseIntake({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    entryContext: field(formData, "entryContext"),
    plan: field(formData, "plan"),
    targetRegion: field(formData, "targetRegion"),
  });

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const attribution = parseAttribution({
    utm_source: field(formData, "utm_source"),
    utm_medium: field(formData, "utm_medium"),
    utm_campaign: field(formData, "utm_campaign"),
    ref: field(formData, "ref"),
  });

  try {
    const created = await createSelfServeCase({
      intake: parsed.value,
      attribution,
    });
    return { ok: true, caseId: created.caseId, email: parsed.value.email };
  } catch (err) {
    if (err instanceof SignupError) {
      return { ok: false, errors: { form: err.message } };
    }
    return {
      ok: false,
      errors: { form: "Could not create your case. Please try again." },
    };
  }
}
