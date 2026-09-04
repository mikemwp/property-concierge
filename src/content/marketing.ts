import type { EntryContext, Tier } from "../domain/types";

export type PlanCopy = {
  tier: Tier;
  slug: "free" | "paid";
  name: string;
  tagline: string;
  primary: boolean;
  price: string;
  features: string[];
  limits: string[];
  ctaLabel: string;
};

export type EntryStory = {
  slug: string;
  entryContext: EntryContext;
  eyebrow: string;
  headline: string;
  subhead: string;
  proofPoints: string[];
  firstMoves: string[];
};

export const HERO = {
  headline: "Buy a home in England & Wales from 10,000 miles away.",
  subhead:
    "For UK and dual nationals coming home from Australia and the United States. One stage plan, one advisor who owns it, and a portal that always names who is holding things up.",
  primaryCta: "Start Done-With-You",
  secondaryCta: "See the free stage map",
};

export const PAID_PLAN: PlanCopy = {
  tier: "PAID_DWY",
  slug: "paid",
  name: "Done-With-You orchestration",
  tagline: "We run the purchase. You make the decisions.",
  primary: true,
  price: "Fixed fee, quoted on your first call",
  features: [
    "A named advisor who owns every stage from profile to completion",
    "Warm introductions to vetted mortgage, conveyancing and removals partners",
    "Your advisor stays in the thread with every partner, in your timezone",
    "We chase the blocker; you see the day counter and who owns it",
    "Evidence checked against our standard before a stage is marked done",
  ],
  limits: [],
  ctaLabel: "Start Done-With-You",
};

export const FREE_PLAN: PlanCopy = {
  tier: "FREE_DIY",
  slug: "free",
  name: "Free orientation",
  tagline: "See the map. Run it yourself.",
  primary: false,
  price: "£0",
  features: [
    "The full nine-stage purchase map for England & Wales",
    "A plain-English explainer of what each stage is for",
    "Tick off the starter stages yourself as you go",
    "A directory of the partner categories you will need to find",
  ],
  limits: [
    "No named owner or day counters once you reach a money or legal stage",
    "No introductions — you source, vet and brief every partner yourself",
    "Nobody chases when a stage stalls; the map waits for you",
  ],
  ctaLabel: "Take the free orientation",
};

export const PLAN_ORDER: PlanCopy[] = [PAID_PLAN, FREE_PLAN];

export const ENTRY_STORIES: EntryStory[] = [
  {
    slug: "returning-from-australia",
    entryContext: "RETURNER_OVERSEAS",
    eyebrow: "AU → UK",
    headline: "Coming back from Australia with a purchase to land.",
    subhead:
      "Deposit in AUD, a thin UK credit file, a container on the water and a lender who wants documents at 3am your time. That is the job we take off you.",
    proofPoints: [
      "Deposit timing planned around your transfer, not the other way round",
      "UK credit-file groundwork started months before you fly",
      "Container, vehicle and storage decisions sequenced against completion",
      "Your advisor holds the 3am conversations so you do not have to",
    ],
    firstMoves: [
      "Set your target region and realistic arrival window",
      "Start the money readiness pack while you are still earning offshore",
      "Get introduced to a mortgage partner who has done returner cases",
    ],
  },
  {
    slug: "returning-from-the-usa",
    entryContext: "RETURNER_OVERSEAS",
    eyebrow: "US → UK",
    headline: "Moving back from the States without losing a year to it.",
    subhead:
      "A US salary history that UK lenders read badly, a dollar deposit to move, and school dates that will not shift. One stage plan holds all three together.",
    proofPoints: [
      "Lender routes that understand US income and short UK address history",
      "Dollar deposit movement planned against exchange and completion dates",
      "School and term dates treated as fixed constraints in the plan",
      "Shipping and vehicle decisions sequenced, not guessed",
    ],
    firstMoves: [
      "Confirm your household constraints and target region",
      "Build the source-of-funds pack once, reuse it everywhere",
      "Get introduced to a mortgage partner before you start viewing",
    ],
  },
  {
    slug: "back-in-the-uk-with-family",
    entryContext: "RETURNER_IN_UK",
    eyebrow: "Already landed",
    headline: "Back in the UK, in the spare room, and stuck.",
    subhead:
      "You are here, the boxes are in storage, and every week in temporary accommodation costs money. The plan starts from where you actually are.",
    proofPoints: [
      "Finance verification first, so viewings are not wasted",
      "Buyer-ready status you can show an agent on day one",
      "Storage and move logistics timed to the legal stages",
      "A single portal instead of six email threads with family in the room",
    ],
    firstMoves: [
      "Confirm budget band and must-haves in the purchase profile",
      "Close out money readiness with verified evidence",
      "Move to search readiness with a buyer-ready position",
    ],
  },
  {
    slug: "buying-faster-at-home",
    entryContext: "UK_RESIDENT_SPEED",
    eyebrow: "Already here",
    headline: "Same engine, no international assumptions.",
    subhead:
      "You live here and you want the purchase run properly: one owner per stage, evidence checked once, and somebody chasing the party who is late.",
    proofPoints: [
      "The same nine-stage ledger, without the currency and shipping steps",
      "One owner at a time, with the day counter visible",
      "Conveyancer and survey stages actively chased, not tracked",
      "Everything in one portal with an audit trail",
    ],
    firstMoves: [
      "Set your target region and timeline in the purchase profile",
      "Complete money readiness to become a credible buyer",
      "Get introduced to a conveyancer before your offer is accepted",
    ],
  },
];

export function storyBySlug(slug: string): EntryStory | null {
  return ENTRY_STORIES.find((story) => story.slug === slug) ?? null;
}

export const REGULATORY_DISCLOSURES: string[] = [
  "Mortgages: we are an introducer only. We do not give mortgage advice — that comes from the FCA-authorised firm we introduce you to.",
  "We may receive a disclosed referral fee from partners you choose to use. It never changes what you pay them, and we tell you before the introduction.",
  "We act for buyers only, in England & Wales. We do not market property for sellers.",
  "Any dates you see in the portal are planning targets from our own stage ledger, not a promise of a completion date.",
];

/** Capabilities that must stay behind the paid tier in every free-facing list. */
export const PAID_ONLY_CAPABILITY_PATTERNS: RegExp[] = [
  /warm intro/i,
  /introduction/i,
  /named advisor/i,
  /named partner/i,
  /playbook/i,
  /evidence standard/i,
  /escalat/i,
  /\bsla\b/i,
  /we chase/i,
  /day counter/i,
];

/** Claims we must never make in v1 sales copy. */
export const FORBIDDEN_CLAIM_PATTERNS: RegExp[] = [
  /guarantee/i,
  /guaranteed/i,
  /mortgage advice/i,
  /we advise/i,
  /chain[- ]free/i,
  /rightmove/i,
  /zoopla/i,
];

export const OUT_OF_SCOPE_GEO_PATTERNS: RegExp[] = [
  /\bscotland\b/i,
  /northern ireland/i,
];

/** Every promise-bearing string, excluding the disclosures (which must name what we do not do). */
export function marketingClaimStrings(): string[] {
  const planStrings = PLAN_ORDER.flatMap((plan) => [
    plan.name,
    plan.tagline,
    plan.price,
    plan.ctaLabel,
    ...plan.features,
    ...plan.limits,
  ]);

  const storyStrings = ENTRY_STORIES.flatMap((story) => [
    story.eyebrow,
    story.headline,
    story.subhead,
    ...story.proofPoints,
    ...story.firstMoves,
  ]);

  return [
    HERO.headline,
    HERO.subhead,
    HERO.primaryCta,
    HERO.secondaryCta,
    ...planStrings,
    ...storyStrings,
  ];
}
