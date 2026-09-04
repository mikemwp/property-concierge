# Property Concierge — Design Spec

**Date:** 2026-09-04  
**Status:** Draft for founder review  
**Repo:** https://github.com/mikemwp/property-concierge.git  
**Local:** `D:\Development\Property-Concierge`

## 1. Vision and positioning

**Working name:** Property Concierge (placeholder; final brand TBD).

**One-liner:** A guided purchase-and-move workflow with a rigid stage portal that names who is blocking — not another email chain.

**What we sell:** Certainty and speed (lower carry cost, lower fall-through risk), orchestrated through one stage engine. “Chain-free” and “returner” are beachheads, not the forever product definition.

**v1 customer (validation + marketing):** UK/dual nationals returning after years abroad, especially AU→UK and US→UK diaspora communities. Entry may be still overseas or already back (e.g. living with family).

**Product generality (non-negotiable):** The stage model must also serve UK-resident buyers who want a faster, streamlined purchase. Do not hard-code “international only” into stage names or domain objects. Entry context (returner overseas / returner in-UK / UK-resident speed-seeker) is metadata that branches checklists and partners.

**v1 geography:** Buy anywhere in England & Wales. Scotland and Northern Ireland out of scope for v1.

**Success for v1:**
- ~10–20 households through the real workflow (validation)
- Become a default recommendation in 1–2 diaspora communities
- Evidence from the portal stage ledger and partner audit trail — not anecdotes alone

## 2. Approach

**v1 build approach:** Ops-first with a real stage portal (Approach 1).
- Ship client portal + advisor cockpit + stage pressure engine early
- Keep partner network curated and largely manual behind clean interfaces
- Free track = limited funnel; paid track = the real product

**North star (Approach 3):** Full homecoming / relocation OS + deep partner integrations + verified chain-free matching overlay + optional hard timeline guarantees — after E&W proof.

**Explicit non-goals for v1:**
- Competing with Rightmove/Zoopla on general property search
- Open partner marketplace
- In-house FCA-authorised mortgage advice
- Owning a law firm / ABS
- Hard completion guarantees
- Seller-side chain-free inventory product
- Scotland / NI
- Second-country market packs (architecture ready only)

## 3. Scope

### v1 in scope
- Property-finance core: mortgage triage as introducer, FX for deposit where relevant, conveyancing panel, purchase milestones
- Move logistics: quote → book → storage if needed; vehicles/registration when relevant (international *or* domestic)
- Light checklist only for other settle tasks (banking, GP, schools, utilities, etc.)
- Rigid multi-party portal with stage ownership, pressure/escalation, document vault, threads
- Curated partner panel with scorecards derived from the ledger

### Documented later (not v1)
- Full paid concierge package as primary consumer monetisation
- Soft published timelines, then hard service guarantees with legal carve-outs
- Full homecoming OS (north star checklist depth)
- Inbound internationals, then broader finance-complex / chain-free buyers
- Verified chain-free certification and matching; seller milestone views; agent/developer verified-buyer leads
- International corridors via market packs (AU↔UK first after E&W)

## 4. Journeys and stages

### Entry points
| Entry | Typical start | Emphasis |
|---|---|---|
| Overseas returner | 6–18 months out | FX, credit-file prep, mortgage triage, shipping/vehicles, destination planning |
| Returner already in UK | With family / temp setup | Finance verification, search readiness, UK-side logistics |
| UK-resident speed-seeker | Same engine | Domestic move logistics; no international assumptions |

### Canonical stage groups
Each stage has: owner role, due date, required evidence, blocker flag, escalation rules. Exactly one **current stage owner** at a time.

1. **Purchase profile** — timeline, destination region(s), household constraints, entry-context metadata  
2. **Money readiness** — banking/credit-file checklist, FX plan when needed, source-of-funds vault  
3. **Mortgage path** — specialist intro → fact-find → DIP/AIP → full application (partner-led)  
4. **Move logistics** — quote → book → storage; vehicles/registration only when relevant  
5. **Search readiness** — budget band, must-haves, buyer-ready status  
6. **Offer → instruct** — offer accepted → conveyancer instructed → ID/AML  
7. **Diligence** — survey, searches, enquiries, lender valuation  
8. **Exchange → complete** — funds timing (incl. FX), exchange, completion  
9. **Settle (light)** — utilities/GP/schools checklist; paid human optional  

### Pressure model
- Visible days-in-stage and escalating nudges
- Official milestones advance only when evidence is accepted (client submit and/or advisor/partner push)
- Partner quality = time-in-stage, miss rate, completion rate from the same ledger
- Email/notifications are projections; the portal is the source of truth

## 5. Free vs paid (freemium discipline)

**Paid done-with-you is the default product** in UX, copy, and outcomes.

**Free DIY is a funnel, not a substitute:**
- Orientation, high-level stage map, education, a taste of accountability
- Partner directory (not warm intro)
- Must not give away operating IP that lets someone run the full purchase as a peer alternative

**IP behind paid:**
- Detailed playbooks and evidence standards for verified gates
- Partner routing logic and warm-intro threads
- Escalation rules and advisor cockpit behaviours
- Full “who’s blocking / what good looks like” operating system

**v1 paid promise:** Orchestration + warm intros to named mortgage / conveyancer / removals (and related) partners; advisor stays in the multi-party thread.

**Later promises (gated):**
- Soft published target timelines once ledger proves what “fast” means
- Hard service guarantee dates when partner SLAs allow, with legal disclaimers for events outside pipeline control (lender delay, survey defects, leasehold packs, client inaction, etc.)

## 6. Product surfaces and roles

**Surfaces**
1. Marketing site — diaspora-led story; clear path into free (limited) or paid (primary)
2. Client portal — journey map, current owner, days-in-stage, tasks/docs, thread
3. Advisor cockpit — advance/pause/block, evidence accept/reject, warm-intro launcher, notes, escalations
4. Partner mini-view (v1 light) — assigned stages, upload evidence, mark ready-for-review

**Roles:** Client (household), Advisor, Mortgage partner, Conveyancer, Move partner; later Surveyor/Agent as needed.

**Search:** External (Rightmove/Zoopla). Hooks only (e.g. paste listing / mark offer). No scraping; no general listings destination.

## 7. Monetisation and partners

### v1
- Paid orchestration fee (done-with-you)
- Disclosed referral income: FX, conveyancing, mortgage introducer share, removals/storage, survey, utilities
- Free may earn light disclosed referral if user self-selects a directory partner

### Next monetisation wave
- Full paid concierge package as primary consumer fee (highest willingness-to-pay layer), still stacked with referrals

### Launch revenue priority
FX referral → paid orchestration → conveyancing panel → mortgage introducer → removals → survey/utilities.  
Do **not** start as an FCA Appointed Representative.

### Partner model
- Small curated panel, not an open marketplace
- Contracted on: response SLA, portal participation, referral disclosure, quality score from ledger
- National mortgage advisors; national/multi-region conveyancers; local survey/removals by postcode
- **Manual partner ops in v1 behind clean APIs/interfaces** so deeper integrations can land without rewrite — tight integration is a deliberate future speed moat for chain-free and speed-seeking buyers

### Regulatory posture (v1)
- Mortgage: introducer only; no advice; financial promotions reviewed before launch marketing
- Conveyancing referrals: lawful if disclosed
- Buyer-side orchestrator: avoid estate-agency activity (no private seller–buyer introduction for a fee in v1)
- Hard guarantees only after legal review of carve-outs

## 8. System shape

**Core domain objects**
- Case (household purchase) + entry-context metadata
- Stage ledger (owner, timestamps, escalations, evidence)
- Actors (client, advisor, typed partners)
- Document vault (role ACL; one-time upload principle)
- Case-scoped thread with audit trail
- Partner scorecard (derived from ledger)
- Referral event (partner, case, fee status, disclosure record)

**Architecture stance**
- One web app: marketing + client portal + advisor cockpit (+ light partner view)
- Stage engine is source of truth
- Clean partner interfaces from day one; manual fulfilment acceptable in v1
- England & Wales as first **market pack**; feature-flag future segments and modules
- **International-ready:** country-agnostic stage engine; local rules/partners/copy live in market packs — do not encode UK-only assumptions into the domain model (currency, address, legal steps as config/data)

**Failure / pressure behaviour**
- Stage exceeds SLA → escalate to advisor → visible on client timeline
- Partner non-response → nudge + scorecard hit + advisor re-route
- Client inactivity → paid advisor chase; DIY soft nudge + upgrade prompt (not full chase playbook)

**Validation metrics**
- Activation, paid conversion, time-in-stage by owner, partner SLA adherence, diaspora referral source
- Kill DIY features that reduce paid conversion without improving trust

## 9. Roadmap

| Phase | Focus |
|---|---|
| **0 — Validate (v1)** | Returner-led marketing; E&W; rigid portal; free funnel + paid orchestration; curated panel; 10–20 cases + community traction |
| **1 — Monetisation deepen** | Full concierge package; richer attach; soft timelines when data supports them |
| **2 — Speed rails** | Deep integrations (conveyancing, FX, removals); stronger partner views; optional hard guarantees; explicit UK-resident speed segment |
| **3 — Audience expand** | Inbound internationals → broader finance-complex / chain-free buyers |
| **4 — Platform north star** | Full homecoming OS; verified chain-free certification/matching; seller views; agent/developer lead fees; deeper vertical integration if warranted |
| **5 — International corridors** | Reuse engine; ship new market packs; first corridor **AU↔UK** (bidirectional), then **US↔UK**; domestic AU/US packs only after corridor proof |

**Dependency rule:** Do not sell chain-free inventory or hard SLAs until the stage engine and partner scorecards are real. Speed credibility is earned in the ledger first.

## 10. International-ready model

| Layer | Design rule |
|---|---|
| Stage engine | Country-agnostic: profile → money → finance → move → search → offer → diligence → complete → settle |
| Market pack | E&W v1 = first pack (partners, regs, checklists, copy). Later AU, then others |
| Corridors | Think AU↔UK, US↔UK — not only “into the UK”. Same brand family, different packs |
| What travels | Portal pressure model, freemium discipline, partner scorecards, advisor cockpit |
| What doesn’t | Mortgage rules, conveyancing, land registries, consumer law, partner panels — always local |

Founder insight: lessons from England→Australia and Australia→England were bidirectional. Capture playbooks as market packs so learning in one corridor improves the other.

## 11. Risks

- DIY too generous → paid conversion dies → keep free limited; IP behind paid
- Portal ignored → email relapse → advisor enforces portal; partners contracted to use it
- Partner non-performance → brand damage → scorecards, small panel, easy re-route
- Regulatory creep → introducer-only; buyer-side only; legal review of promotions
- Thin volume → lukewarm panel → diaspora density and concierge quality over spray
- Premature international/chain-free build → stalls learning → market-pack architecture only until E&W proof

## 12. Open decisions (not blocking this spec)

- Final product/brand name
- Exact paid-tier price points
- First 3–5 named partners (mortgage, conveyancing, FX, removals)
- Which 1–2 diaspora communities for the community-success metric
- Implementation stack/tech choices (implementation planning)

## 13. Sub-projects (for later planning)

This platform is multi-subsystem. Recommended implementation order after this spec is approved:

1. Stage engine + client portal + advisor cockpit (core OS)
2. Returner acquisition funnel + paid orchestration ops playbook
3. Partner panel + scorecards + referral/disclosure plumbing
4. Market-pack configuration layer (E&W first)
5. Deep partner integrations (speed rails)
6. Chain-free certification/matching (post-proof)
7. Additional corridor market packs (AU↔UK, US↔UK)

---

## Spec self-review notes

- No TBD placeholders left in normative v1 requirements; open decisions explicitly listed in §12
- Freemium, international-ready, and manual-ops-behind-clean-APIs principles are consistent across sections
- v1 scope is deliberately narrower than north star; chain-free and hard SLAs gated on ledger proof
- Ambiguity resolved: “homecoming” language replaced with purchase profile / move logistics; international is entry metadata + market packs, not a hard product limit
