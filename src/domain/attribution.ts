export type LeadSource =
  | "DIASPORA_AU_UK"
  | "DIASPORA_US_UK"
  | "COMMUNITY_REFERRAL"
  | "PARTNER_REFERRAL"
  | "ORGANIC"
  | "DIRECT";

export type LeadAttribution = {
  leadSource: LeadSource;
  leadCampaign: string | null;
  leadReferrer: string | null;
};

export type RawAttributionParams = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  ref?: string | null;
};

const LEAD_SOURCES: readonly LeadSource[] = [
  "DIASPORA_AU_UK",
  "DIASPORA_US_UK",
  "COMMUNITY_REFERRAL",
  "PARTNER_REFERRAL",
  "ORGANIC",
  "DIRECT",
];

export const DEFAULT_ATTRIBUTION: LeadAttribution = {
  leadSource: "DIRECT",
  leadCampaign: null,
  leadReferrer: null,
};

const MAX_TAG_LENGTH = 64;

/** Campaign tags we hand out to diaspora communities. Keep in sync with the outreach checklist. */
const SOURCE_MAP: Record<string, LeadSource> = {
  "au-uk": "DIASPORA_AU_UK",
  "poms-in-oz": "DIASPORA_AU_UK",
  "brits-in-australia": "DIASPORA_AU_UK",
  "us-uk": "DIASPORA_US_UK",
  "brits-in-america": "DIASPORA_US_UK",
  "brits-in-usa": "DIASPORA_US_UK",
  community: "COMMUNITY_REFERRAL",
  partner: "PARTNER_REFERRAL",
  google: "ORGANIC",
  organic: "ORGANIC",
  newsletter: "ORGANIC",
};

const COMMUNITY_MEDIUMS = new Set(["community", "group", "forum", "meetup"]);

export function sanitiseTag(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : null;
}

export function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

export function isDiasporaLead(source: LeadSource): boolean {
  return (
    source === "DIASPORA_AU_UK" ||
    source === "DIASPORA_US_UK" ||
    source === "COMMUNITY_REFERRAL"
  );
}

export function parseAttribution(params: RawAttributionParams): LeadAttribution {
  const source = sanitiseTag(params.utm_source);
  const medium = sanitiseTag(params.utm_medium);
  const leadCampaign = sanitiseTag(params.utm_campaign);
  const leadReferrer = sanitiseTag(params.ref);

  const mapped = source ? SOURCE_MAP[source] : undefined;

  let leadSource: LeadSource;
  if (mapped && mapped !== "ORGANIC") {
    leadSource = mapped;
  } else if (medium && COMMUNITY_MEDIUMS.has(medium)) {
    leadSource = "COMMUNITY_REFERRAL";
  } else if (leadReferrer) {
    leadSource = "PARTNER_REFERRAL";
  } else if (source) {
    leadSource = "ORGANIC";
  } else {
    leadSource = "DIRECT";
  }

  return { leadSource, leadCampaign, leadReferrer };
}
