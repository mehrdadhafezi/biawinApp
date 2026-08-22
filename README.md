# Biawin App

Monorepo for بیاوین (Biawin) — a Persian/RTL installment-purchase & credit membership club app.
See [`docs/01-prototype-analysis.md`](docs/01-prototype-analysis.md) for the full product/UX analysis this scaffold is based on.

## Structure

```
biawin-app/
├── apps/
│   ├── web/       Next.js 16 (App Router, TypeScript, Tailwind v4)
│   └── mobile/    Expo (React Native, expo-router, TypeScript)
├── backend/       NestJS + Prisma + PostgreSQL API
├── packages/
│   ├── ui/        Shared design tokens (colors, radius, shadows, font) — see docs §3
│   ├── config/    Shared tsconfig base + eslint base config
│   └── types/     Shared domain types (User, Membership, Catalog, Order, Wallet, Reward, Mission, Advisor, ...)
└── docs/          Architecture & product documentation
```

## Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io) ≥ 10 (`corepack enable` or `npm i -g pnpm`)
- PostgreSQL (for `backend`) — copy `backend/.env.example` to `backend/.env` and adjust `DATABASE_URL`

## Getting started

```bash
pnpm install
```

Run everything (web + backend, in dev/watch mode) via Turborepo:

```bash
pnpm dev
```

Or run a single app:

```bash
pnpm --filter @biawin/web dev
pnpm --filter @biawin/backend dev
pnpm --filter @biawin/mobile dev
```

Backend database setup (after `.env` is configured):

```bash
pnpm --filter @biawin/backend prisma:generate
pnpm --filter @biawin/backend prisma:migrate
```

## Status

This is a **structural scaffold**: monorepo tooling, one app per target platform, shared packages, and a minimal Prisma model are wired up and build-ready. Actual screens, API endpoints, and the full database schema are implemented in later steps of the architecture plan (see `docs/`).
