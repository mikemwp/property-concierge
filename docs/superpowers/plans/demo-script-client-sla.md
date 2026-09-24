# Client SLA overlay demo script

Founder validation script for the **published target timelines, not a marketing guarantee** thesis: after the stage ledger and partner scorecards exist, an England & Wales advisor can publish a target completion date with legal carve-outs; the client sees that date only when published; marketing may say target / working toward / subject to carve-outs; we still do not promise a completion day.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The module is on for ew, and it is still not a guarantee

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew · England & Wales`**. Under **Modules**, confirm `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla` and `case_threads` are **on**. `corridor_inbound` and `corridor_outbound` stay **off**.
3. Select the **`au`** stub. Confirm `hard_client_sla` is **off**. Repeat for `au_uk`, `uk_au`, `us_uk` and `uk_us`.
4. `hard_client_sla` being on means the publish overlay exists as pack data. It does **not** mean any date is guaranteed.

## 2. Free DIY never sees the operating IP

1. `/cockpit/cases` → **Smith DIY journey**.
2. Scroll to **Published target timeline**. Badge is **UNPUBLISHED**. Paid-tier criterion is **Open**. There is no publish form (or Publish is refused).
3. Sign in as **`client@example.com`** → Smith. There is no target date card and no carve-out list.

## 3. Scorecards and the ledger unlock publish — they do not print a promise

1. Back as advisor on **Bloggs return (paid)**. Scroll to **Published target timeline**.
2. Badge starts **UNPUBLISHED**. Checklist: paid tier (met), partner scorecard (open until a warm intro lands on a partner with a scorecard signal), ledger started (open until any evidence is accepted).
3. **Publish target** is refused until every gate is green. A short reason fails with the domain message. A past date fails.
4. Drive the ledger, using the existing Plan 1–3 motions:
   - Accept `profile_complete` → ledger started is **Met**.
   - Warm-intro Priya Nair on `mortgage_path` (or any active panel partner whose scorecard is WATCH/STRONG). Partner scorecard is **Met**.
5. **Publish target** with date `2026-12-15` and reason `Ledger is live; partner scorecard supports a target.` Badge becomes **PUBLISHED**. The event is on the case ledger. Standard carve-outs are listed on the panel.

## 4. The client sees a target, not a guarantee

1. Sign in as **`client@example.com`** → the Bloggs case.
2. A card reads **Target completion date**, shows `2026-12-15`, says we are **working toward** that date, and lists carve-outs.
3. Confirm what is absent: the word guarantee, quality score, participation rate, criterion checklist, publish / amend / withdraw controls, playbook prose.

## 5. Amend and withdraw stay on the cockpit

1. Back as advisor. **Amend target** to `2027-01-20` with reason `Survey booked later than first assumed.` Badge becomes **AMENDED**. The portal card still shows, with the new date.
2. **Withdraw target** with reason `Client paused the purchase.` Badge becomes **WITHDRAWN**. The portal card disappears.
3. Publish again if eligibility still holds — status returns to **PUBLISHED**.

## 6. Marketing may say target, never guarantee

1. Sign out → `/`.
2. The homepage has a short **Targets, not promises** section. It names published target timelines and carve-outs, and it does not mention Rightmove, Zoopla, or a guarantee.
3. Footer disclosure still says portal dates are planning targets, subject to carve-outs, not a promise of a completion date.
4. `/start` and `/pricing` are unchanged. This is not a new funnel.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `ClientSlaCommitment` derived from ledger events + scorecard signals; advisor publish / amend / withdraw; cockpit checklist; portal target card + carve-outs; `hard_client_sla: true` on `ew` |
| **Stubbed** | Nothing new. Partner adapters and the inbound webhook stay Plan 5 stubs. |
| **Absent** | Marketing guarantees, Rightmove-style completion promises, Prisma SLA columns, a new stage, seller views, marketplace, corridor SLA, S3, FCA AR, enabling the `au` stub |

## Automated verification

```bash
npm test -- tests/domain/client-sla.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/server/client-sla-policy.test.ts tests/server/client-sla-actions.test.ts tests/server/client-sla-portal.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
