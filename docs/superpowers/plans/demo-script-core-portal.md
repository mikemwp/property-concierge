# Core portal demo script

Founder validation script for the **rigid stage ledger** thesis: one focus owner, evidence-gated advance, advisor orchestration, partner submit-only mini-view.

**Prerequisites:** `npm run db:seed` and `npm run dev` running.

---

## 1. Client sees who owns the stage (paid case)

1. Go to `/login`, sign in as **`client@example.com`** / `password`.
2. You land on `/portal` — two cases listed.
3. Open **Bloggs return (paid)**.
4. Confirm:
   - Timeline shows `purchase_profile` as **ACTIVE**, owned by **CLIENT**.
   - **Current owner** banner names the stage and owner.
   - **Submit evidence** form offers `profile_complete`.

## 2. Client submits; advisor accepts and advances

1. Click **Submit** on `profile_complete`.
2. Sign out; sign in as **`advisor@example.com`** / `password`.
3. Open `/cockpit/cases` → **Bloggs return (paid)**.
4. Confirm playbook text appears (cockpit-only).
5. **Accept** `profile_complete` → **Advance stage**.
6. Focus moves to **money_readiness** (CLIENT-owned).

## 3. Warm intro (paid only)

1. Still on the paid case in cockpit, scroll to **Warm intro**.
2. Select **MORTGAGE_PARTNER**, add a note, submit.
3. Confirm **Warm intro history** shows `WARM_INTRO_REQUESTED` with payload.

## 4. Advance to partner-owned stage

1. On **money_readiness**, client must submit `source_of_funds` + `fx_plan` (returner overseas pack).
   - Quick path: sign in as client, submit both kinds from portal **or** advisor accepts if already attested in a prior session.
2. As advisor: accept all money evidence → **Advance stage**.
3. Focus is now **mortgage_path**, owner **MORTGAGE_PARTNER**.

## 5. Partner mini-view (submit only, no advance)

1. Sign out; sign in as **`mortgage@example.com`** / `password`.
2. `/partner` lists **Bloggs return (paid)** with tag `mortgage path`.
3. Open the case.
4. Confirm:
   - Banner shows MORTGAGE_PARTNER owns the stage.
   - **Submit evidence** offers `dip_aip`.
   - No advance / block controls (advisor-only).
5. Submit `dip_aip`.
6. Message: awaiting advisor acceptance.

## 6. Advisor closes the loop

1. Sign in as advisor → open the same case.
2. **Accept** `dip_aip` → **Advance stage**.
3. Sign in as client → portal shows new focus owner (move logistics / next stage).

## 7. Free DIY contrast (same app, different rules)

1. Sign in as **`client@example.com`**.
2. Open **Smith DIY journey** (free).
3. Confirm:
   - `purchase_profile` self-attest works.
   - `money_readiness` shows **upgrade callout** — client cannot clear the gate alone.
4. Sign in as advisor → open free case.
5. Confirm **Warm intro** is disabled.
6. Sign in as **`mortgage@example.com`** → `/partner` shows **no assigned cases** (focus still client-owned).

---

## Thesis checklist

| Claim | Where to verify |
|-------|-----------------|
| Exactly one focus owner | Current owner banner on portal / partner / cockpit |
| Evidence before advance | Advance disabled until all kinds accepted |
| Advisor orchestrates | Accept + advance + block only in cockpit |
| Partner is lightweight | Partner route: submit evidence only |
| Free is a funnel | Upgrade callout + no warm intro on free tier |
| Ledger is source of truth | Stage events after each action (cockpit history) |

---

## Automated verification

```bash
npm test
npm run build
```
