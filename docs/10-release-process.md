# 10 — Release Process

## Environments

| Environment | URL | `NODE_ENV` | Notes |
|---|---|---|---|
| Local dev | `http://localhost:3000` / `:4000` | `development` | [05-development-guide.md](05-development-guide.md) |
| Staging | `https://staging.biawin.ir` / `https://api-staging.biawin.ir` | `production` (with `STAGING_TEST_AUTH=true`) | [08-staging-deployment.md](08-staging-deployment.md) |
| Production | `https://biawin.ir` / `https://api.biawin.ir` | `production` | Not live yet |

## One-time server setup

Done (2026-08-22): both subdomains created under the `biawin` cPanel account
via `uapi SubDomain addsubdomain`, and reverse-proxied to their backend ports
using `mod_proxy` — **not** `.htaccess`'s `RewriteRule ... [P]`, which this
server silently ignores for reasons never fully root-caused (AllowOverride
is globally `All`, yet even an intentionally-invalid `.htaccess` produces no
error, on every vhost tested — this appears to be a server-wide behavior,
not specific to these two subdomains). The proven-working pattern instead
lives in cPanel's official per-vhost include hook, mirroring an existing
working example on this same server (`merchant-api.rominaclub.ir`):

```
/etc/apache2/conf.d/userdata/std/2_4/biawin/staging.biawin.ir/proxy.conf
/etc/apache2/conf.d/userdata/ssl/2_4/biawin/staging.biawin.ir/proxy.conf
/etc/apache2/conf.d/userdata/std/2_4/biawin/api-staging.biawin.ir/proxy.conf
/etc/apache2/conf.d/userdata/ssl/2_4/biawin/api-staging.biawin.ir/proxy.conf
```

Each `proxy.conf` (the `ssl/` copy additionally has `SSLProxyEngine On` first):

```apache
ProxyPass /.well-known/acme-challenge/ !
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:3001/
ProxyPassReverse / http://127.0.0.1:3001/
```

(`4001` for `api-staging.biawin.ir`.) The `/.well-known/acme-challenge/`
exclusion is required — without it, `ProxyPass /` would swallow AutoSSL's
own HTTP-01 domain-validation requests and every future cert renewal would
fail. These files survive `/scripts/rebuildhttpdconf` (cPanel's official
customization mechanism) — after editing them, always run:

```bash
/scripts/rebuildhttpdconf && /scripts/restartsrv_httpd
```

**Remaining manual step — DNS**: `staging.biawin.ir` / `api-staging.biawin.ir`
currently resolve (confirmed via `dig @8.8.8.8`) to `185.226.140.40` /
`185.226.142.42` — MizbanCDN, **not** `62.204.61.18`. `biawin.ir`'s
authoritative nameservers are MizbanCDN's (`d.dns.mizbancdn.com/net`), so DNS
for these two subdomains must be corrected in MizbanCDN's own panel (DNS-only
record, or origin IP if using their proxy/CDN mode), not on this WHM server.
AutoSSL (`/usr/local/cpanel/bin/autossl_check --user=biawin`) already
confirmed everything else is ready — CAA records, CA authorization, and both
vhosts all pass; the only failure is `TOTAL_DCV_FAILURE` because Let's
Encrypt's validation request lands on MizbanCDN's IP instead of this server.
Once DNS is corrected, re-run the same `autossl_check` command (or wait for
cPanel's next scheduled AutoSSL pass) and both certs will issue automatically
— no further server-side action needed.
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
