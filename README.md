# Property Concierge

UK property purchase orchestration portal — England & Wales (market pack `ew`).

## Setup

```bash
npm install
cp .env.example .env
```

Set `PARTNER_WEBHOOK_SECRET` in `.env` (seeded as `dev-partner-secret` in `.env.example`). Replace it outside development — the inbound webhook accepts only this shared secret.

```bash
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

Seeded partner panel (`PartnerPanel`) — all five members are on the `ew` panel (`marketPackId = "ew"`):

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

## Partner speed rails (deep integrations, stubbed)

Paid England & Wales cases with the `partner_speed_rails` module on get a **clean integration port** behind which manual ops, stub adapters and future vendor clients are interchangeable implementations.

The port lives in `src/lib/partner-port.ts`:

| Method | Purpose |
|--------|---------|
| `requestWarmIntro` | Opens an integration ticket when the advisor requests a warm intro |
| `acknowledgeCase` | Partner confirms receipt; records acknowledgement latency |
| `syncStatus` | Advisor pulls the latest vendor-neutral status from the adapter |
| `submitPartnerEvidence` | Partner or inbound path submits required evidence kinds |
| `reportMilestone` | Partner reports pack-defined process milestones |

| Implementation | `adapterId` | When selected |
|----------------|-------------|---------------|
| `ManualPartnerPort` | `manual` | Free tier, or pack with `partner_speed_rails` off |
| `StubPartnerAdapter` (mortgage profile) | `stub-mortgage` | Paid E&W, focus owned by mortgage partner |
| `StubPartnerAdapter` (conveyancer profile) | `stub-conveyancer` | Paid E&W, focus owned by conveyancer |
| `StubPartnerAdapter` (move profile) | `stub-move` | Paid E&W, focus owned by move partner |
| A future vendor client | *(vendor-specific)* | Drops in with no engine rewrite |

**Deliberately absent from the port:** accept, advance, block, resume, re-route and create-referral. Those are advisor powers and stay in the cockpit. Enforced by `tests/server/adapter-authority.test.ts`.

**Four additive ledger event types** (Plan 1–3 event shapes are frozen): `PARTNER_CASE_ACKNOWLEDGED`, `PARTNER_STATUS_SYNCED`, `PARTNER_MILESTONE_REPORTED`, `PARTNER_UPDATE_REJECTED`.

**Simulated turnaround** is deterministic: days-in-stage divided by the role profile's cadence walks a fixed status ladder — never random, never networked. See `tests/lib/partner-adapters.test.ts`.

**Inbound loopback:** `POST /api/partner-updates` with header `x-partner-signature` matching `PARTNER_WEBHOOK_SECRET`. Replace the secret outside development.

**Gate:** `partner_speed_rails` (pack module) **and** `PAID_DWY` (tier), checked by `canUseSpeedRails` / `assertSpeedRails` in `src/server/partner-policy.ts`.

**Milestone vocabulary** is pack data (`src/domain/market-packs/ew-milestones.ts`); a second market brings its own process language.

**No live third-party conveyancing, FX, mortgage or removals integration exists, and no client-facing guaranteed date is produced anywhere in this system.**

Walkthrough: [`docs/superpowers/plans/demo-script-speed-rails.md`](docs/superpowers/plans/demo-script-speed-rails.md).

## Market packs (configuration layer)

England & Wales is the **first market pack**, not the product. The stage engine is
country-agnostic; everything local lives in `src/domain/market-packs/`:

| Layer | File | Responsibility |
|---|---|---|
| Interface + pure helpers | `types.ts` | `MarketPack`, `MarketLocale`, `MarketFlags`, `MarketCopy`, `PartnerRoleLabels`, `StagePlaybook`, `MarketPackError` |
| Money formatting | `locale.ts` | `formatMoney(locale, amount)` — no currency literal anywhere else |
| E&W config | `ew-config.ts` | locale (`en-GB` / `GBP`), module flags, jurisdiction copy, partner-role labels |
| E&W legal spine | `ew-stages.ts` | the nine stage templates and their evidence kinds |
| E&W operating IP | `ew-playbook.ts` | entry-context playbooks (advisor-only) |
| E&W consumer law | `ew-disclosure.ts` | referral disclosure wording |
| Assembly | `ew.ts`, `au-stub.ts` | pack objects only |
| Resolution | `registry.ts` | `DEFAULT_MARKET_PACK_ID`, `listMarketPacks`, `resolveMarketPack` |
| Cockpit view model | `inspector.ts` | read-only `marketPackSummary` |

**Resolution is fail-closed.** Every surface resolves the pack from `case.marketPackId`
(`src/lib/case-pack.ts` → `casePack`, `stageSlaDays`). An unknown id or a registered-but-
disabled pack throws `MarketPackError` — it never falls back to `ew`.

**Module toggles are data, not scattered ifs.** `MarketFlags` on the pack are read through
`isModuleEnabled`. The `ew` pack runs `fx_deposit` and `partner_speed_rails`;
`chain_free_inventory`, `hard_client_sla`, `corridor_inbound`, `corridor_outbound` and
`document_vault` are **off** in every pack — the spec §9 dependency rule as data, not a
promise in a doc. Speed rails being on means adapter plumbing exists, not that any date is
guaranteed. Enforced by `tests/domain/market-pack-flags.test.ts`.

**`au` is a stub, not a product.** It is registered and `enabled: false`, with a different
currency, address shape and stage keys (`finance_path`, `settlement_complete`), no
playbooks, no evidence kinds and no partners. It exists to prove the registry resolves more
than one pack. Corridor journeys (AU↔UK, US↔UK) are a later plan.

**What stays engine-global:** the stage engine, pressure/escalation model, freemium
discipline, partner scorecards and advisor cockpit. `tests/domain/engine-country-agnostic.test.ts`
scans those modules and fails if any of them gains a jurisdiction literal or imports the
`ew` pack directly.

**Known limitation:** `EntryContext` values (`RETURNER_IN_UK`, `UK_RESIDENT_SPEED`) are
persisted enum labels from earlier plans and were deliberately not renamed. Entry context
is metadata; packs localise it through `MarketCopy` and `buildPlaybooks(entry)`. Marketing
copy in `src/content/marketing.ts` is brand copy and is intentionally not pack data.

Walkthrough: [`docs/superpowers/plans/demo-script-market-packs.md`](docs/superpowers/plans/demo-script-market-packs.md).

## Advisor operating IP

Stage playbooks live in `src/domain/market-packs/ew-playbook.ts`, resolve through
`pack.buildPlaybooks(entry)` and render only inside `/cockpit`. `assertPlaybookVisible`
rejects every non-advisor role, and `tests/server/cockpit-playbook-policy.test.ts` asserts
no playbook string can appear in a client stage view. The read-only pack inspector at
`/cockpit/market-packs` is guarded by `assertPackInspectorVisible` and deliberately carries
no playbook prose.

## Scripts

- `npm run dev` — start Next.js dev server
- `npm test` — run Vitest test suite
- `npm run build` — production build
- `npm run db:push` — push Prisma schema to SQLite
- `npm run db:seed` — seed database with demo users and cases

## Stack

Next.js 15, React 19, Vitest, Prisma (SQLite)
