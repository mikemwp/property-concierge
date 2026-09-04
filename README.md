# Property Concierge

UK property purchase orchestration portal — England & Wales (market pack `ew`).

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
```

## Scripts

- `npm run dev` — start Next.js dev server
- `npm test` — run Vitest test suite
- `npm run db:push` — push Prisma schema to SQLite
- `npm run db:seed` — seed database (stub)

## Stack

Next.js 15, React 19, Vitest, Prisma (SQLite)
