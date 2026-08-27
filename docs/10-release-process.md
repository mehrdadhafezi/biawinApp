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

   **Update (Stage 5.22 addendum below)**: this `RewriteCond`-negation
   pattern turned out not to reliably exclude `/.well-known/acme-challenge/`
   from the proxy rule on this LiteSpeed build — confirmed via
   `admin-staging.biawin.ir` hitting the exact same issue with byte-for-byte
   identical rule syntax. These two domains' live files have not been
   touched (their certs are already issued and nothing is currently broken
   for them), but the next time either renews, the same DCV failure is
   possible. See the addendum's "The fix" for the corrected pattern
   (dedicated match-and-stop `RewriteRule`, not a negated `RewriteCond`) —
   apply it here too at the next convenient opportunity.

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

**Execution order — revised after a real attempt.** An earlier draft of this
doc claimed AutoSSL's DCV request never reaches the Docker upstream at all
(the `proxy.conf` `RewriteCond` below excludes
`/.well-known/acme-challenge/` from the proxy rule), and so step 4 was safe
to run before the Docker deploy. **A real attempt on staging contradicted
that**: with the `admin` container not yet running (nothing listening on
`127.0.0.1:3002`), AutoSSL's DCV check against
`http://admin-staging.biawin.ir/.well-known/acme-challenge/...` returned
`503 Service Unavailable` — not the `404`/static-file-miss you'd expect if
the request genuinely never touched the reverse proxy. A `503` is what
LiteSpeed's `mod_proxy` returns when it cannot reach the proxied backend —
already a strong hint the acme-challenge exclusion wasn't taking effect,
confirmed conclusively below once `admin` was actually deployed.

**Revised recommendation: run step 4 (AutoSSL) *after* confirming the
`admin` container is healthy on `127.0.0.1:3002`, not before.** This
sidesteps the open question entirely — with something alive on 3002, even a
proxied-through acme-challenge request gets a real (if wrong, e.g. a 404 from
the Next.js app) response instead of a dead-upstream 503, and DCV has its
best chance of succeeding either way. Order:

1. Steps 1-3 below (subdomain, proxy config, DNS) — independent of Docker,
   do these first.
2. Run `deploy.sh` (or, before touching real staging, verify the image
   first with `./deploy/staging/verify-runtime-image.sh` — see
   [08-staging-deployment.md](08-staging-deployment.md) "Runtime image
   packaging"). Confirm `admin` is healthy: `curl -I http://127.0.0.1:3002/`.
3. **Then** run step 4 (AutoSSL).
4. Only curl the public domain (`http://` or `https://admin-staging.biawin.ir/`)
   once both 2 and 3 are done — before that, any such curl returning a
   connection-refused/502/503 is expected and uninformative, not a new bug.

**Update — this happened, and is now root-caused.** With `admin` confirmed
healthy on `127.0.0.1:3002`, AutoSSL's DCV request against
`/.well-known/acme-challenge/<token>` returned `404`, not the `503` seen
when the container was down. That's conclusive, not ambiguous: the *only*
thing that changed between the two attempts was whether something was
listening on `127.0.0.1:3002` — and the response tracked that exactly (dead
upstream → `503`; live upstream, no matching route → `404` from the Next.js
app's own catch-all). If the `RewriteCond`-based exclusion were actually
excluding this path from the proxy rule, the backend's up/down state would
have been irrelevant to *either* response — Apache/LiteSpeed would have
served (or failed to find) a static file from the docroot both times. So
this exclusion mechanism does not work on this LiteSpeed build, for either
attempt — the request has been proxied through both times.

**This also retroactively undermines the original claim** ("the same
exclusion already proven working for `staging.biawin.ir`/
`api-staging.biawin.ir`'s real certificates") from the first version of
this doc. That claim was inferred from "the certificates got issued," not
from directly observing the acme-challenge path bypass the proxy — and
both of those domains had their DNS *and* AutoSSL steps done *before* any
Docker container existed on `3001`/`4001` (see "One-time server setup"
steps 3-6 above: DNS/SSL steps 1-4 happen before "Clone the repo" step 5
and "Deploy" step 6). If the same flaw exists there too, it simply never
had an opportunity to matter — a proxied-through acme-challenge request
would have hit nothing but dead upstreams either way at that point in time,
and cPanel's AutoSSL may tolerate that differently than a live app
returning a real (wrong) `404`. **Do not treat `staging.biawin.ir`/
`api-staging.biawin.ir` as proven-safe by this pattern going forward** —
their certs auto-renew periodically, and a renewal after a live app is
listening on those ports could hit this exact failure. Apply the fix below
to their `proxy.conf` files too at the next convenient opportunity (not
urgent — nothing is currently broken for them).

**The fix**: replace the negated-`RewriteCond` exclusion with a dedicated,
unconditional, match-and-stop `RewriteRule` for the acme-challenge path,
placed *before* any redirect/proxy rule. This is the standard, widely-used
pattern for excluding ACME challenges from a reverse-proxy vhost (a
positive match that stops all further rewrite processing via `[L]`, rather
than a negative lookahead that a later rule must also honor) — see the
updated `std/`/`ssl/` content in step 2 below, now applied to
`admin-staging.biawin.ir`.

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
   `std/` (port 80) content — a dedicated, unconditional match-and-stop rule
   for the ACME path (`[L]`, no substitution) placed BEFORE the
   redirect/proxy rules, instead of relying on a negated `RewriteCond` on
   each of them (see the root-cause note above — this is the corrected
   pattern, not the original one):
   ```apache
   RewriteEngine On
   RewriteRule ^/\.well-known/acme-challenge/ - [L]
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
   RewriteRule ^(.*)$ http://127.0.0.1:3002$1 [P,L]
   ProxyPreserveHost On
   ```
   `ssl/` (port 443) content:
   ```apache
   SSLProxyEngine On
   RewriteEngine On
   RewriteRule ^/\.well-known/acme-challenge/ - [L]
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

5. **Restart LiteSpeed after AutoSSL reports success — do not skip this.**
   `autossl_check` reporting `Success! Installing...` proves cPanel wrote the
   new certificate to its own TLS storage and updated the domain's userdata
   — it does **not** prove LiteSpeed is actually serving it. On this host,
   AutoSSL's automatic post-install reload did not reliably propagate to
   `lshttpd` (real Stage 5.22 result: `autossl_check` reported success, but
   `openssl s_client -connect admin-staging.biawin.ir:443 -servername
   admin-staging.biawin.ir` still returned the year-old self-signed
   placeholder cert immediately afterward). This is a known category of
   cPanel+LiteSpeed integration gap, not specific to this one domain — a
   manual restart of the LiteSpeed service via cPanel's own supported
   service-manager call closes it:
   ```bash
   whmapi1 restartservice service=lshttpd
   ```
   LiteSpeed's restart model is graceful by design (new workers start,
   old ones drain — not a hard connection drop), but this does restart the
   single `lshttpd` process serving every domain on this shared host, not
   just `admin-staging.biawin.ir` — a brief blip for `staging.biawin.ir`/
   `api-staging.biawin.ir`/Beauty Platform is possible, an outright config
   *change* to them is not (this command touches no config, only reloads
   the running process). Re-verify with the same `openssl s_client` command
   after — it should now show a `Let's Encrypt` issuer, not the self-signed
   placeholder. **This applies to every future AutoSSL renewal on this
   host, automated or manual, for any of the three staging domains** — a
   renewal succeeding per `autossl_check`/WHM's own logs does not by itself
   guarantee HTTPS keeps working; verify what's actually served after any
   renewal, and restart `lshttpd` if it still shows the old certificate.

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
node dist/prisma/seed.js` (both safe to re-run — not `prisma db seed`; see
[08-staging-deployment.md](08-staging-deployment.md) "Runtime image
packaging" for why), run the Home CMS static asset migration
(`dist/prisma/seed-home-media.js`, Stage 5.21, also idempotent — skips rows
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
