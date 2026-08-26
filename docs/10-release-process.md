# 10 — Release Process

## Environments

| Environment | URL | `NODE_ENV` | Notes |
|---|---|---|---|
| Local dev | `http://localhost:3000` / `:4000` / `:3002` (admin) | `development` | [05-development-guide.md](05-development-guide.md) |
| Staging | `https://staging.biawin.ir` / `https://api-staging.biawin.ir` / `https://admin-staging.biawin.ir` (Stage 5.22) | `production` (with `STAGING_TEST_AUTH=true`) | [08-staging-deployment.md](08-staging-deployment.md) |
| Production | `https://biawin.ir` / `https://api.biawin.ir` / `https://admin.biawin.ir` | `production` | Not live yet |

## One-time server setup

Done (2026-08-22) — staging is fully live on public HTTPS as of this writing.

1. **Subdomains**: both created under the `biawin` cPanel account via
   `uapi SubDomain addsubdomain`. **`uapi` run by `root` requires an explicit
   `--user=biawin` flag** — cPanel has no default account context for root,
   and refuses with `This program must be passed the --user flag when run by
   root!` without it (confirmed the hard way during the Stage 5.22 addendum
   below — the flag was missing from an earlier draft of this doc):
   ```bash
   uapi --user=biawin SubDomain addsubdomain domain=<sub> rootdomain=biawin.ir \
     dir=public_html/<sub>.biawin.ir
   ```
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

### Stage 5.22 addendum — `admin-staging.biawin.ir`

Not yet done as of this writing — the repository-side package (Dockerfile,
compose service, env vars, CORS) is complete and pushed, but the domain
itself has no vhost/DNS/SSL yet. These are the exact, one-time manual steps
to add it, mirroring steps 1-4 above precisely (same account, same
mechanism), pointed at the new `admin` container's port `3002` instead of
`3001`/`4001`:

**Execution order.** Steps 1-4 below (cPanel subdomain, proxy config,
DNS, SSL) are entirely independent of the Docker side (`deploy.sh`
building and starting the `admin` container) — neither blocks the other,
and they may run in either relative order. Two things follow from that:

- **AutoSSL (step 4) does not need the `admin` container running.** Its
  HTTP DCV check requests `/.well-known/acme-challenge/<token>` over plain
  HTTP, and both `proxy.conf` files below explicitly exclude that path from
  the `RewriteRule ... [P,L]` proxy line (`RewriteCond %{REQUEST_URI}
  !^/\.well-known/acme-challenge/`) — the same exclusion already proven
  working for `staging.biawin.ir`/`api-staging.biawin.ir`'s real
  certificates. That request falls through to cPanel's normal static docroot
  serving, where AutoSSL plants the token itself; it never reaches the
  proxied `127.0.0.1:3002` upstream. So step 4 is safe to run before,
  during, or after the Docker deploy.
- **Do not curl the public domain (`http://` or `https://
  admin-staging.biawin.ir/`) as a *reverse-proxy* health check until after
  the `admin` container is actually running on `127.0.0.1:3002`.** Every
  other path (i.e. everything except the excluded acme-challenge prefix)
  *does* proxy straight through to `127.0.0.1:3002` — if nothing is
  listening there yet, that curl returns a connection-refused/502 that looks
  like a broken proxy or a failed AutoSSL but is really just "not deployed
  yet." Run steps 1-4 first (cPanel/DNS/SSL, all fast and Docker-independent),
  then run `deploy.sh`, and only curl the public domain once `deploy.sh`
  itself has confirmed `127.0.0.1:3002` healthy.

1. **Subdomain**: create under the same `biawin` cPanel account via
   `uapi SubDomain addsubdomain`, same as the existing two — **must include
   `--user=biawin`** when run as `root` (see the note on step 1 above; a
   first attempt without it fails with `This program must be passed the
   --user flag when run by root!` and does not create the vhost):
   ```bash
   uapi --user=biawin SubDomain addsubdomain domain=admin-staging \
     rootdomain=biawin.ir dir=public_html/admin-staging.biawin.ir
   ```
   **Recovery if the proxy.conf files were created before this step
   succeeded** (e.g. the `--user`-less attempt failed, but the two
   `proxy.conf` files below were already hand-created and
   `rebuildhttpdconf` already run once against them): this is safe and
   requires no cleanup. `SubDomain addsubdomain` only touches DNS, the
   cPanel account's vhost registration, and the docroot under
   `public_html/` — it does not touch or overwrite the userdata `proxy.conf`
   customization layer. Once the subdomain is created successfully, simply
   re-run `/scripts/rebuildhttpdconf && /scripts/restartsrv_httpd` (step 2
   below) and the existing proxy.conf files are picked up and folded into
   the newly generated vhost automatically — no need to recreate them.
   Confirm the account-level registration actually landed with:
   ```bash
   ls /var/cpanel/userdata/biawin/ | grep admin-staging
   ```
   (`apachectl -S` is not a reliable check on this LiteSpeed-under-cPanel
   Apache-compatibility setup — it returned nothing for this domain even
   after DNS was already correct, simply because the vhost didn't exist yet
   under `/var/cpanel/userdata/`; the `ls` above and a direct `curl` after
   step 2 are the authoritative checks.)
2. **Reverse proxy**: same `mod_proxy` per-vhost include hook pattern (not
   `.htaccess` — see the note above for why):
   ```
   /etc/apache2/conf.d/userdata/std/2_4/biawin/admin-staging.biawin.ir/proxy.conf
   /etc/apache2/conf.d/userdata/ssl/2_4/biawin/admin-staging.biawin.ir/proxy.conf
   ```
   `std/` (port 80) content:
   ```apache
   RewriteEngine On
   RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
   RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
   RewriteRule ^(.*)$ http://127.0.0.1:3002$1 [P,L]
   ProxyPreserveHost On
   ```
   `ssl/` (port 443) content:
   ```apache
   SSLProxyEngine On
   RewriteEngine On
   RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
   RewriteRule ^(.*)$ http://127.0.0.1:3002$1 [P,L]
   ProxyPreserveHost On
   ```
   Then, as always after editing either file:
   ```bash
   /scripts/rebuildhttpdconf && /scripts/restartsrv_httpd
   ```
3. **DNS**: point `admin-staging.biawin.ir` at `62.204.61.18` at MizbanCDN
   (same authoritative nameservers as the other two subdomains). Verify with
   both `8.8.8.8` and `1.1.1.1` before requesting SSL — AutoSSL's DCV will
   fail silently-but-informatively if DNS isn't resolving yet.
4. **SSL**: same `autossl_check` mechanism, with the same `www.` exclusion
   (the `www.admin-staging.biawin.ir` alias will never get a DNS record):
   ```bash
   whmapi1 add_autossl_user_excluded_domains username=biawin \
     domain=www.admin-staging.biawin.ir
   /usr/local/cpanel/bin/autossl_check --user=biawin
   ```
   Verify afterward with `curl`'s strict hostname checking (no `-k`) that
   `https://admin-staging.biawin.ir/` reports `SSL certificate verify ok`.

No repo re-clone or code change is needed for this addendum — the `admin`
service, its Dockerfile, and its compose wiring are already part of the
repository as of this commit. Once these four steps are done, the very next
`./deploy/staging/deploy.sh` run (or the current containers, if already
running) serves the Admin Portal at `https://admin-staging.biawin.ir/`
immediately — no further deploy is required purely for the domain to start
working.

## Deploying a new staging release

```bash
ssh -p 2490 root@62.204.61.18
cd /srv/biawin-staging
./deploy/staging/deploy.sh
```

Or, once GitHub secrets are configured: **Actions → Deploy Staging → Run
workflow** on the desired branch.

`deploy.sh` is idempotent — `git reset --hard origin/main`, rebuild images
(backend + web + admin), bring up infra, run `prisma migrate deploy &&
prisma db seed` (both safe to re-run), run the Home CMS static asset
migration (`seed-home-media.ts`, Stage 5.21, also idempotent — skips rows
that already have a `mediaAssetId`), then cut over backend/web/admin and
health-check all three.

## Health checks

- Backend: `curl https://api-staging.biawin.ir/api/health` → `{"status":"ok"}`
- Web: `curl -I https://staging.biawin.ir/` → `200`
- Admin: `curl -I https://admin-staging.biawin.ir/` → `200` (Stage 5.22 —
  once the domain's vhost/DNS/SSL addendum above is done; until then, verify
  the container itself directly with `curl -I http://127.0.0.1:3002/` on the
  server)
- All three Docker images also have their own `HEALTHCHECK` (visible in
  `docker ps`), independent of the external curl checks `deploy.sh` runs.

## Rollback

`deploy.sh` does not overwrite a working deployment until the second-to-last
step (bringing up the new `backend`/`web`/`admin` containers) — if the
health check after that fails, the script exits non-zero and prints where to
look (`docker compose -f deploy/staging/docker-compose.staging.yml logs
backend` — swap in `web` or `admin` as needed).

To manually roll back to the previous commit:

```bash
cd /srv/biawin-staging
git log --oneline -5          # find the last known-good commit
git checkout <previous-sha>
docker compose -f deploy/staging/docker-compose.staging.yml build backend web admin
docker compose -f deploy/staging/docker-compose.staging.yml up -d backend web admin
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
