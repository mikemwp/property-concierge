import type { ActorRole, EntryContext } from "../types";
import { moneyEvidenceKinds, moveEvidenceKinds } from "./ew";

export type PlaybookAction = {
  /** Working days from stage activation. */
  day: number;
  owner: ActorRole;
  action: string;
};

export type StagePlaybook = {
  stageKey: string;
  objective: string;
  actions: PlaybookAction[];
  evidenceStandard: string[];
  escalation: string[];
  partnerScript: string | null;
};

function isOverseas(entry: EntryContext): boolean {
  return entry === "RETURNER_OVERSEAS";
}

function needsCurrencyWork(entry: EntryContext): boolean {
  return entry !== "UK_RESIDENT_SPEED";
}

const MONEY_EVIDENCE: Record<string, string> = {
  source_of_funds:
    "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every deposit over £1,000 explained.",
  fx_plan:
    "fx_plan: transfer route named, target settlement date set, and the client understands the rate is not fixed by us.",
};

const MOVE_EVIDENCE: Record<string, string> = {
  move_quote:
    "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
  vehicle_path:
    "vehicle_path: decision recorded for each vehicle — ship, sell, or leave — with the registration steps listed.",
};

function linesFor(kinds: string[], copy: Record<string, string>): string[] {
  return kinds.map((kind) => {
    const line = copy[kind];
    if (!line) {
      throw new Error(`Missing playbook evidence copy for ${kind}`);
    }
    return line;
  });
}

export function ewPlaybooks(entry: EntryContext): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective:
        "Lock the household constraints that every later stage is planned against: arrival window, target region, budget band, and who signs.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Run the 20-minute profile call in the client's timezone and write the constraints into the case title and notes.",
        },
        {
          day: 1,
          owner: "ADVISOR",
          action:
            "Sanity-check the stated budget band against the target region; flag it now if the two do not meet.",
        },
        ...(isOverseas(entry)
          ? [
              {
                day: 1,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Confirm the arrival window and whether the client will be in the UK for viewings or buying remotely.",
              },
            ]
          : []),
      ],
      evidenceStandard: [
        "profile_complete: target region named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
      ],
      escalation: [
        "Day 3: no profile call booked — advisor calls, does not email.",
        "Day 5: still unbooked — mark the stage blocked with reason 'client unavailable' so the ledger shows the true owner.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective:
        "Get the deposit provable and movable, and the credit position legible to a UK lender, before anyone views a property.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Issue the source-of-funds list: statements covering six months, evidence of any gift, and the account the deposit will settle from.",
        },
        ...(needsCurrencyWork(entry)
          ? [
              {
                day: 2,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Agree the FX plan: which currency the deposit sits in, the transfer route, and the latest date funds must be in a UK account.",
              },
            ]
          : []),
        ...(isOverseas(entry)
          ? [
              {
                day: 3,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Start UK credit-file groundwork: correspondence address, electoral roll where eligible, and a UK current account opened early.",
              },
            ]
          : []),
        {
          day: 5,
          owner: "ADVISOR",
          action:
            "Review the pack against the standard below and reject anything a lender or conveyancer would bounce — once, properly, not twice.",
        },
      ],
      evidenceStandard: linesFor(moneyEvidenceKinds(entry), MONEY_EVIDENCE),
      escalation: [
        "Day 7 (SLA): pack incomplete — advisor calls the client and names the single missing document.",
        "Day 11: still incomplete — block the stage; do not let search readiness start on an unproven deposit.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "mortgage_path",
      objective:
        "Hand a clean, pre-briefed case to the mortgage partner and hold them to a decision in principle without giving advice ourselves.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Send the warm intro with the profile summary, income shape, deposit position and target completion window attached.",
        },
        {
          day: 2,
          owner: "MORTGAGE_PARTNER",
          action:
            "Complete the fact-find and confirm in the thread which lender routes are realistic for this income and address history.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Chase the lender pack if no DIP/AIP has landed; ask for the specific blocking item, not a status update.",
        },
      ],
      evidenceStandard: [
        "dip_aip: decision in principle in writing, naming the lender, the amount, and its expiry date.",
      ],
      escalation: [
        "Day 14 (SLA): no DIP — advisor calls the partner and sets a 48-hour deadline in the thread.",
        "Day 17: still nothing — re-route to the second mortgage partner and log why.",
      ],
      partnerScript:
        "Introducer framing: 'We do not advise on the mortgage. We are handing you a prepared buyer and we will hold the timeline. Confirm the DIP or the blocking item by <date>.'",
    },
    {
      stageKey: "move_logistics",
      objective:
        "Turn the move from an open question into a booked, priced plan that is sequenced against the legal stages.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Brief the move partner with volume, origin, destination region and the earliest and latest acceptable arrival dates.",
        },
        {
          day: 3,
          owner: "MOVE_PARTNER",
          action:
            "Return a written quote covering packing, transit, storage rate and the cancellation terms.",
        },
        ...(isOverseas(entry)
          ? [
              {
                day: 4,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Decide the container and vehicle path: what ships, what sells, and the registration steps needed on arrival.",
              },
            ]
          : []),
        {
          day: 6,
          owner: "ADVISOR",
          action:
            "Confirm storage is booked as the fallback so the move never becomes the reason a completion date slips.",
        },
      ],
      evidenceStandard: linesFor(moveEvidenceKinds(entry), MOVE_EVIDENCE),
      escalation: [
        "Day 10 (SLA): no quote — advisor chases the partner directly and offers the second panel member.",
        "Day 14: no quote from either — block the stage and tell the client which decision is now at risk.",
      ],
      partnerScript:
        "'This household has a legal completion window we control. Quote to the window, include storage, and tell us your cut-off for booking.'",
    },
    {
      stageKey: "search_readiness",
      objective:
        "Make the household credible to agents on day one: proven funds, a DIP, and a written must-have list.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Write the buyer-ready one-pager: budget band, DIP lender, deposit proven, timeline, and who to contact.",
        },
        {
          day: 2,
          owner: "CLIENT",
          action:
            "Agree the must-have versus nice-to-have split so offers are not re-litigated later in the family.",
        },
        {
          day: 4,
          owner: "ADVISOR",
          action:
            "Confirm how remote viewings will be handled and who can physically attend at short notice.",
        },
      ],
      evidenceStandard: [
        "buyer_ready: one-pager exists, DIP is unexpired, deposit evidence accepted, and must-haves are written down.",
      ],
      escalation: [
        "Day 7 (SLA): must-haves still unresolved — advisor runs a decision call rather than waiting for consensus.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "offer_instruct",
      objective:
        "Convert an accepted offer into an instructed conveyancer with ID and AML cleared, in days rather than weeks.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Warm-intro the conveyancer the same day the offer is accepted; do not wait for the agent's memorandum of sale.",
        },
        {
          day: 1,
          owner: "CONVEYANCER",
          action:
            "Issue the client care pack and the ID/AML request, and confirm in the thread when it was sent.",
        },
        {
          day: 3,
          owner: "ADVISOR",
          action:
            "Chase ID/AML completion; for overseas clients confirm the certification route before it becomes a two-week delay.",
        },
      ],
      evidenceStandard: [
        "conveyancer_instructed: client care pack signed, ID/AML cleared, and the firm has confirmed it is on the record.",
      ],
      escalation: [
        "Day 5 (SLA): not instructed — advisor calls the firm and the agent on the same day.",
        "Day 8: still not instructed — re-route to the second conveyancing panel member.",
      ],
      partnerScript:
        "'Offer accepted on <date>. We hold the timeline and the client is document-ready. Confirm instruction and your searches order date.'",
    },
    {
      stageKey: "diligence",
      objective:
        "Keep searches, enquiries, survey and valuation moving in parallel and surface defects while there is still time to price them.",
      actions: [
        {
          day: 0,
          owner: "CONVEYANCER",
          action:
            "Order searches on day one of instruction and state the local authority's current turnaround in the thread.",
        },
        {
          day: 2,
          owner: "ADVISOR",
          action:
            "Book the survey in parallel with searches; never sequence them.",
        },
        {
          day: 10,
          owner: "ADVISOR",
          action:
            "Run a weekly enquiry review: list every open enquiry, who holds it, and how many days it has been open.",
        },
      ],
      evidenceStandard: [
        "searches_complete: all ordered searches returned, enquiries raised, and any adverse finding summarised for the client in plain English.",
      ],
      escalation: [
        "Day 21 (SLA): enquiries still open — advisor escalates to the fee earner's supervisor with the dated list.",
        "Any survey defect over the client's stated threshold: advisor convenes a price or walk-away conversation within 48 hours.",
      ],
      partnerScript:
        "'Here is the dated list of open enquiries and who holds each one. Which three close this week?'",
    },
    {
      stageKey: "exchange_complete",
      objective:
        "Land funds and dates together so exchange and completion happen on the planned day, not the first day everyone is free.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Work backwards from the target completion date to the date cleared funds must sit in the conveyancer's client account.",
        },
        ...(needsCurrencyWork(entry)
          ? [
              {
                day: 1,
                owner: "ADVISOR" as ActorRole,
                action:
                  "Confirm the final currency transfer is executed with buffer days — never on the completion date itself.",
              },
            ]
          : []),
        {
          day: 3,
          owner: "CONVEYANCER",
          action:
            "Confirm the exchange date in the thread and give the removals partner the completion date the same day.",
        },
      ],
      evidenceStandard: [
        "completion_confirmed: exchange confirmed in writing, completion date circulated to client and move partner, keys handover arranged.",
      ],
      escalation: [
        "Day 14 (SLA): no exchange date — advisor escalates on the chain and tells the client exactly who is holding it.",
        "Funds not cleared 48 hours before completion: advisor treats it as a red blocker and calls all parties.",
      ],
      partnerScript:
        "'Target completion is <date>. Funds clear on <date - 2>. Confirm you can exchange by <date - 5> or tell us who cannot.'",
    },
    {
      stageKey: "settle_light",
      objective:
        "Close the loop on the light settle checklist and capture what this case taught us before the file goes quiet.",
      actions: [
        {
          day: 1,
          owner: "CLIENT",
          action:
            "Work the settle checklist: utilities, council tax, GP registration, schools, address updates.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Run the debrief call: what was slow, which partner performed, and would they recommend us in their community.",
        },
        {
          day: 10,
          owner: "ADVISOR",
          action:
            "Write the case lessons into the outreach checklist so the next household in that community starts warmer.",
        },
      ],
      evidenceStandard: [
        "Debrief completed and the partner performance notes are written into the case thread while they are still accurate.",
      ],
      escalation: [
        "Day 14 (SLA): no debrief — advisor books it directly; this is the validation evidence, not an optional courtesy.",
      ],
      partnerScript: null,
    },
  ];
}

export function ewStagePlaybook(
  stageKey: string,
  entry: EntryContext,
): StagePlaybook | null {
  return ewPlaybooks(entry).find((p) => p.stageKey === stageKey) ?? null;
}
