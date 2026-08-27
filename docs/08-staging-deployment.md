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
  web        127.0.0.1:3001 -> 3000  (Next.js, `next build`+`next start`)
  admin      127.0.0.1:3002 -> 3000  (Next.js Admin Portal, same build approach — Stage 5.22)

LiteSpeed (WHM/cPanel, existing on host):
  staging.biawin.ir        --reverse proxy-->  127.0.0.1:3001
  api-staging.biawin.ir    --reverse proxy-->  127.0.0.1:4001
  admin-staging.biawin.ir  --reverse proxy-->  127.0.0.1:3002   (Stage 5.22 — vhost/DNS/SSL not yet created; see docs/10-release-process.md "One-time server setup, Stage 5.22 addendum")
```

Every Biawin container binds to `127.0.0.1` only — nothing is reachable from
outside the host except through LiteSpeed's reverse proxy + TLS termination.

### Why these ports

The host already has PostgreSQL on `5432`, a Gateway on `8080`, and another
Next.js app on `3000` (Beauty Platform / Romina). Biawin staging deliberately
avoids every occupied port: `3001`, `3002`, `4001`, `5433`, `6380`, `9010`, `9011`.

### Server-side layout

```
/srv/biawin-staging/          <- git clone of this repo, main branch
  deploy/staging/
    Dockerfile.backend
    Dockerfile.web
    Dockerfile.admin           <- Stage 5.22
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
| `CORS_ORIGINS` | `https://staging.biawin.ir,https://admin-staging.biawin.ir` | Both staging frontend origins — Customer App and Admin Portal (Stage 5.22) |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.biawin.ir/api/v1` | Customer frontend calls the public staging API domain (including the `/api/v1` prefix the backend actually serves — see `backend/src/main.ts`), never an internal Docker hostname |
| `NEXT_PUBLIC_ADMIN_API_URL` | `https://api-staging.biawin.ir/api/v1` | Same rule, for the Admin Portal build (Stage 5.22) — same backend, `/admin/**` routes live on it already |
| `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET` | real random secrets, distinct from `JWT_*` | **Required since Stage 5.16** — the backend fails to boot without these (no default). Missing from this environment until Stage 5.22 found the gap. |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | real staging admin credentials | Optional in the schema but required in practice — without these, `prisma db seed` skips creating a `SUPER_ADMIN` and Admin Portal login is impossible on this environment. |
| `PUBLIC_API_ORIGIN` | `https://api-staging.biawin.ir` | **Required since Stage 5.21** — the code default (`localhost:4000`) is only correct for local dev; every Home CMS image URL is built from this value. |

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

### MinIO/S3 credential consistency

**`.env.staging` does not (and must not) set `STORAGE_ACCESS_KEY` /
`STORAGE_SECRET_KEY` at all.** `docker-compose.staging.yml`'s `backend`
service derives both directly from `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`
(the same two variables `minio` and `minio-init` already use) via its own
`environment:` block, which Compose always resolves AFTER (and therefore
overriding) `env_file:` — so even a stale or mismatched
`STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` sitting in `.env.staging` is
silently ignored.

This exists because of a real failure on staging (Stage 5.22): an earlier
version of `.env.staging.example` listed `STORAGE_SECRET_KEY` and
`MINIO_ROOT_PASSWORD` as two textually-separate `REPLACE_WITH_RANDOM_SECRET`
placeholders. Generating a random secret "for each" (as instructed,
literally) produced two different values — MinIO's actual root password
and what the backend tried to authenticate with — and the Home media
migration failed its very first upload with `SignatureDoesNotMatch` / HTTP
403. There is no separate non-root MinIO user anywhere in this stack
(`minio-init`'s entrypoint only ever runs `mc mb` + `mc anonymous set
download`, never `mc admin user add`), so the backend has always been
architecturally required to authenticate as MinIO's own root user — the fix
just makes that a structural guarantee instead of two independently-typed
values that happened to need to agree.

**If this ever recurs anyway** (e.g. object storage credentials really were
rotated and something's still using an old value), `seed-home-media.ts`
detects an auth-shaped failure (`SignatureDoesNotMatch`, `AccessDenied`,
`InvalidAccessKeyId`, or a bare HTTP 403) on its very first upload and fails
with an explicit message pointing back here, rather than a raw AWS SDK
stack trace repeated across all 17 files.

One thing this fix does **not** need to touch, and is worth knowing
regardless: MinIO reads `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` from its
environment on every container start and uses them as the live root
credentials — unlike Postgres, which only applies `POSTGRES_PASSWORD` at
first-init of an empty data directory and ignores it on every restart
after. So MinIO's root credentials are not "baked into" the persistent
`biawin_staging_minio_data` volume the way Postgres's are — but that's not
what this fix relies on; it only changes what the *backend* sends, never
MinIO's own credentials, so the existing volume is never touched or at risk
here.

First deploy runs, in order, inside the freshly built backend image (never on
the host directly):

```
prisma migrate deploy
node dist/prisma/seed.js
```

(Not `prisma db seed` — see "Runtime image packaging" below for why.)

The staging seed creates the same baseline data as local dev (categories,
services, membership plans, rewards) plus is safe to re-run — `deploy.sh`
runs this every deploy, and `prisma migrate deploy` is a no-op when there is
nothing new to apply.

## Runtime image packaging — `backend/dist` vs `backend/src`

**The runtime image intentionally does NOT copy `backend/src`** — only
`backend/dist` (the compiled output), `backend/prisma`, `backend/package.json`,
and the copied `apps/web/public/home` assets (see `Dockerfile.backend`). This
is deliberate, not an oversight: `backend/src` is unconstrained application
source that keeps growing; shipping it into a "runtime" image would blur the
line between "compiled artifact" and "buildable source tree" for no benefit —
the compiled app (`CMD ["node", "backend/dist/src/main.js"]`) already never
touches it.

This bit real staging on first use (Stage 5.22): `prisma db seed` shells out
to `ts-node` against `prisma/seed.ts` **source** (per `prisma.config.ts`,
kept that way deliberately for local dev's fast edit-loop), and that source
imports `../src/modules/admin-auth/password-hash.util` — a file that
genuinely doesn't exist in the runtime image. The fix: `deploy.sh` runs the
seed via the **already-compiled** `node dist/prisma/seed.js` instead
(`nest build`'s default tsc scope already includes `backend/prisma/*.ts`
alongside `backend/src/**` — the compiled output was there all along, just
never invoked). Same for the Stage 5.21 Home media migration:
`node dist/prisma/seed-home-media.js`, not `ts-node ... prisma/seed-home-media.ts`
(that script bootstraps the entire NestJS `AppModule` graph via
`NestFactory.createApplicationContext` — by design, per its own doc comment,
it must go through the real `MediaService`, so this one script genuinely
cannot be made independent of the compiled app; running it against `dist/`
rather than `src/` is what makes that possible without shipping `src/` at
all). Local dev's own `pnpm --filter @biawin/backend prisma:seed` /
`seed:home-media` scripts are untouched — they still run via `ts-node`
against source, since local dev always has `backend/src` on disk.

One subtlety this fix required: `seed-home-media.ts` resolved the static
asset directory via `join(__dirname, '..', '..', ...)`, which is only
correct relative to `backend/prisma/` (ts-node, local dev) — the compiled
`backend/dist/prisma/` sits one directory deeper, so the same computation
against `dist/` silently pointed one level too high. Fixed by anchoring on
`process.cwd()` instead (always `backend/`, in every real invocation path)
rather than `__dirname` (which differs between the two).

A second, unrelated bug turned up while actually verifying the fix (via
`verify-runtime-image.sh`, below): `seed-home-media.ts` finished its work,
logged `Done.`, and then **never exited** — `app.close()` runs Nest's
lifecycle hooks but doesn't guarantee every provider's underlying handle is
released (the MinIO/S3 client's HTTP keep-alive socket stayed open), leaving
the event loop non-empty forever. Harmless when run interactively (you just
never noticed the shell prompt not coming back), fatal under
`docker compose run --rm`, which blocks until the container's own process
exits — this would have hung `deploy.sh` step 5/7 indefinitely on real
staging, a second real deployment blocker this same investigation caught.
Fixed with an explicit `process.exit(0)` after `app.close()` resolves.

**Verification**: `deploy/staging/verify-runtime-image.sh` builds the real
`Dockerfile.backend` image and runs `prisma migrate deploy` plus both
seed/media-migration commands against a throwaway, isolated
Postgres/Redis/MinIO stack (`docker-compose.verify.yml` — no host ports
published, safe to run anywhere, including alongside a live staging
deployment on the same host). A normal `pnpm typecheck`/`build` does **not**
catch this class of bug — compiling successfully says nothing about which
compiled files a specific Dockerfile stage actually `COPY`s. Run this
script before every deploy that touches `Dockerfile.backend`, `deploy.sh`,
`prisma/seed.ts`, `prisma/seed-home-media.ts`, or anything they import:

```bash
./deploy/staging/verify-runtime-image.sh
```

**A first version of this fix still failed on real staging** — worth
recording in full, since the failure mode is instructive. `deploy.sh` was
correctly fixed and the verification script correctly proved the compiled
commands work inside the real image, but the two scripts each had their
*own, separately hand-typed copy* of the same two command strings. A real
deploy on the server still ran the OLD (pre-fix) `prisma db seed` and
failed the identical way — not because the fix was wrong, but because of an
entirely different, much sneakier bug: `deploy.sh`'s own step 1 does
`git reset --hard origin/main`, which overwrites `deploy.sh` **on disk while
it is the file currently being executed**. On Linux, `git reset --hard`
replaces a changed file via unlink+recreate; a bash process that already
has the old file open (which the currently-running `./deploy.sh` does)
keeps reading that old inode to completion via its existing file
descriptor — so a deploy invoked from an old copy of the file kept running
every step *after* the git reset using the pre-fix logic, even though `git`
itself printed `HEAD is now at <the new commit>` moments earlier. Fixed two
ways, together:

1. **`deploy.sh` re-execs itself** immediately after the git reset
   (`DEPLOY_SH_REEXECED=1 exec bash "$REPO_DIR/deploy/staging/deploy.sh"`,
   guarded so it happens exactly once) — `exec` replaces the running
   process outright and re-opens the file fresh, so every step after that
   point is guaranteed to come from the just-updated file, regardless of
   what was originally invoked or how bash buffered it.
2. **`SEED_CMD`/`MEDIA_MIGRATION_CMD` are now single-sourced.** `deploy.sh`
   defines them once, near its own top, and both its own step 4/7 and step
   5/7 use those variables (not an inline literal). `verify-runtime-image.sh`
   `source`s `deploy.sh` itself (with `DEPLOY_SH_SOURCE_ONLY=1`, which makes
   it define those two variables and return immediately — no git, no
   Docker, nothing else runs) to read the exact same strings, instead of
   keeping its own hand-copied duplicate. Two independently-maintained
   copies of the same command drifting apart is exactly what happened —
   this makes that drift structurally impossible rather than something to
   remember to keep in sync. `verify-runtime-image.sh` also runs a cheap
   static check first (`grep`, comments excluded) that fails immediately if
   `deploy.sh` ever contains a literal `prisma db seed` or
   `ts-node ... prisma/(seed|seed-home-media).ts` in executable code again.

## Deploying

```bash
cd /srv/biawin-staging
./deploy/staging/deploy.sh
```

This does: `git fetch/checkout main` → build backend+web+admin images → bring
up infra and wait for health → run migrate+seed → Home CMS media migration →
bring up backend+web+admin → curl health checks on all three. It exits
non-zero (leaving the previous containers running) if any step fails before
the final cutover — see [10-release-process.md](10-release-process.md) for
rollback details.

## Firewall (CSF/Imunify360)

This host runs CSF (ConfigServer Firewall) with Imunify360, default-deny on
INPUT/OUTPUT. Docker's published loopback ports (`127.0.0.1:3001`,
`127.0.0.1:4001`) route through `docker-proxy`, which makes a real connection
to the container's IP on the `biawin-staging_default` bridge network
(pinned to `172.19.0.0/16` in `docker-compose.staging.yml` — see the comment
there for why this must never be allowed to float). CSF's OUTPUT policy was
blocking the host's connection to that subnet on ports 3000/4000 (the
container-internal ports), which made every external-looking request
(including LiteSpeed's future reverse proxy, and `deploy.sh`'s own health
check) fail with a connection reset — even though the containers themselves,
and container-to-container traffic, were completely healthy the whole time.

The fix is an allow-rule in `/etc/csf/csfpost.sh` (CSF's official
custom-rules hook, already used there for Beauty Platform's own Docker
subnet) scoped to `172.19.0.0/16` on ports `3000,4000` — already applied on
the server. If `docker network rm biawin-staging_default` is ever run and
the network recreated, the ports still work: they are permanently allowed to
this fixed subnet, and the subnet is now pinned so a future recreate cannot
silently drift.

**Stage 5.22 note**: the `admin` container's internal port is also `3000`
(same as `web`'s) — this existing rule already covers it, since the rule is
scoped by port number and subnet, not by container. No firewall change is
needed for `admin-staging.biawin.ir` to work once its vhost exists.

## LiteSpeed / domains

Nginx is not used — this server runs LiteSpeed Enterprise via WHM/cPanel.
Both subdomains exist as vhosts under the `biawin` cPanel account, reverse
proxying via `mod_proxy` (`ProxyPass`/`ProxyPassReverse` in cPanel's
per-vhost include hook — see [10-release-process.md](10-release-process.md)
"One-time server setup" for the exact files and why `.htaccess`-based
proxying doesn't work on this server):

- `staging.biawin.ir` → reverse proxy → `http://127.0.0.1:3001`
- `api-staging.biawin.ir` → reverse proxy → `http://127.0.0.1:4001`

Both are live on public HTTPS with a real Let's Encrypt certificate (see
10-release-process.md "One-time server setup" for the exact AutoSSL steps,
including the `www.` alias exclusion that was needed). HTTP redirects to
HTTPS (301) except for `/.well-known/acme-challenge/*`, which is excluded so
future cert renewals keep working automatically.

## CI/CD

- `.github/workflows/ci.yml` runs lint/typecheck/test/build on every push and
  PR — no server access needed.
- `.github/workflows/deploy-staging.yml` is `workflow_dispatch`-only (manual
  trigger from the Actions tab) and requires four repository secrets
  (`STAGING_SSH_HOST`, `STAGING_SSH_PORT`, `STAGING_SSH_USER`,
  `STAGING_SSH_PRIVATE_KEY`) that do not exist yet — see
  [09-git-workflow.md](09-git-workflow.md) for how to add them. Until then,
  deploys are run by hand via `deploy.sh` on the server.
