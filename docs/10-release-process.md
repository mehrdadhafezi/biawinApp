# 10 — Release Process

## Environments

| Environment | URL | `NODE_ENV` | Notes |
|---|---|---|---|
| Local dev | `http://localhost:3000` / `:4000` | `development` | [05-development-guide.md](05-development-guide.md) |
| Staging | `https://staging.biawin.ir` / `https://api-staging.biawin.ir` | `production` (with `STAGING_TEST_AUTH=true`) | [08-staging-deployment.md](08-staging-deployment.md) |
| Production | `https://biawin.ir` / `https://api.biawin.ir` | `production` | Not live yet |

## One-time server setup (manual — needs a human at the WHM/cPanel UI)

These steps cannot be done over SSH/CLI and need to be performed once by
whoever has WHM access:

1. **DNS** — confirm `staging.biawin.ir` and `api-staging.biawin.ir` both
   resolve to `62.204.61.18` (already reported as done).
2. **Create two vhosts in WHM** (or via LiteSpeed WebAdmin), each a reverse
   proxy:
   - `staging.biawin.ir` → `http://127.0.0.1:3001`
   - `api-staging.biawin.ir` → `http://127.0.0.1:4001`
   In LiteSpeed's rewrite/proxy config, the equivalent rule is:
   ```
   RewriteEngine On
   RewriteRule ^/(.*)$ http://127.0.0.1:3001/$1 [P,L]
   ```
   (replace `3001` with `4001` for the API vhost).
3. **Issue SSL** for both domains via WHM's AutoSSL (Let's Encrypt) — no
   manual certificate handling needed once the vhosts exist and DNS resolves.
4. **Clone the repo** on the server:
   ```bash
   mkdir -p /srv/biawin-staging
   git clone https://github.com/mehrdadhafezi/biawinApp.git /srv/biawin-staging
   cd /srv/biawin-staging
   cp deploy/staging/.env.staging.example deploy/staging/.env.staging
   # then edit deploy/staging/.env.staging with real random secrets
   chmod +x deploy/staging/deploy.sh
   ```
5. **First deploy**, run by hand once to confirm everything works:
   ```bash
   cd /srv/biawin-staging
   ./deploy/staging/deploy.sh
   ```
6. **(Optional, once confident)** add the four `STAGING_SSH_*` GitHub secrets
   ([09-git-workflow.md](09-git-workflow.md)) so future deploys can be
   triggered from the GitHub Actions tab instead of an SSH session.

## Deploying a new staging release

```bash
ssh -p 2490 root@62.204.61.18
cd /srv/biawin-staging
./deploy/staging/deploy.sh
```

Or, once GitHub secrets are configured: **Actions → Deploy Staging → Run
workflow** on the desired branch.

`deploy.sh` is idempotent — `git reset --hard origin/main`, rebuild images,
bring up infra, run `prisma migrate deploy && prisma db seed` (both safe to
re-run), then cut over backend/web and health-check both.

## Health checks

- Backend: `curl https://api-staging.biawin.ir/api/health` → `{"status":"ok"}`
- Web: `curl -I https://staging.biawin.ir/` → `200`
- Both Docker images also have their own `HEALTHCHECK` (visible in `docker ps`),
  independent of the external curl checks `deploy.sh` runs.

## Rollback

`deploy.sh` does not overwrite a working deployment until the very last step
(bringing up the new `backend`/`web` containers) — if the health check after
that fails, the script exits non-zero and prints where to look
(`docker compose -f deploy/staging/docker-compose.staging.yml logs backend`).

To manually roll back to the previous commit:

```bash
cd /srv/biawin-staging
git log --oneline -5          # find the last known-good commit
git checkout <previous-sha>
docker compose -f deploy/staging/docker-compose.staging.yml build backend web
docker compose -f deploy/staging/docker-compose.staging.yml up -d backend web
```

Database migrations are additive by convention (Prisma migrations are not
auto-reverted) — a rollback that depends on reversing a migration needs a
hand-written down-migration; note this explicitly if it ever comes up rather
than attempting an automatic revert.

## Production promotion (future)

Not scoped yet. When Biawin is ready for `biawin.ir` / `api.biawin.ir`:

- Duplicate `deploy/staging/` as `deploy/production/` with production secrets
  (never staging's `STAGING_TEST_AUTH=true`, never `SMS_PROVIDER=mock`, real
  payment merchant credentials).
- Point `deploy-staging.yml`'s pattern at a new `deploy-production.yml` with
  its own GitHub environment + secrets, gated by required reviewers.
- Everything else (Dockerfiles, compose structure, migrate/seed pattern)
  carries over unchanged — staging and production are meant to be
  structurally identical, differing only in env values and domain.
