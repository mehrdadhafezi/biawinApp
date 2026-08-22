# 08 — Staging Deployment

## Architecture

Biawin staging runs on a **shared** AlmaLinux server (also hosting Beauty
Platform/Romina) inside a fully independent Docker Compose project named
`biawin-staging`. Nothing here shares a container, volume, network, or port
with anything else on that host.

```
Docker (biawin-staging project):
  postgres   127.0.0.1:5433 -> 5432
  redis      127.0.0.1:6380 -> 6379
  minio      127.0.0.1:9010 -> 9000  (S3 API)
             127.0.0.1:9011 -> 9001  (console)
  backend    127.0.0.1:4001 -> 4000  (NestJS, built image, no dev tooling running)
  web        127.0.0.1:3001 -> 3000  (Next.js standalone)

LiteSpeed (WHM/cPanel, existing on host):
  staging.biawin.ir      --reverse proxy-->  127.0.0.1:3001
  api-staging.biawin.ir  --reverse proxy-->  127.0.0.1:4001
```

Every Biawin container binds to `127.0.0.1` only — nothing is reachable from
outside the host except through LiteSpeed's reverse proxy + TLS termination.

### Why these ports

The host already has PostgreSQL on `5432`, a Gateway on `8080`, and another
Next.js app on `3000` (Beauty Platform / Romina). Biawin staging deliberately
avoids every occupied port: `3001`, `4001`, `5433`, `6380`, `9010`, `9011`.

### Server-side layout

```
/srv/biawin-staging/          <- git clone of this repo, main branch
  deploy/staging/
    Dockerfile.backend
    Dockerfile.web
    docker-compose.staging.yml
    .env.staging               <- real secrets, created on the server, gitignored
    deploy.sh
```

## Images

Both images are multi-stage (`deploy/staging/Dockerfile.backend`,
`deploy/staging/Dockerfile.web`): a `deps` stage installs pnpm dependencies
scoped to that one app (`pnpm install --filter=@biawin/<app>...`), a `build`
stage compiles it, and the final stage only runs the compiled output —
`node backend/dist/src/main.js` for the API, `node apps/web/server.js` (Next.js
standalone) for the web app. **`pnpm install` never runs at container start**;
it is baked into the image at `docker compose build` time.

`NEXT_PUBLIC_API_URL` is a Next.js client-side variable — it gets inlined into
the JS bundle at **build** time, not read at runtime. `docker-compose.staging.yml`
passes it as a `build.args` value, sourced from `.env.staging`.

## Environment

Copy `deploy/staging/.env.staging.example` to `deploy/staging/.env.staging`
**on the server only** and fill in real random secrets (`openssl rand -base64
48` for each). This file is gitignored and must never be committed.

Key staging-specific values:

| Variable | Staging value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Runs the real production code path (no dev OTP bypass from this alone) |
| `STAGING_TEST_AUTH` | `true` | Explicitly re-enables the fixed OTP test phone/code (`09121111111` / `123456`) for QA — see below |
| `SMS_PROVIDER` | `mock` | No real SMS spend on staging |
| `PAYMENT_PROVIDER` | `zibal` (no merchant ID set) | Architecture wired, no real transactions until real credentials are supplied |
| `CORS_ORIGINS` | `https://staging.biawin.ir` | Only the staging frontend origin is allowed |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.biawin.ir/api/v1` | Frontend calls the public staging API domain (including the `/api/v1` prefix the backend actually serves — see `backend/src/main.ts`), never an internal Docker hostname |

### `STAGING_TEST_AUTH` — how the bypass gate works

`backend/src/modules/auth/otp.service.ts` accepts the fixed test phone/code
when **either** `NODE_ENV === 'development'` (local dev, unconditional) **or**
`STAGING_TEST_AUTH === true` (opt-in per deployment). A real production
`.env` must set `STAGING_TEST_AUTH=false` or omit it entirely — the schema in
`backend/src/config/env.validation.ts` defaults it to `false` if unset.

## Database / Redis / MinIO

Biawin staging owns its **own** Postgres, Redis, and MinIO containers —
entirely separate from Beauty Platform's `bp_postgres` / `beauty-platform_postgres_data`.
No script here ever connects to, inspects, or touches those.

First deploy runs, in order, inside the freshly built backend image (never on
the host directly):

```
prisma migrate deploy
prisma db seed
```

The staging seed creates the same baseline data as local dev (categories,
services, membership plans, rewards) plus is safe to re-run — `deploy.sh`
runs this every deploy, and `prisma migrate deploy` is a no-op when there is
nothing new to apply.

## Deploying

```bash
cd /srv/biawin-staging
./deploy/staging/deploy.sh
```

This does: `git fetch/checkout main` → build backend+web images → bring up
infra and wait for health → run migrate+seed → bring up backend+web → curl
health checks on both. It exits non-zero (leaving the previous containers
running) if any step fails before the final cutover — see
[10-release-process.md](10-release-process.md) for rollback details.

## LiteSpeed / domains

Nginx is not used — this server runs LiteSpeed Enterprise via WHM/cPanel.
Two reverse-proxy vhosts are needed (exact WHM steps in
docs/10-release-process.md since they require manual action in the WHM UI):

- `staging.biawin.ir` → reverse proxy → `http://127.0.0.1:3001`
- `api-staging.biawin.ir` → reverse proxy → `http://127.0.0.1:4001`

Both need a Let's Encrypt (AutoSSL) certificate issued through WHM once DNS
(`staging.biawin.ir` / `api-staging.biawin.ir` → `62.204.61.18`) has
propagated.

## CI/CD

- `.github/workflows/ci.yml` runs lint/typecheck/test/build on every push and
  PR — no server access needed.
- `.github/workflows/deploy-staging.yml` is `workflow_dispatch`-only (manual
  trigger from the Actions tab) and requires four repository secrets
  (`STAGING_SSH_HOST`, `STAGING_SSH_PORT`, `STAGING_SSH_USER`,
  `STAGING_SSH_PRIVATE_KEY`) that do not exist yet — see
  [09-git-workflow.md](09-git-workflow.md) for how to add them. Until then,
  deploys are run by hand via `deploy.sh` on the server.
