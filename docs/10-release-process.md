# 10 — Release Process

## Environments

| Environment | URL | `NODE_ENV` | Notes |
|---|---|---|---|
| Local dev | `http://localhost:3000` / `:4000` | `development` | [05-development-guide.md](05-development-guide.md) |
| Staging | `https://staging.biawin.ir` / `https://api-staging.biawin.ir` | `production` (with `STAGING_TEST_AUTH=true`) | [08-staging-deployment.md](08-staging-deployment.md) |
| Production | `https://biawin.ir` / `https://api.biawin.ir` | `production` | Not live yet |

## One-time server setup

Done (2026-08-22) — staging is fully live on public HTTPS as of this writing.

1. **Subdomains**: both created under the `biawin` cPanel account via
   `uapi SubDomain addsubdomain`.
2. **Reverse proxy**: `mod_rewrite` + `mod_proxy` in cPanel's official
   per-vhost include hook — **not** `.htaccess`, which this server silently
   ignores for reasons never fully root-caused (`AllowOverride` is globally
   `All`, yet even an intentionally-invalid `.htaccess` produces no error, on
   every vhost tested — this appears to be a server-wide behavior). The
   working pattern mirrors an existing example on this same server
   (`merchant-api.rominaclub.ir`, which uses plain `ProxyPass`/
   `ProxyPassReverse` — that alone was tried first and also worked for normal
   traffic, but `ProxyPass ... !` did not reliably exclude the ACME challenge
   path on this LiteSpeed build, so the final version uses `RewriteCond`
   instead, which does):

   ```
   /etc/apache2/conf.d/userdata/std/2_4/biawin/staging.biawin.ir/proxy.conf
   /etc/apache2/conf.d/userdata/ssl/2_4/biawin/staging.biawin.ir/proxy.conf
   /etc/apache2/conf.d/userdata/std/2_4/biawin/api-staging.biawin.ir/proxy.conf
   /etc/apache2/conf.d/userdata/ssl/2_4/biawin/api-staging.biawin.ir/proxy.conf
   ```

   `std/` (port 80) content — redirects to HTTPS except for ACME challenges:
   ```apache
   RewriteEngine On
   RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
   RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
   RewriteRule ^(.*)$ http://127.0.0.1:3001$1 [P,L]
   ProxyPreserveHost On
   ```
   `ssl/` (port 443) content — no redirect needed, already HTTPS:
   ```apache
   SSLProxyEngine On
   RewriteEngine On
   RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
   RewriteRule ^(.*)$ http://127.0.0.1:3001$1 [P,L]
   ProxyPreserveHost On
   ```
   (`4001` in place of `3001` for `api-staging.biawin.ir`'s two files.)
   These survive `/scripts/rebuildhttpdconf` (cPanel's official customization
   mechanism) — after editing any of them, always run:
   ```bash
   /scripts/rebuildhttpdconf && /scripts/restartsrv_httpd
   ```
3. **DNS**: corrected externally at MizbanCDN (`staging.biawin.ir` /
   `api-staging.biawin.ir` were pointing at MizbanCDN's proxy IPs, not this
   server — `biawin.ir`'s authoritative nameservers are MizbanCDN's). Verified
   resolving to `62.204.61.18` via both `8.8.8.8` and `1.1.1.1`.
4. **SSL**: issued via `/usr/local/cpanel/bin/autossl_check --user=biawin`.
   One extra step was needed beyond DNS: AutoSSL groups a domain with its
   `www.` alias by default and fails the whole certificate if either fails
   DCV — `www.staging.biawin.ir` / `www.api-staging.biawin.ir` were never
   given DNS records (not needed for a staging service), so they were
   excluded from AutoSSL's scope instead:
   ```bash
   whmapi1 add_autossl_user_excluded_domains username=biawin \
     domain=www.staging.biawin.ir domain=www.api-staging.biawin.ir
   ```
   After that, both domains issued a real Let's Encrypt cert (SAN covers both
   `staging.biawin.ir` and `api-staging.biawin.ir` on one certificate) —
   verified with `curl`'s strict hostname checking (no `-k`), both report
   `SSL certificate verify ok`.
5. **Clone the repo** on the server:
   ```bash
   mkdir -p /srv/biawin-staging
   git clone https://github.com/mehrdadhafezi/biawinApp.git /srv/biawin-staging
   cd /srv/biawin-staging
   cp deploy/staging/.env.staging.example deploy/staging/.env.staging
   # then edit deploy/staging/.env.staging with real random secrets
   chmod +x deploy/staging/deploy.sh
   ```
6. **Deploy**:
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
