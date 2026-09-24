import type { EntryContext } from "../types";
import { withCorridorPlaybookOverlay } from "./corridor";
import { UK_US_CORRIDOR_COPY, UK_US_FLAGS } from "./uk-us-config";
import type { StagePlaybook } from "./types";

function ukUsLegalPlaybooks(): StagePlaybook[] {
  return [
    {
      stageKey: "purchase_profile",
      objective:
        "Lock the household constraints that every later US stage is planned against: arrival window, target state, budget band, and who signs.",
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
            "Sanity-check the stated budget band against the target state; flag it now if the two do not meet.",
        },
      ],
      evidenceStandard: [
        "profile_complete: target state named, budget band stated as a range, decision-makers listed, arrival or purchase window dated.",
      ],
      escalation: ["Day 3: no profile call booked — advisor calls, does not email."],
      partnerScript: null,
    },
    {
      stageKey: "money_readiness",
      objective:
        "Get the down payment provable and movable into US dollars before anyone tours a property.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Issue the source-of-funds list: statements covering six months, evidence of any gift, and the account the down payment will settle from.",
        },
        {
          day: 5,
          owner: "ADVISOR",
          action:
            "Review the pack against the standard below and reject anything a lender or closing attorney would bounce — once, properly, not twice.",
        },
      ],
      evidenceStandard: [
        "source_of_funds: statements are full pages with the account holder visible, dated within 30 days, and every large deposit explained.",
      ],
      escalation: [
        "Day 7 (SLA): pack incomplete — advisor calls the client and names the single missing document.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "finance_path",
      objective:
        "Hand a clean, pre-briefed case to the US mortgage broker and hold them to a written pre-approval without giving mortgage advice ourselves.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Send the warm intro with the profile summary, income shape, down-payment position and target closing window attached.",
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
            "Chase the lender pack if no pre-approval has landed; ask for the specific blocking item, not a status update.",
        },
      ],
      evidenceStandard: [
        "pre_approval: written pre-approval naming the lender, the amount, and its expiry date.",
      ],
      escalation: [
        "Day 14 (SLA): no pre-approval — advisor calls the broker and sets a 48-hour deadline in the thread.",
      ],
      partnerScript:
        "Introducer framing: 'We do not advise on the mortgage. We are handing you a prepared buyer and we will hold the timeline. Confirm the pre-approval or the blocking item by <date>.'",
    },
    {
      stageKey: "move_logistics",
      objective:
        "Turn the UK→US move into a booked, priced plan sequenced against closing, not against the first free shipping date.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Brief the movers with volume, UK origin, destination state and the earliest and latest acceptable arrival dates.",
        },
        {
          day: 3,
          owner: "MOVE_PARTNER",
          action:
            "Return a written quote covering packing, transit, storage rate and the cancellation terms.",
        },
      ],
      evidenceStandard: [
        "move_quote: written quote with a validity date, storage rate per week, and cancellation terms stated.",
      ],
      escalation: [
        "Day 10 (SLA): no quote — advisor chases the partner directly and offers the second panel member.",
      ],
      partnerScript:
        "'This household has a closing window we control. Quote to the window, include storage, and tell us your cut-off for booking.'",
    },
    {
      stageKey: "search_readiness",
      objective:
        "Make the household credible to US agents on day one: proven funds, a pre-approval, and a written must-have list.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Write the buyer-ready one-pager: budget band, lender, down payment proven, timeline, and who to contact.",
        },
        {
          day: 2,
          owner: "CLIENT",
          action:
            "Agree the must-have versus nice-to-have split so offers are not re-litigated later in the family.",
        },
      ],
      evidenceStandard: [
        "buyer_ready: one-pager exists, pre-approval is unexpired, deposit evidence accepted, and must-haves are written down.",
      ],
      escalation: [
        "Day 7 (SLA): must-haves still unresolved — advisor runs a decision call rather than waiting for consensus.",
      ],
      partnerScript: null,
    },
    {
      stageKey: "offer_instruct",
      objective:
        "Convert an accepted offer into an engaged closing attorney or escrow company with ID cleared, in days rather than weeks.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Warm-intro the closing attorney the same day the offer is accepted; do not wait for the listing agent's packet.",
        },
        {
          day: 1,
          owner: "CONVEYANCER",
          action:
            "Issue the engagement letter and the ID request, and confirm in the thread when it was sent.",
        },
      ],
      evidenceStandard: [
        "closing_agent_instructed: engagement letter signed, ID cleared, and the attorney or escrow company has confirmed it is on the record.",
      ],
      escalation: [
        "Day 5 (SLA): not instructed — advisor calls the firm and the listing agent on the same day.",
      ],
      partnerScript:
        "'Offer accepted on <date>. We hold the timeline and the client is document-ready. Confirm engagement and your title-order date.'",
    },
    {
      stageKey: "diligence",
      objective:
        "Keep inspection, title, appraisal and HOA review moving in parallel and surface defects while there is still time to price them.",
      actions: [
        {
          day: 0,
          owner: "CONVEYANCER",
          action:
            "Open the inspection period on day one of engagement and state the contingency dates in the thread.",
        },
        {
          day: 2,
          owner: "ADVISOR",
          action:
            "Book the home inspection in parallel with title; never sequence them.",
        },
      ],
      evidenceStandard: [
        "inspection_complete: inspection report received, title exceptions summarised, and any adverse finding explained to the client in plain English.",
      ],
      escalation: [
        "Day 21 (SLA): contingencies still open — advisor escalates with the dated list.",
      ],
      partnerScript:
        "'Here is the dated list of open contingencies and who holds each one. Which three close this week?'",
    },
    {
      stageKey: "closing_complete",
      objective:
        "Land funds and dates together so closing happens on the planned day, not the first day everyone is free.",
      actions: [
        {
          day: 0,
          owner: "ADVISOR",
          action:
            "Work backwards from the target closing date to the date cleared funds must sit with escrow.",
        },
        {
          day: 3,
          owner: "CONVEYANCER",
          action:
            "Confirm the closing appointment in the thread and give the movers the same date that day.",
        },
      ],
      evidenceStandard: [
        "closing_confirmed: closing appointment booked in writing, date circulated to client and movers, keys handover arranged.",
      ],
      escalation: [
        "Day 14 (SLA): no closing date — advisor escalates and tells the client exactly who is holding it.",
      ],
      partnerScript:
        "'Target closing is <date>. Funds clear on <date - 2>. Confirm you can close or tell us who cannot.'",
    },
    {
      stageKey: "settle_light",
      objective:
        "Close the loop on the light settle checklist and capture what this corridor case taught us before the file goes quiet.",
      actions: [
        {
          day: 1,
          owner: "CLIENT",
          action:
            "Work the settle checklist: utilities, property tax, doctor, schools, address updates.",
        },
        {
          day: 7,
          owner: "ADVISOR",
          action:
            "Run the debrief call: what was slow, which partner performed, and would they recommend us in their community.",
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

export function ukUsPlaybooks(entry: EntryContext): StagePlaybook[] {
  return withCorridorPlaybookOverlay(
    ukUsLegalPlaybooks(),
    entry,
    UK_US_FLAGS,
    UK_US_CORRIDOR_COPY,
  );
}
