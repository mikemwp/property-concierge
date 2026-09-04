# Partner network demo script

Founder validation script for the **curated panel + ledger scorecards + disclosed referrals** thesis: partners are scored from the same stage ledger the client sees, every intro is disclosed, and non-response has a visible consequence (nudge → scorecard hit → re-route).

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The panel is curated, not a marketplace

1. Sign in as **`advisor@example.com`** → `/cockpit/panel`.
2. Confirm five rows: Priya Nair (mortgage), Ravi Patel (mortgage, **inactive**), Tom Ashby and Lena Okoro (conveyancers), Dan Whitfield (move).
3. Every rating reads **no data** — the ledger has not yet attributed a partner-owned stage.
4. Click **Demote** on Lena → she greys out; **Reinstate** restores her. There is no partner self-signup anywhere.

## 2. A warm intro names a partner and records a disclosure

1. `/cockpit/cases` → **Bloggs return (paid)**.
2. **Warm intro** → choose `mortgage partner — Priya Nair (Northstar Mortgages)` → note → **Request warm intro**.
3. Confirm **Referrals & disclosure** shows Priya, source `warm intro`, fee `expected`, and the disclosure text containing "introducer only" and "do not give mortgage advice".
4. **Partner history** shows `warm intro requested` with `panelMemberName` in the payload.

## 3. The client sees the disclosure (and nothing else)

1. Sign in as **`client@example.com`** → **Bloggs return (paid)**.
2. **Your introduced partners** shows Priya with the disclosure text and date.
3. Confirm the page shows no SLA days, no scores, no fee status.

## 4. Drive the case to the partner-owned stage

1. As client: submit `profile_complete`. As advisor: accept → **Advance stage**.
2. As client: submit `source_of_funds` and `fx_plan`. As advisor: accept both → **Advance stage**.
3. Focus is now **mortgage_path**, owner **MORTGAGE_PARTNER**. **Partner ops** appears on the cockpit case page naming Priya.

## 5. Partner participation earns credit

1. Sign in as **`mortgage@example.com`** (Priya's login) → `/partner` lists the Bloggs case → open → submit `dip_aip`.
2. Sign in as advisor → `/cockpit/panel`: Priya shows **Stages 1**, **Portal 100%**.

## 6. Non-response: nudge → scorecard hit → re-route

1. On the cockpit case page, click **Nudge partner** → **Partner history** shows `partner nudged`; `/cockpit/panel` shows **Nudges 1** and the score dips.
2. `/cockpit/panel` → **Reinstate** Ravi Patel.
3. Back on the case → **Re-route to Ravi Patel (Ledger Mortgages)** → **Re-route**.
4. **Referrals & disclosure**: Priya's referral is marked `superseded`; a new `reroute` referral exists for Ravi. **Partner history** shows `partner rerouted`.
5. Sign in as **`mortgage@example.com`** → `/partner` no longer lists the Bloggs case (Priya was detached; Ravi has no portal login).
6. Sign in as client → **Your introduced partners** now shows Ravi's disclosure only.

## 7. Fee status is recorded, never paid

1. As advisor, on Ravi's referral set fee status to **received** → Save.
2. Try **waived** → error: `Cannot move fee status from RECEIVED to WAIVED`.

## 8. Free DIY gets a directory, not an intro

1. Sign in as client → **Smith DIY journey**.
2. **Partner directory** lists names grouped by role with **Upgrade for a warm introduction**. No SLA, no scores.
3. Sign in as advisor → open the free case → **Re-route** reads "paid Done-With-You control"; **Warm intro** is disabled.
4. **Record referral** (advisor mark, e.g. Tom Ashby, fee `expected`) still works — free self-selection is still disclosed. Sign in as client → the disclosure appears above the directory.

---

## Thesis checklist

| Claim | Where to verify |
|-------|-----------------|
| Curated panel, advisor-managed | `/cockpit/panel` demote / reinstate; no partner signup |
| Scorecards derived from the ledger | Panel metrics change only via stage events (submit, nudge, advance) |
| SLA breach feeds the scorecard | Miss / breach columns use the partner SLA with the case escalation rules |
| Every intro disclosed | Referral row + client **Your introduced partners** |
| Mortgage = introducer only | Disclosure text on any mortgage referral |
| Non-response has consequences | Nudge → nudges count; re-route → superseded referral + participant swap |
| Fees recorded, not paid | Fee status transitions only; no payout UI |
| Free = directory, paid = named intro | Free case shows directory; paid case shows named referral |
| No partner IP in client/partner surfaces | `rg -n "slaDays|qualityScore|missRate" src/app/portal src/app/partner` → empty |

---

## Automated verification

```bash
npm test
npm run build
```
