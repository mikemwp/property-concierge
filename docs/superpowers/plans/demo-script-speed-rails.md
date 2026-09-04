# Partner speed rails demo script

Founder validation script for the **deep integrations behind a clean port, stubbed in v1** thesis: paid E&W cases get integration tickets, partners work their own lane, adapters simulate vendor turnaround deterministically, and inbound updates can submit evidence — but the advisor still owns accept, advance and re-route.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`; `PARTNER_WEBHOOK_SECRET` set in `.env` (copy from `.env.example` — `dev-partner-secret`); all logins use password `password`.

---

## 1. The rail is a flag, and it is off in markets we have not built

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew · England & Wales`**. Under **Modules**, confirm `fx_deposit` and `partner_speed_rails` are **on**; `chain_free_inventory` and `hard_client_sla` are **off**.
3. Select the **`au`** stub pack. Confirm `partner_speed_rails` is **off**, and `chain_free_inventory` and `hard_client_sla` are **off** here too.
4. Speed rails being on for `ew` means adapter plumbing exists — not that any date is guaranteed to a client.

## 2. A ticket opens

1. `/cockpit/cases` → **Bloggs return (paid)**.
2. Drive the case to a partner-owned stage:
   - As **`client@example.com`**: submit `profile_complete`.
   - As advisor: accept → **Advance stage**.
   - As client: submit `source_of_funds` and `fx_plan`.
   - As advisor: accept both → **Advance stage**.
   - Focus is now **`mortgage_path`**, owner **mortgage adviser**.
3. **Warm intro** → choose `mortgage partner — Priya Nair (Northstar Mortgages)` → **Request warm intro**.
4. Scroll to **Partner integration**. One ticket appears:
   - Role: **mortgage adviser**
   - Adapter: **`stub-mortgage`**
   - Status badge: **Unacknowledged**
   - Copy the **Ticket** id from the panel — you will need it for section 5.

## 3. The partner works their own lane

1. Sign in as **`mortgage@example.com`** → open the Bloggs case.
2. Confirm the mini-view shows case context (pack name, stage title, SLA days), the **Required evidence** inbox (`dip_aip`), and **Integration actions**.
3. Click **Acknowledge case**.
4. **Report milestone** → select **Decision in principle submitted** → submit.
5. Sign in as advisor → **Bloggs return (paid)** → **Partner integration**:
   - Acknowledgement latency is shown (days between ticket open and acknowledge).
   - **Milestones** lists `Decision in principle submitted`.
6. Note what the partner **cannot** see on this page: no playbook prose, no panel quality scores, no referral fee status, and no other partner role's ticket.

## 4. The adapter simulates turnaround, deterministically

1. Still as advisor on the Bloggs case, click **Sync partner status** on the mortgage ticket.
2. Note the **Last status** field. Click **Sync partner status** again immediately — the status does **not** jitter; it is a pure function of days-in-stage and the mortgage profile's three-day cadence.
3. Automated proof: `tests/lib/partner-adapters.test.ts` — the mortgage ladder walks `RECEIVED → IN_PROGRESS → BLOCKED_ON_CLIENT → EVIDENCE_READY` as simulated days pass, and repeating the same day returns the same status.

## 5. An update arrives from outside the app

Copy the case id from the cockpit URL (`/cockpit/cases/<caseId>`) and the ticket id from section 2.

**Valid update** — replace `<caseId>` and `<ticketId>` with your values:

    curl -X POST http://localhost:3000/api/partner-updates \
      -H "content-type: application/json" \
      -H "x-partner-signature: dev-partner-secret" \
      -d '{"caseId":"<caseId>","ticketId":"<ticketId>","role":"MORTGAGE_PARTNER","status":"EVIDENCE_READY"}'

    Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/partner-updates" `
      -Headers @{ "x-partner-signature" = "dev-partner-secret" } `
      -ContentType "application/json" `
      -Body '{"caseId":"<caseId>","ticketId":"<ticketId>","role":"MORTGAGE_PARTNER","status":"EVIDENCE_READY"}'

Expected response: `{"ok":true,"applied":"SUBMIT_EVIDENCE"}`. On the cockpit case page, `dip_aip` now sits in the advisor's awaiting-acceptance list.

**Wrong secret** (401):

    curl -X POST http://localhost:3000/api/partner-updates \
      -H "content-type: application/json" \
      -H "x-partner-signature: wrong-secret" \
      -d '{"caseId":"<caseId>","ticketId":"<ticketId>","role":"MORTGAGE_PARTNER","status":"EVIDENCE_READY"}'

**Malformed body** (400) — missing `ticketId`:

    curl -X POST http://localhost:3000/api/partner-updates \
      -H "content-type: application/json" \
      -H "x-partner-signature: dev-partner-secret" \
      -d '{"caseId":"<caseId>","status":"EVIDENCE_READY"}'

**Unknown ticket** (409):

    curl -X POST http://localhost:3000/api/partner-updates \
      -H "content-type: application/json" \
      -H "x-partner-signature: dev-partner-secret" \
      -d '{"caseId":"<caseId>","ticketId":"not-a-real-ticket","role":"MORTGAGE_PARTNER","status":"RECEIVED"}'

## 6. The advisor still owns the case

1. After the inbound update in section 5, confirm the focus stage is still **`mortgage_path`** with status **ACTIVE** — the rail submitted evidence but did not accept or advance.
2. **Accept** `dip_aip`, then **Advance stage** manually.
3. The stage moves to the next owner only because the advisor acted. Cross-reference: `tests/server/adapter-authority.test.ts` — adapters never reference `acceptEvidence`, `advanceStage`, `blockStage`, `resumeStage`, `reroutePartner` or `createReferral`.

## 7. Rails are paid and market-scoped

1. Sign in as advisor → **Smith DIY journey** (`FREE_DIY`, entry `UK_RESIDENT_SPEED`).
2. Confirm there is **no Partner integration** panel and no warm-intro-driven ticket surface.
3. POST an inbound update for this case's id (any ticket id) — the endpoint returns **409** (rails off for free tier). Automated proof: `tests/server/speed-rails-policy.test.ts`.

---

## What is real and what is stubbed

| Layer | Status |
|-------|--------|
| **Real** | The `PartnerPort` interface, ledger events (`PARTNER_CASE_ACKNOWLEDGED`, `PARTNER_STATUS_SYNCED`, `PARTNER_MILESTONE_REPORTED`, `PARTNER_UPDATE_REJECTED`), inbound status mapping, the `canUseSpeedRails` / `assertSpeedRails` gate, partner mini-view and advisor integration panel |
| **Stubbed** | The three role-specific adapters' turnaround simulation (`stub-mortgage`, `stub-conveyancer`, `stub-move`) and the loopback webhook at `/api/partner-updates` |
| **Absent** | Every live vendor API, OAuth, chain-free inventory, hard client SLAs, and any client-facing guaranteed date |

---

## Automated verification

```bash
npm test -- tests/lib/partner-adapters.test.ts tests/server/adapter-authority.test.ts tests/server/partner-webhook.test.ts tests/server/speed-rails-policy.test.ts tests/server/warm-intro.test.ts tests/server/warm-intro-action.test.ts tests/server/partner-actions.test.ts tests/server/scorecards.test.ts tests/domain/engine-country-agnostic.test.ts
```
