# Property Concierge

UK property purchase orchestration portal — England & Wales (market pack `ew`).

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed logins

All demo users use password **`password`**.

| Role | Email | Area |
|------|-------|------|
| Client | `client@example.com` | `/portal` |
| Advisor | `advisor@example.com` | `/cockpit` |
| Mortgage partner | `mortgage@example.com` | `/partner` |
| Conveyancer | `conveyancer@example.com` | `/partner` |
| Move partner | `move@example.com` | `/partner` |

Seeded cases:

- **Bloggs return (paid)** — `PAID_DWY`, entry `RETURNER_OVERSEAS`
- **Smith DIY journey** — `FREE_DIY`, entry `UK_RESIDENT_SPEED`

## Happy-path demo (free vs paid)

See the step-by-step click script: [`docs/superpowers/plans/demo-script-core-portal.md`](docs/superpowers/plans/demo-script-core-portal.md).

**Paid (orchestrated) thesis in 2 minutes:**

1. Client logs in → open paid case → submit profile evidence on the focus stage.
2. Advisor logs in → accept evidence → advance to `money_readiness`.
3. Advisor requests warm intro to `MORTGAGE_PARTNER` (event logged on case).
4. Advance case through money readiness to `mortgage_path` (advisor accepts + advances).
5. Mortgage partner logs in → assigned case appears → submit `dip_aip` evidence.
6. Advisor accepts partner evidence and advances — client portal shows new owner.

**Free DIY difference:**

1. Client opens free case → can self-attest early stages only; `money_readiness` shows upgrade callout.
2. Advisor cockpit: warm intro button **disabled** on free tier.
3. Partner list stays empty until a case focus stage is owned by that partner role (paid path).

## Scripts

- `npm run dev` — start Next.js dev server
- `npm test` — run Vitest test suite
- `npm run build` — production build
- `npm run db:push` — push Prisma schema to SQLite
- `npm run db:seed` — seed database with demo users and cases

## Stack

Next.js 15, React 19, Vitest, Prisma (SQLite)
