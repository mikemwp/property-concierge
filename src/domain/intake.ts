import { ENTRY_CONTEXTS, type EntryContext, type Tier } from "./types";
import { DEFAULT_MARKET_PACK_ID, resolveMarketPack } from "./market-packs/registry";

export type IntakeFields = {
  name?: string | null;
  email?: string | null;
  password?: string | null;
  entryContext?: string | null;
  plan?: string | null;
  targetRegion?: string | null;
};

export type ParsedIntake = {
  name: string;
  email: string;
  password: string;
  entryContext: EntryContext;
  tier: Tier;
  targetRegion: string;
  caseTitle: string;
};

export type IntakeResult =
  | { ok: true; value: ParsedIntake }
  | { ok: false; errors: Record<string, string> };

export const MIN_PASSWORD_LENGTH = 10;
const MAX_TEXT_LENGTH = 80;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Intake happens before a case exists, so it uses the default market's copy. */
const DEFAULT_PACK = resolveMarketPack(DEFAULT_MARKET_PACK_ID);

export function caseTitleFor(name: string, targetRegion: string): string {
  return `${name.trim()} — ${targetRegion.trim()}`;
}

function isEntryContext(value: string): value is EntryContext {
  return (ENTRY_CONTEXTS as string[]).includes(value);
}

/** Paid is the default product: only an explicit "free" choice downgrades the tier. */
function tierFromPlan(plan?: string | null): Tier {
  return typeof plan === "string" && plan.trim().toLowerCase() === "free"
    ? "FREE_DIY"
    : "PAID_DWY";
}

export function parseIntake(fields: IntakeFields): IntakeResult {
  const errors: Record<string, string> = {};

  const name = (fields.name ?? "").trim();
  if (name.length === 0) {
    errors.name = "Tell us what to call your household.";
  } else if (name.length > MAX_TEXT_LENGTH) {
    errors.name = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
  }

  const email = (fields.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const password = fields.password ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const targetRegion = (fields.targetRegion ?? "").trim();
  if (targetRegion.length === 0) {
    errors.targetRegion = DEFAULT_PACK.copy.region_prompt;
  } else if (targetRegion.length > MAX_TEXT_LENGTH) {
    errors.targetRegion = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
  }

  const entryValue = (fields.entryContext ?? "").trim();
  if (!isEntryContext(entryValue)) {
    errors.entryContext = "Choose where you are starting from.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      password,
      entryContext: entryValue as EntryContext,
      tier: tierFromPlan(fields.plan),
      targetRegion,
      caseTitle: caseTitleFor(name, targetRegion),
    },
  };
}
