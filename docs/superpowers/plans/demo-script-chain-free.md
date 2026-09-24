# Chain-free overlay demo script

Founder validation script for the **buyer-side certification overlay, not a seller inventory** thesis: England & Wales cases can be certified chain-free from the stage ledger and partner scorecards; clients see status copy without numbers or dates; marketing may say chain-free; we still do not list sellers or promise a completion day.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. Re-seed is required so new E&W cases pick up the `chain_free_matching` stage. All logins use password `password`.

---

## 1. The module is on for ew; published dates are still targets

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew · England & Wales`**. Under **Modules**, confirm `fx_deposit`, `partner_speed_rails`, `chain_free_inventory` and `hard_client_sla` are **on**.
3. The stage table now lists **Chain-free position** (`chain_free_matching`) between **Search readiness** and **Offer → instruct**, SLA 7 days, evidence `chain_free_position`.
4. Select the **`au`** stub. Confirm `chain_free_inventory` and `hard_client_sla` are **off**. The stub still has no matching stage.
5. `chain_free_inventory` being on means the buyer overlay exists as pack data. It does **not** mean we hold seller stock or that any date is guaranteed. Hard client SLA is Plan 9 — published targets with carve-outs, not a completion guarantee.

## 2. A new paid case carries the matching stage

1. `/cockpit/cases` → **Bloggs return (paid)** (re-seeded). Confirm the timeline includes **Chain-free position** after **Search readiness**.
2. Open **Smith DIY journey**. The stage is visible on the map (`freeVisible`) but there is no self-advance and no certification checklist on the portal. Free stays `NOT_ASSESSED` because paid orchestration is a criterion.
3. Entry context **UK resident — speed seeker** uses the same stage title and the same evidence kind. No FX or vehicle steps appear on it.

## 3. Scorecards unlock the badge — they do not print stars

1. Still as advisor on **Bloggs return (paid)**. Scroll to **Chain-free certification**.
2. Badge starts **IN PROGRESS** once the case is paid. Checklist shows three gates: paid tier (met), partner participation (open until a warm intro / evidence lands), evidence complete (open until `source_of_funds`, `dip_aip` and `buyer_ready` are accepted).
3. **Certify chain-free** is disabled or refused until every gate is green. Typing a short reason fails with the domain message.
4. Drive the ledger, using the existing Plan 1–3 motions:
   - Accept `profile_complete` → advance.
   - Accept `source_of_funds` (and `fx_plan` on this returner case) → advance.
   - Warm-intro Priya Nair on `mortgage_path`. As `mortgage@example.com`, submit `dip_aip`. As advisor, accept it.
   - Advance through move + search until `buyer_ready` is accepted.
5. Checklist: partner participation met (referral + `EVIDENCE_SUBMITTED` or a WATCH/STRONG scorecard), evidence complete met. Status is still **IN PROGRESS** — rules never auto-certify.
6. **Certify chain-free** with reason `Ledger gates green; no onward chain.` Badge becomes **CERTIFIED**. The event is on the case ledger.

## 4. The client sees copy, not numbers

1. Sign in as **`client@example.com`** → the Bloggs case.
2. A card reads **Certified chain-free buyer** and says the status is not a completion date.
3. Confirm what is absent: no quality score, no participation rate, no partner SLA days, no criterion checklist, no playbook prose, no promised date.

## 5. Ineligible and reset stay on the cockpit

1. Back as advisor. **Mark ineligible** with reason `Household still selling a flat.` Badge becomes **INELIGIBLE**. The portal card disappears.
2. **Reset certification** with reason `Sale completed; re-check the ledger.` Status returns to **IN PROGRESS** (rules still green). Certify again if you want the badge back.

## 6. Marketing may say chain-free

1. Sign out → `/`.
2. The homepage has a short **Beachhead, not the product** section. It names chain-free buyers and paid orchestration, and it does not mention listings, a seller introduction, or a guarantee.
3. `/start` and `/pricing` are unchanged. This is not a new funnel.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `ChainFreeCertification` derived from ledger + scorecard signals; advisor override events; `chain_free_matching` stage + playbook on `ew`; cockpit checklist; portal status copy; `chain_free_inventory: true` on `ew` |
| **Stubbed** | Nothing new. Partner adapters and the inbound webhook stay Plan 5 stubs. |
| **Absent** | Seller listings / inventory, private seller–buyer introductions, agent or developer lead fees, Rightmove/Zoopla, marketing guarantees, AU/US corridor content, document vault, open marketplace, seller login / inventory product |

---

## Automated verification

```bash
npm test -- tests/domain/chain-free.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/ew-playbook.test.ts tests/server/chain-free-policy.test.ts tests/server/chain-free-actions.test.ts tests/server/chain-free-portal.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
