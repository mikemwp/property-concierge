# Market pack demo script

Founder validation script for the **configuration layer** thesis: England & Wales is a
pack, not the product; the stage engine is country-agnostic; a second pack can be
registered without touching the engine; and an unknown or not-yet-enabled market fails
closed instead of silently behaving like the UK.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. E&W is a pack, and the cockpit can read it

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Two packs are listed: `ew · England & Wales` (**active**) and `au · Australia (configuration stub — not enabled)` (**disabled**).
3. On `ew`, confirm jurisdiction `england_wales`, locale `en-GB · GBP`, address keys `line1, line2, town, county, postcode`.
4. Modules: only `fx_deposit` is **on**. `chain_free_inventory`, `hard_client_sla`, `corridor_inbound`, `corridor_outbound`, `document_vault` and `partner_speed_rails` are **off** — the spec §9 dependency rule as data, not a promise in a doc.
5. The stage table shows the nine E&W stages with owner labels from the pack (`conveyancer`, `mortgage adviser`, `removals partner`), SLA days and required evidence.
6. Jurisdiction copy shows `region_prompt`, `directory_intro`, `mortgage_posture` and `jurisdiction_scope` — the same strings the funnel and portal render.
7. Note what is **not** here: no playbook prose. Playbook IP still renders only on a case page.

## 2. Entry context branches the pack, not the engine

1. Still on `/cockpit/market-packs`, click **returner overseas** → `money_readiness` requires `source_of_funds, fx_plan`; `move_logistics` requires `move_quote, vehicle_path`.
2. Click **uk resident speed** → `money_readiness` requires `source_of_funds` only and `move_logistics` drops `vehicle_path`.
3. Nothing about the engine changed: only `buildStages(entry)` on the pack.

## 3. The engine reads the pack through the case

1. `/cockpit/cases` → **Bloggs return (paid)**.
2. The current-owner banner's days-in-stage and escalation come from the pack's SLA for that stage (`purchase_profile` = 3 days), resolved via `case.marketPackId`.
3. **Warm intro** → the dropdown only offers members of the `ew` panel. Request one.
4. **Referrals & disclosure**: the disclosure text is the `ew` pack's wording — "introducer only", "do not give mortgage advice".
5. Advisor case controls → **Entry context** → change it. The required evidence rebuilds from the pack, not from a hardcoded list.

## 4. The second pack proves the registry without shipping AU

1. Back on `/cockpit/market-packs`, select the **au** pack.
2. Confirm locale `en-AU · AUD`, region noun `state`, stage key `finance_path` instead of `mortgage_path`, **every** stage `hidden` to free users, **zero** evidence kinds, **zero** playbooks, and every module off.
3. This is the whole point: the engine renders a nine-stage plan for a pack with different keys, a different currency and no UK legal steps. Corridor product work stays Plan 7.

## 5. Fail closed, not fail-UK

Run in a scratch shell (`npx tsx`), or read `tests/server/market-pack-resolution.test.ts`
which asserts exactly this:

1. Creating a case with `marketPackId: "au"` rejects with `Market pack is not enabled: au`.
2. Editing a stored case to `marketPackId: "zz"` makes `loadCase` reject with `Unknown market pack: zz`.
3. Neither falls back to `ew`. A market we have not built refuses to run rather than quietly applying English law.

## 6. Guardrails you cannot regress past

1. `npm test -- tests/domain/engine-country-agnostic.test.ts` — the engine-global modules
   contain no `£`, `GBP`, `en-GB`, `england` or `wales`, and never import the `ew` pack.
2. `npm test -- tests/domain/market-pack-flags.test.ts` — chain-free and hard-SLA modules
   are off in every registered pack.
3. `npm test -- tests/domain/market-pack-inspector.test.ts` — the inspector view model
   carries no playbook prose.
