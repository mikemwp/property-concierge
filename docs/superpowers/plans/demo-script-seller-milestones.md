# Seller milestone views demo script

Founder validation script for spec §9 Phase 4 **seller views** as a buyer-side overlay: England & Wales advisors can export or optionally share a read-only milestone snapshot derived from the buyer case ledger. There is still no seller login, inventory, or introduction.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The flag is ew-only

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla`, `case_threads` and `seller_milestone_views` are **on**.
3. Select **`au_uk`**. `seller_milestone_views` is **off**. Repeat for `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub.

## 2. Free DIY cannot share

1. Open **Smith DIY journey**. There is no Seller milestone view panel (or issue is refused).
2. Sign in as **`client@example.com`** → Smith. There is no public share control and no seller login.

## 3. Paid advisor: export without a link

1. As advisor, open **Bloggs return (paid)**.
2. **Seller milestone view** lists every stage as not started / in progress / done from the ledger.
3. The export textarea contains the buyer-only disclaimer and those rows. Copy it. There is still no share path until you issue one.

## 4. Optional share link, then revoke

1. Issue with reason `Agent asked for a progress snapshot`.
2. The live path `/share/milestones/<caseId>/<signature>` appears.
3. Open that URL in a private window — no login. Headline is **Buyer progress on this purchase**. The page says we act for the buyer only and that this is not a listing or an introduction.
4. Revoke with reason `Offer fell through; stop sharing`. Refresh the private window — 404.
5. A wrong signature also 404s.

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | ew-only flag; ledger-derived rows; advisor export copy; HMAC share; revoke event; public read-only page |
| **Stubbed** | Share secret falls back to `dev-seller-view-secret` when `SELLER_VIEW_SHARE_SECRET` is unset |
| **Absent** | Seller login, seller role, inventory, listing feed, private introduction, corridor flag, Prisma share table, S3 |

## Automated verification

```bash
npm test -- tests/domain/seller-milestones.test.ts tests/server/seller-milestone-policy.test.ts tests/server/seller-milestone-actions.test.ts tests/server/seller-milestone-ui.test.ts tests/server/seller-milestone-share.test.ts tests/domain/market-pack-flags.test.ts tests/content/marketing-copy.test.ts tests/domain/engine-country-agnostic.test.ts
```
