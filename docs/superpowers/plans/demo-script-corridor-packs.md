# Corridor market packs demo script

Founder validation script for the **bidirectional corridor** thesis: the stage engine stays country-agnostic; destination jurisdiction owns the legal spine; AU↔UK and US↔UK are four enabled packs; the disabled `au` stub is still not a domestic Australia product.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. Re-seed is required so the four corridor cases and pack-scoped panel members exist. All logins use password `password`.

---

## 1. Six packs in the inspector, one of them still a stub

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Confirm the sorted list: `au` (disabled), `au_uk` (active), `ew` (active), `uk_au` (active), `uk_us` (active), `us_uk` (active).
3. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla` **on**. `corridor_inbound`, `corridor_outbound` **off**. Stage table still includes **Chain-free position**.
4. Select **`au`**. Still disabled. `finance_path` is present, playbooks are empty, every module is off. `resolveMarketPack("au")` still refuses to back a case.
5. This stub is architecture proof. It is not the Australia product.

## 2. Inbound-to-E&W corridors reuse the E&W spine without chain-free

1. Select **`au_uk`**. Jurisdiction `england_wales`, locale `en-GB · GBP`.
2. Modules: `fx_deposit`, `corridor_inbound`, `corridor_outbound` **on**. `chain_free_inventory`, `partner_speed_rails`, `hard_client_sla`, `document_vault` **off**.
3. Stages are the nine E&W legal keys (`mortgage_path`, `exchange_complete`). There is **no** `chain_free_matching`.
4. Click **returner overseas**. `purchase_profile` requires `profile_complete, corridor_intent`. `money_readiness` requires `source_of_funds, fx_plan`. `move_logistics` requires `move_quote, departure_plan, vehicle_path, visa_status`.
5. Select **`us_uk`**. Same E&W spine and the same three corridor flags. Copy names the United States as origin.

## 3. Outbound corridors use destination law

1. Select **`uk_au`**. Jurisdiction `australia`, locale `en-AU · AUD`, region noun `state`.
2. Stage keys include `finance_path` and `settlement_complete`. They do **not** include `mortgage_path` or `exchange_complete`.
3. Partner labels: mortgage broker, conveyancer, removalist.
4. Select **`uk_us`**. Jurisdiction `united_states`, locale `en-US · USD`. Stage keys include `finance_path` and `closing_complete`. Conveyancer label is **closing attorney**.

## 4. Seeded cases run on the existing engine

1. `/cockpit/cases`. Confirm four new titles with pack badges: **Chen AU→UK return (paid)** (`au_uk`), **Morales US→UK return (paid)** (`us_uk`), **Patel UK→AU purchase (paid)** (`uk_au`), **Hughes UK→US purchase (paid)** (`uk_us`).
2. Open **Chen**. Timeline has nine stages. Playbook on `purchase_profile` names Australia → England & Wales and `corridor_intent`. Warm-intro dropdown offers the `au_uk` panel (Priya / Tom / Dan copies), not the `ew`-only rows alone.
3. Open **Patel**. Timeline shows **Finance path** and **Settlement → complete**. Disclosure on a warm intro uses Australian introducer-only wording (no credit assistance).
4. Open **Hughes**. Timeline shows **Closing**. Partner label in the owner banner is **closing attorney** when that stage is active.

## 5. Diaspora self-serve can pick inbound packs only

1. Sign out → `/start`.
2. The form has **Which corridor are you buying on?** with `England & Wales`, `Australia → England & Wales`, and `United States → England & Wales`. `uk_au` and `uk_us` are absent.
3. Choose **Australia → England & Wales**. The region prompt changes to the `au_uk` copy. Submit a throwaway account if you want; the new case's `marketPackId` is `au_uk` and it has no chain-free stage.

## 6. Advisors open outbound cases; they do not reassign spines

1. Back as advisor on `/cockpit/cases`.
2. **Open a corridor case**: client `client@example.com`, title `Demo UK→AU extra`, pack `uk_au`, entry `returner overseas`.
3. The new case appears with badge `uk_au` and the AU spine.
4. There is no control to change `marketPackId` on an existing case. Entry context can still change; pack cannot.

## 7. What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | Four enabled corridor packs; destination-driven spines; corridor flags; local disclosure; self-serve `au_uk`/`us_uk`; advisor-created `uk_au`/`uk_us`; pack-scoped panel rows; inspector + seed |
| **Stubbed** | Partner adapters and inbound webhooks stay Plan 5 stubs. Hard client SLAs stay off. |
| **Absent** | Domestic AU-only / US-only products, enabling the `au` stub, seller inventory, private seller–buyer introductions, chain-free on corridor packs, speed rails on corridor packs, Prisma schema changes, EntryContext rename |

---

## Automated verification

```bash
npm test -- tests/domain/corridor.test.ts tests/domain/au-uk-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/uk-us-pack.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-registry.test.ts tests/domain/intake.test.ts tests/server/signup.test.ts tests/server/advisor-create-case.test.ts tests/domain/engine-country-agnostic.test.ts
```
