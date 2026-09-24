# Case thread demo script

Founder validation script for spec §8: a case-scoped, append-only human thread with role ACL. Messages live in Prisma (`CaseMessage`). There is no websocket. The module is on for paid England & Wales only.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The flag is ew-only, and free stays threadless

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla`, `case_threads` **on**. `corridor_inbound`, `corridor_outbound` **off**.
3. Select **`au_uk`**. `case_threads` is **off**. Repeat for `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub.
4. Open **Smith DIY journey** in the cockpit. There is no **Case thread** panel.
5. Sign out. Sign in as **`client@example.com`** → Smith. No **Case thread** panel. Free attestation is unchanged.

## 2. Paid client reads the welcome post and can reply

1. Still as the client, open **Bloggs return (paid)** (`ew`, `PAID_DWY`).
2. Below the document vault, **Case thread** lists the seeded advisor welcome: *Welcome to the Bloggs case thread...*
3. Copy under the heading says the thread is append-only, that you refresh to see new posts, and that this is not a live chat.
4. Type `Here is the household contact window.` → **Post**. The message appears with role `CLIENT` after the page revalidates.
5. There is no edit control and no delete control.

## 3. Advisor stays in the same thread

1. Sign in as **`advisor@example.com`** → Bloggs case.
2. **Case thread** shows both posts, oldest first, including the client's reply.
3. Post `I will introduce Priya and stay in this thread.`
4. Confirm the portal still shows all three messages after a refresh. The stage ledger is unchanged — no new evidence row, no new stage event from the post.

## 4. Assigned partner can post; the empty-stage view still has the thread

1. Advance Bloggs to `mortgage_path` (accept money-readiness evidence, including `fx_plan` on this overseas case, then advance twice) and warm-intro Priya if needed.
2. Sign in as **`mortgage@example.com`**. Open the Bloggs case.
3. If focus is `mortgage_path`, the thread sits under the vault. Post `DIP pack requested; I will update here.`
4. As advisor, accept `dip_aip` and **Advance stage** so focus leaves the mortgage partner.
5. Sign back in as **`mortgage@example.com`**. The page says **No assigned stage**. The **Case thread** is still there with every previous post. Post `Still watching the file from here.`
6. An unassigned partner account that is not a participant cannot open the case (`notFound` via `loadCaseForUser`).

## 5. Corridor cases stay threadless

1. Advisor opens **Chen AU→UK return (paid)** (`au_uk`).
2. There is no **Case thread** panel. Client and partner views of Chen are also threadless.
3. That is fail-closed: corridor packs have not proved the thread.

## 6. Marketing names the audit trail, not a live chat

1. Sign out → `/`.
2. The homepage has a short **One thread, not six inboxes** section. It names the append-only thread and a refresh, and it does not say live chat, websocket, or guarantee.
3. `/pricing` still withholds the case thread on the free card.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `CaseMessage` rows; append-only insert + list; role ACL; `case_threads: true` on `ew`; ThreadPanel on portal / cockpit / partner (including partner empty-stage); server-action post + `revalidatePath` |
| **Stubbed** | Nothing new. Partner adapters stay Plan 5 stubs. |
| **Absent** | WebSockets / SSE / push, message edit or delete, corridor threads, @mentions, in-thread attachments, seller views, open marketplace, hard-guarantee copy changes |

## Automated verification

```bash
npm test -- tests/domain/threads.test.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/server/thread-schema.test.ts tests/server/thread-store.test.ts tests/server/thread-policy.test.ts tests/server/thread-actions.test.ts tests/server/thread-ui.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
