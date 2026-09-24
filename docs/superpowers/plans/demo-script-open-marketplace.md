# Open marketplace stub demo script

Founder validation script for spec §2 / §7: the platform can *name* an open partner marketplace as a future module without shipping one. Every pack stays a curated panel. There is no third-party browse UI.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`.

---

## 1. The flag exists and is off

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Under **Modules**, `open_marketplace` is **off**. Shipped ew-only modules stay **on**.
3. The **Partner policy** card reads **curated panel** with note **open marketplace off — architecture stub only**.
4. Repeat for `au_uk`, `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub. Policy is curated on every pack.

## 2. There is nothing to browse

1. Visit `/marketplace` — 404.
2. Visit `/partners/browse` if you try it — 404.
3. `/cockpit/panel` is still the advisor-managed curated panel. There is no partner self-signup.

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `open_marketplace` on `MarketModuleKey`; `marketplacePolicy()`; inspector card |
| **Stubbed** | The open state of the helper (`flags.open_marketplace === true`) is tested with a fixture only |
| **Absent** | Browse UI, self-signup, enabling the flag on any pack, third-party stock |

## Automated verification

```bash
npm test -- tests/domain/open-marketplace-stub.test.ts tests/domain/market-pack-flags.test.ts tests/domain/market-pack-inspector.test.ts tests/server/marketplace-policy-ui.test.ts tests/content/marketing-copy.test.ts
```
