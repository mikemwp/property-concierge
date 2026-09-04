# Property Concierge

UK property purchase orchestration portal — England & Wales (market pack `ew`).

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed logins

All demo users use password **`password`**.

| Role | Email | Area |
|------|-------|------|
| Client | `client@example.com` | `/portal` |
| Advisor | `advisor@example.com` | `/cockpit` |
| Mortgage partner | `mortgage@example.com` | `/partner` |
| Conveyancer | `conveyancer@example.com` | `/partner` |
| Move partner | `move@example.com` | `/partner` |

Seeded cases:

- **Bloggs return (paid)** — `PAID_DWY`, entry `RETURNER_OVERSEAS`, lead `DIASPORA_AU_UK`
- **Smith DIY journey** — `FREE_DIY`, entry `UK_RESIDENT_SPEED`, lead `ORGANIC`
- **Okafor US return (free)** — `FREE_DIY`, entry `RETURNER_OVERSEAS`, lead `DIASPORA_US_UK`

Seeded partner panel (`PartnerPanel`):

| Panel member | Role | SLA | Login |
|--------------|------|-----|-------|
| Priya Nair — Northstar Mortgages | `MORTGAGE_PARTNER` | 3d | `mortgage@example.com` |
| Ravi Patel — Ledger Mortgages | `MORTGAGE_PARTNER` | 3d | none (seeded **inactive**) |
| Tom Ashby — Harbour Law LLP | `CONVEYANCER` | 5d | `conveyancer@example.com` |
| Lena Okoro — Greenway Conveyancing | `CONVEYANCER` | 5d | none |
| Dan Whitfield — Compass Removals | `MOVE_PARTNER` | 4d | `move@example.com` |

## Happy-path demo (free vs paid)

See the step-by-step click script: [`docs/superpowers/plans/demo-script-core-portal.md`](docs/superpowers/plans/demo-script-core-portal.md).

**Paid (orchestrated) thesis in 2 minutes:**

1. Client logs in → open paid case → submit profile evidence on the focus stage.
2. Advisor logs in → accept evidence → advance to `money_readiness`.
3. Advisor requests warm intro to a **named panel member** (event + disclosed referral logged on case).
4. Advance case through money readiness to `mortgage_path` (advisor accepts + advances).
5. Mortgage partner logs in → assigned case appears → submit `dip_aip` evidence.
6. Advisor accepts partner evidence and advances — client portal shows new owner.

**Free DIY difference:**

1. Client opens free case → can self-attest early stages only; `money_readiness` shows upgrade callout.
2. Advisor cockpit: warm intro button **disabled** on free tier.
3. Partner list stays empty until a case focus stage is owned by that partner role (paid path).

## Acquisition funnel

Public pages (no login): `/`, `/pricing`, `/stories/<slug>`, `/start`.

Campaign links carry attribution into the case: `/?utm_source=poms-in-oz&utm_medium=community`.
Recognised tags live in `SOURCE_MAP` in `src/domain/attribution.ts` and are
mirrored in [`docs/playbooks/diaspora-outreach-checklist.md`](docs/playbooks/diaspora-outreach-checklist.md).

`/start` creates a `CLIENT` user plus a `Case` with entry context, tier and lead
attribution. **Paid is the default tier** — only an explicit `plan=free` creates
a `FREE_DIY` case.

Advisors can upgrade a case FREE→PAID and edit the entry context from the case
page; changing entry context rebuilds the required evidence from the market pack.

Validation metrics: `/cockpit/funnel`.

Walkthrough: [`docs/superpowers/plans/demo-script-acquisition-funnel.md`](docs/superpowers/plans/demo-script-acquisition-funnel.md).

## Partner panel, scorecards and referrals

The partner network is a **curated panel**, not a marketplace. Advisors manage it at
`/cockpit/panel`, where each member is scored from the stage ledger alone
(`src/domain/scorecard.ts`): stages attributed, completions, average days in stage,
miss rate and breaches against the member's own SLA (reusing
`src/domain/escalation.ts`), portal participation, nudges, and a 0–100 quality
score with a `STRONG / WATCH / UNDERPERFORMING / NO_DATA` rating. Demoted members
keep their history but cannot receive intros.

Every warm intro (paid) or advisor-marked referral (any tier) creates a
`Referral` with a fee status (`NONE → EXPECTED → RECEIVED | WAIVED`, recorded only —
nothing is paid from this system) and an England & Wales disclosure text
(`src/domain/referral.ts`). Mortgage disclosures state introducer-only / no advice.
Clients see live disclosures on their case page; they never see SLA days, scores or
fee status.

Partner non-response follows the spec: **nudge** (`PARTNER_NUDGED` event, counts
against the scorecard) → **re-route** (`PARTNER_REROUTED` event, previous referral
superseded, partner participant swapped). Free DIY cases get a names-only
**partner directory** with a paid CTA instead of a warm intro.

Walkthrough: [`docs/superpowers/plans/demo-script-partner-network.md`](docs/superpowers/plans/demo-script-partner-network.md).

## Advisor operating IP

Stage playbooks live in `src/domain/market-packs/ew-playbook.ts` and render only
inside `/cockpit`. `assertPlaybookVisible` rejects every non-advisor role, and
`tests/server/cockpit-playbook-policy.test.ts` asserts no playbook string can
appear in a client stage view.

## Scripts

- `npm run dev` — start Next.js dev server
- `npm test` — run Vitest test suite
- `npm run build` — production build
- `npm run db:push` — push Prisma schema to SQLite
- `npm run db:seed` — seed database with demo users and cases

## Stack

Next.js 15, React 19, Vitest, Prisma (SQLite)
