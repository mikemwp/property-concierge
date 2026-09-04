import type { RawAttributionParams } from "@/domain/attribution";
import type { EntryContext } from "@/domain/types";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "ref",
] as const;

export function startHref(input: {
  plan: "free" | "paid";
  entryContext?: EntryContext;
  params?: RawAttributionParams;
}): string {
  const query = new URLSearchParams();
  query.set("plan", input.plan);
  if (input.entryContext) {
    query.set("entry", input.entryContext);
  }

  const params = input.params ?? {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim() !== "") {
      query.set(key, value.trim());
    }
  }

  return `/start?${query.toString()}`;
}

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
}

export function attributionParamsFrom(
  searchParams: Record<string, string | string[] | undefined>,
): RawAttributionParams {
  return {
    utm_source: first(searchParams.utm_source),
    utm_medium: first(searchParams.utm_medium),
    utm_campaign: first(searchParams.utm_campaign),
    ref: first(searchParams.ref),
  };
}
