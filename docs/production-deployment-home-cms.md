# Production Deployment — Biawin Home CMS
## Stage P.1 — Preflight & Runbook

**Status as of this writing: PREFLIGHT ONLY. Production has not been
deployed. No production server, DNS, vhost, certificate, database, or
object storage has been touched by this stage.** Every command in this
document is provided for execution by the account owner; nothing here was
run against a real production system while preparing it.

---

## 0. Release readiness this runbook builds on

| | |
|---|---|
| Engineering verdict | `BIAWIN HOME CMS RELEASE: PRODUCTION READY` (Stage 5.22 closure) |
| Closure commit | [`2fc7e69`](https://github.com/mehrdadhafezi/biawinApp/commit/2fc7e69) |
| Final staging QA | 54 PASS / 0 FAIL (API+auth), 15 PASS / 0 FAIL (browser), cleanup OK |
| Open P0 | none |
| Open P1 | none |
| Open P2 | HomeHeroCard duplicate-key collision surfaces raw HTTP 500 instead of 409 (unreachable by any real Admin workflow) |
| Outstanding (not a defect) | Human visual sign-off against the Stage 5.14.1 baseline — see `docs/stage-5.22-staging-production-readiness-qa.md` §21 |

Full detail: [`docs/stage-5.22-staging-production-readiness-qa.md`](stage-5.22-staging-production-readiness-qa.md).

---

## 1. Release candidate

**Deploy an immutable revision, not a moving `HEAD`.**

- Release commit: **`2fc7e69`** (Stage 5.22 closure — the exact commit the
  final PRODUCTION READY verdict was issued against).
- Branch: `main` (single-branch repository; no other branches exist).
- **Immutable tag created and pushed as part of this preflight**:
  `biawin-home-cms-v1` → `2fc7e69`. This is the reference production
  deploys should actually check out (`git checkout biawin-home-cms-v1`),
  not `origin/main`, which will keep moving as work continues. See §14/§15
  for the exact command run.

### Required services
`postgres`, `redis`, `minio` (+ `minio-init`), `backend`, `web` (Customer),
`admin` (Admin Portal) — six containers, identical set to staging.

### Migrations included in this release
All 7 currently in `backend/prisma/migrations/`:
`20260821152341_init`, `20260821153155_add_service_icon`,
`20260823131704_add_orbit_items`, `20260825120105_admin_identity_foundation`,
`20260825140711_media_library_foundation`, `20260825152328_home_cms_foundation`,
`20260825152535_admin_audit_action_update_reorder`. Classified in §4.

### Required environment variables
Full contract in §6 — `deploy/production/.env.production.example` is the
authoritative template (new this stage, mirrors
`deploy/staging/.env.staging.example` with production-specific hardening).

### Required storage configuration
One MinIO (or S3-compatible) bucket, root-credentialed only — no separate
non-root IAM user exists anywhere in this codebase's storage architecture
(confirmed from `minio-init`'s entrypoint — only `mc mb` + `mc anonymous set
download`, never `mc admin user add`).

### Required domains
`biawin.ir` (Customer — **see the open question in §2, this is not a blank
slate**), `api.biawin.ir` (backend, no DNS record exists yet), `admin.biawin.ir`
(Admin Portal — DNS already exists, points at `62.204.61.18`; see §2).

### Required ports / volumes
See `deploy/production/docker-compose.production.yml` — proposed values,
explicitly marked pending confirmation in §2/§3.

---

## 2. Deployment architecture — mapping, with real unknowns marked

| | STAGING | PRODUCTION |
|---|---|---|
| Customer domain | `staging.biawin.ir` | **`biawin.ir` — but this is a LIVE, real WordPress site today (see below). Not confirmed as the Customer App's actual target.** |
| API domain | `api-staging.biawin.ir` | `api.biawin.ir` — **no DNS record exists yet (NXDOMAIN, verified live)** |
| Admin domain | `admin-staging.biawin.ir` | `admin.biawin.ir` — **DNS already points at `62.204.61.18` (the staging server!), but no vhost/cert exists there yet (verified live — TLS handshake returns the host's own default cert, `cpanel.varizo.ir`, not a cert for this domain)** |
| Customer port | `127.0.0.1:3001` | Proposed `127.0.0.1:3101` (see docker-compose.production.yml header) — **unverified against actual target host** |
| Backend port | `127.0.0.1:4001` | Proposed `127.0.0.1:4101` — **unverified** |
| Admin port | `127.0.0.1:3002` | Proposed `127.0.0.1:3102` — **unverified** |
| Postgres | `127.0.0.1:5433` (own container) | Proposed `127.0.0.1:5533` (own container) — **unverified** |
| Redis | `127.0.0.1:6380` (own container) | Proposed `127.0.0.1:6480` (own container) — **unverified** |
| Object storage | own MinIO container, `127.0.0.1:9010/9011` | Proposed own MinIO container, `127.0.0.1:9110/9111` — **unverified** |
| Volumes | `biawin_staging_{postgres,redis,minio}_data` | `biawin_production_{postgres,redis,minio}_data` (defined in `docker-compose.production.yml`, not yet created anywhere) |
| Reverse proxy | LiteSpeed/cPanel on `62.204.61.18` | **Unconfirmed — same host as staging, or a different one entirely?** |
| TLS | Let's Encrypt via AutoSSL, `62.204.61.18` | **Unconfirmed — depends on the answer above** |
| Environment file | `deploy/staging/.env.staging` (gitignored, server-only) | `deploy/production/.env.production` (gitignored, server-only — template created this stage, real file does not exist yet) |
| Docker Compose project | `biawin-staging` | `biawin-production` (defined this stage) |
| Docker subnet | `172.19.0.0/16` | Proposed `172.20.0.0/16` — **unverified, only matters if colocated with staging** |

### The two real unknowns this preflight cannot resolve alone

**A. `biawin.ir` is currently a live WordPress site, not an empty domain.**
Verified directly (not assumed): `https://biawin.ir/` returns `200`, served
by `MizbanCloud`, with a WordPress-generated page titled `"بیاوین –
باشگاه مشتریان"` (`wp-json` links, `wp-content` asset paths, a `quform`
session cookie). This is real, live content, on infrastructure entirely
unrelated to the staging server (`185.226.140.40`, not `62.204.61.18`).
**This preflight does not assume `biawin.ir` is the Customer App's
production target** — that requires an explicit decision from the account
owner: is the plan to replace this WordPress site with the Next.js Customer
App at the same domain (a real content/traffic cutover, not a blank-slate
launch), or does the Customer App go live at a different domain and
`biawin.ir` stays as-is? **Do not proceed past §16's discovery step without
answering this.**

**B. `admin.biawin.ir` already has a DNS A-record pointing at the staging
server (`62.204.61.18`), but no vhost or certificate exists there for it.**
Verified directly: DNS resolves to `62.204.61.18`; a TLS handshake against
`admin.biawin.ir:443` succeeds but presents the certificate for
`cpanel.varizo.ir` (the host's own generic default vhost), not a certificate
for `admin.biawin.ir` — meaning something requested this DNS record ahead of
time, but the actual subdomain/vhost/SSL setup (the same steps documented
for `admin-staging.biawin.ir` in `docs/10-release-process.md`) has not been
done. This is either (a) intentional — production genuinely is meant to
share the staging server, differentiated by vhost, mirroring how staging
itself shares a host with Beauty Platform/Romina — or (b) a stray/leftover
DNS record. **Needs the account owner's confirmation, not an assumption.**

---

## 3. Production discovery — one safe, read-only SSH command block

Everything above that's marked unverified/unconfirmed cannot be resolved
from the repository. This command targets `62.204.61.18` — the only server
with any prior evidence connecting it to production (finding B above). **If
production is actually a separate, dedicated machine, this command is the
wrong target — say so instead of running it, and share that server's access
details rather than running this.**

Entirely read-only: no writes, no service restarts, no config changes.
Secret values are never echoed — only variable *names* and SET/MISSING
status where `.env` inspection is relevant, per the explicit requirement.

```bash
echo "=== OS / host ==="
cat /etc/os-release | head -5
hostname
uptime

echo
echo "=== CPU / RAM / disk ==="
nproc
free -h
df -h /

echo
echo "=== Docker ==="
docker --version
docker compose version
docker network ls
docker volume ls | grep -i biawin

echo
echo "=== Existing Biawin directories ==="
ls -la /srv/ 2>/dev/null
[ -d /srv/biawin-staging ] && echo "--- /srv/biawin-staging git state ---" && \
  cd /srv/biawin-staging && git status --short && git log --oneline -3 && git remote -v
[ -d /srv/biawin-production ] && echo "--- /srv/biawin-production ALREADY EXISTS ---" && \
  ls -la /srv/biawin-production

echo
echo "=== Running containers (all, not just biawin-staging) ==="
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo
echo "=== Listening ports on the host ==="
ss -tlnp 2>/dev/null | grep -E ':(3000|3001|3002|3100|3101|3102|4000|4001|4100|4101|5432|5433|5500|5533|6380|6480|8080|9010|9011|9110|9111) '

echo
echo "=== cPanel accounts on this box ==="
whmapi1 listaccts | grep -E "^\s*(user|domain):" 2>/dev/null | head -40

echo
echo "=== Domains already known to the biawin cPanel account ==="
uapi --user=biawin DomainInfo list_domains 2>/dev/null

echo
echo "=== Existing vhost/userdata for the three production domains, if any ==="
for d in biawin.ir api.biawin.ir admin.biawin.ir; do
  echo "--- $d ---"
  ls -la /var/cpanel/userdata/biawin/ 2>/dev/null | grep -i "$d" || echo "(no userdata entry)"
  ls -la "/etc/apache2/conf.d/userdata/std/2_4/biawin/$d/" 2>/dev/null || echo "(no std proxy.conf)"
  ls -la "/etc/apache2/conf.d/userdata/ssl/2_4/biawin/$d/" 2>/dev/null || echo "(no ssl proxy.conf)"
done

echo
echo "=== Existing SSL certs covering these domains ==="
whmapi1 fetch_ssl_domains_certs domain=admin.biawin.ir 2>/dev/null
whmapi1 fetch_ssl_domains_certs domain=api.biawin.ir 2>/dev/null
whmapi1 fetch_ssl_domains_certs domain=biawin.ir 2>/dev/null

echo
echo "=== CSF allow-rules already present (subnets/ports only, no secrets) ==="
grep -E "172\.(19|20)\." /etc/csf/csfpost.sh 2>/dev/null

echo
echo "=== If deploy/production/.env.production already exists on this host: which vars are SET vs MISSING (values never printed) ==="
ENV_FILE=/srv/biawin-production/deploy/production/.env.production
if [ -f "$ENV_FILE" ]; then
  for v in DATABASE_URL POSTGRES_PASSWORD REDIS_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET \
           ADMIN_JWT_ACCESS_SECRET ADMIN_JWT_REFRESH_SECRET ADMIN_SEED_EMAIL ADMIN_SEED_PASSWORD \
           MINIO_ROOT_USER MINIO_ROOT_PASSWORD STORAGE_BUCKET PUBLIC_API_ORIGIN CORS_ORIGINS \
           STAGING_TEST_AUTH SMS_PROVIDER NEXT_PUBLIC_API_URL NEXT_PUBLIC_ADMIN_API_URL; do
    if grep -q "^${v}=" "$ENV_FILE" 2>/dev/null; then echo "$v: SET"; else echo "$v: MISSING"; fi
  done
else
  echo "$ENV_FILE does not exist yet"
fi
```

Also answer in plain text, alongside the command output — these are
business decisions, not something SSH can discover:

1. **Is `62.204.61.18` (the staging server) the intended production server,
   or is there a separate, dedicated production machine?** If separate,
   share its access details instead of running the command above against
   the wrong host.
2. **What is the plan for `biawin.ir`'s existing live WordPress site?**
   Replaced by the Next.js Customer App at the same domain, or does the
   Customer App go live elsewhere?

---

## 4. Database safety plan

### Migration classification (verified from actual SQL, not inferred from names)

| Migration | Type | Notes |
|---|---|---|
| `20260821152341_init` | Additive | Initial schema |
| `20260821153155_add_service_icon` | Additive | Nullable column add |
| `20260823131704_add_orbit_items` | Additive | New table |
| `20260825120105_admin_identity_foundation` | Additive | New tables + enums |
| `20260825140711_media_library_foundation` | Additive | New table + `ALTER TYPE ... ADD VALUE` (enum extension) |
| `20260825152328_home_cms_foundation` | Additive | New tables + enums |
| `20260825152535_admin_audit_action_update_reorder` | Additive | `ALTER TYPE ... ADD VALUE` only |

**Zero destructive statements across all 7 migrations** — confirmed by
grepping every `migration.sql` for `DROP TABLE`/`DROP COLUMN`/`TRUNCATE`/
`DELETE FROM`/`ALTER ... DROP`: no matches. No migration adds a `NOT NULL`
column without a default to an already-populated table (the one risk class
that can lock/fail on real data) — every `ADD COLUMN` here is nullable. The
two `ALTER TYPE ... ADD VALUE` migrations never reference the new enum
value within the same file (a real Postgres restriction — new enum values
can't be used in the same transaction that adds them), so no
same-transaction conflict risk either. **No migration in this release
presents a production risk beyond ordinary additive-schema deploy time.**

### Exact production DB sequence

```
PRE-DEPLOY BACKUP
   ↓
BACKUP VERIFICATION
   ↓
MIGRATION STATUS (dry check)
   ↓
PRISMA MIGRATE DEPLOY
   ↓
POST-MIGRATION VERIFICATION
```

```bash
# PRE-DEPLOY BACKUP — WRITE (creates a file, touches nothing live)
docker exec biawin-production-postgres pg_dump -U biawin -Fc biawin_production \
  > /srv/backups/biawin_production_$(date +%Y%m%d_%H%M%S).dump

# BACKUP VERIFICATION — READ-ONLY
pg_restore --list /srv/backups/biawin_production_<timestamp>.dump | head -20
# A non-empty, sane-looking table-of-contents listing (not an error) is the
# integrity check — pg_restore --list parses the whole dump's TOC without
# touching any database, and refuses on a corrupt/incomplete file.

# MIGRATION STATUS — READ-ONLY, before applying
docker compose -f deploy/production/docker-compose.production.yml \
  --env-file deploy/production/.env.production \
  run --rm backend sh -c "cd backend && pnpm exec prisma migrate status"

# PRISMA MIGRATE DEPLOY — WRITE (this is deploy.sh's own step 4/7)
# ... runs as part of ./deploy/production/deploy.sh, not standalone

# POST-MIGRATION VERIFICATION — READ-ONLY
docker compose -f deploy/production/docker-compose.production.yml \
  --env-file deploy/production/.env.production \
  run --rm backend sh -c "cd backend && pnpm exec prisma migrate status"
# Expect: "Database schema is up to date!"
```

This is a **new** procedure for this stage — staging never needed backup
tooling (it's throwaway/re-seedable by design); production is real,
persistent data from first write onward.

---

## 5. Object storage safety

### Idempotency of the Home media migration — verified from source

`backend/prisma/seed-home-media.ts` checks `row.mediaAssetId` before every
upload and explicitly skips (`[skip, already linked]`) any row that already
has one — confirmed by reading the script directly (`backend/prisma/seed-home-media.ts:118-121`).
**Duplicate-safe and deterministic**: re-running it never re-uploads an
already-linked asset, never creates a duplicate `MediaAsset`, and never
overwrites an existing production asset — it only ever fills in rows that
are still unlinked.

### Prerequisites and sequence

```bash
# STORAGE CONNECTIVITY CHECK — READ-ONLY
docker compose -f deploy/production/docker-compose.production.yml \
  --env-file deploy/production/.env.production run --rm minio-init \
  sh -c "mc alias set local http://minio:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD && mc admin info local"

# BUCKET EXISTENCE CHECK — READ-ONLY (minio-init creates it as part of
# normal startup — deploy.sh's own step 3/7 — this just confirms it landed)
docker compose ... run --rm minio-init sh -c "mc ls local/biawin-production"

# WRITE/READ SMOKE — one throwaway object, immediately removed (safe,
# reversible, proves the credential-derivation chain actually works
# end-to-end before trusting it with the 17 real Home images)
docker compose ... run --rm minio-init sh -c \
  "echo smoke | mc pipe local/biawin-production/_smoke-test.txt && \
   mc cat local/biawin-production/_smoke-test.txt && \
   mc rm local/biawin-production/_smoke-test.txt"

# BACKUP/SNAPSHOT — the MinIO data volume (biawin_production_minio_data)
# should be included in the same backup rotation as the Postgres dump above;
# a plain filesystem/volume-level backup is sufficient (MinIO's own data
# layout is stable across restarts, no export tool needed for this scale).

# MIGRATION EXECUTION — this is deploy.sh's own step 5/7
# ./deploy/production/deploy.sh

# POST-MIGRATION MEDIA VERIFICATION — READ-ONLY, after deploy
curl -sS https://api.biawin.ir/api/v1/home/service-banners | grep -o '"image":"[^"]*"' | head -3
# then fetch one of those URLs directly and confirm a real image byte
# response (Content-Type: image/webp, non-trivial Content-Length) — the
# exact check already proven this way on staging (Stage 5.22 §3).
```

Storage credentials are never printed by any command above — the
connectivity/bucket checks use `mc alias set` with shell variable
expansion (`$MINIO_ROOT_USER`/`$MINIO_ROOT_PASSWORD`), never a literal value
in the command line or its output.

---

## 6. Production environment contract

| Variable | Class | Notes |
|---|---|---|
| `NODE_ENV` | Infrastructure | Must be `production` |
| `PORT` | Infrastructure | `4000` (container-internal) |
| `POSTGRES_USER` | Infrastructure | |
| `POSTGRES_PASSWORD` | **Generated secret** | Fresh, never reused from staging |
| `POSTGRES_DB` | Infrastructure | `biawin_production` |
| `DATABASE_URL` | **Generated secret** | Embeds `POSTGRES_PASSWORD` |
| `REDIS_URL` | Infrastructure | Internal service name |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **Generated secret** | Customer auth — fresh |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL_DAYS` | Public | Non-secret tuning values |
| `OTP_*` / `SIGNUP_TOKEN_TTL_SECONDS` | Public | Non-secret tuning values |
| `STAGING_TEST_AUTH` | Public | **Must be `false` — see §9, verified structurally impossible to leak a customer token if left at the code default, but set explicitly anyway** |
| `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET` | **Generated secret** | Admin auth — fresh, distinct from customer `JWT_*`, required (backend fails to boot without them) |
| `ADMIN_JWT_ACCESS_TTL` / `ADMIN_JWT_REFRESH_TTL_DAYS` / `ADMIN_LOGIN_MAX_ATTEMPTS` / `ADMIN_LOGIN_LOCK_MINUTES` | Public | Non-secret tuning values |
| `ADMIN_SEED_EMAIL` | Public (but treat the account as sensitive) | Real production admin email |
| `ADMIN_SEED_PASSWORD` | **Generated secret** | Change immediately after first real login |
| `ADMIN_SEED_FULL_NAME` | Public | |
| `STORAGE_ENDPOINT` / `STORAGE_REGION` / `STORAGE_BUCKET` / `STORAGE_FORCE_PATH_STYLE` | Infrastructure | |
| `MINIO_ROOT_USER` | **Generated secret** (username half) | Backend derives `STORAGE_ACCESS_KEY` from this — do not also set `STORAGE_ACCESS_KEY` |
| `MINIO_ROOT_PASSWORD` | **Generated secret** | Backend derives `STORAGE_SECRET_KEY` from this — do not also set `STORAGE_SECRET_KEY` |
| `MEDIA_MAX_FILE_SIZE_BYTES` | Public | |
| `PUBLIC_API_ORIGIN` | Public | Required — `https://api.biawin.ir` |
| `CORS_ORIGINS` | Public | Both real production origins, comma-separated |
| `SMS_PROVIDER` / `FARAZ_*` | Infrastructure / **Generated secret** | **`mock` today — see the blocking-prerequisite note in §0/§9, this is not resolved by this stage** |
| `PAYMENT_PROVIDER` / `ZIBAL_MERCHANT_ID` / `ZARINPAL_MERCHANT_ID` | Optional | Out of scope for the Home CMS release; architecture-only |
| `NEXT_PUBLIC_API_URL` | Public (build-time) | `https://api.biawin.ir/api/v1` — baked into the `web` image at build |
| `NEXT_PUBLIC_ADMIN_API_URL` | Public (build-time) | `https://api.biawin.ir/api/v1` — baked into the `admin` image at build |

### `STAGING_TEST_AUTH` cannot accidentally leak into production

Verified from source (`backend/src/modules/auth/otp.service.ts`): the fixed
test phone/code bypass fires only when `NODE_ENV === 'development'` **or**
`STAGING_TEST_AUTH === 'true'` (a real string comparison against the parsed
env var, via `env.validation.ts`'s Zod schema, which itself **defaults to
`false` if the variable is unset entirely**). Production's `NODE_ENV` is
always `production`, and `deploy/production/.env.production.example`
explicitly sets `STAGING_TEST_AUTH=false` (not omitted) precisely so a
reviewer scanning the file sees an unambiguous `false`, never an absence
that could be misread as unconfigured. There is no other code path that
enables this bypass.

---

## 7. Admin production deployment

```
Internet
   ↓
TLS (Let's Encrypt via AutoSSL)
   ↓
LiteSpeed/cPanel reverse proxy (host TBD — §2/§3)
   ↓
admin container (127.0.0.1:3102, proposed)
   ↓
Backend Admin API (127.0.0.1:4101, proposed)
```

Steps (**not executed in this stage** — listed for the account owner to run
once the host is confirmed):

1. **Subdomain**: `uapi --user=<account> SubDomain addsubdomain domain=admin rootdomain=biawin.ir dir=public_html/admin.biawin.ir` — note the explicit `--user=` flag; omitting it when run as `root` fails outright (real staging incident, `docs/10-release-process.md`).
2. **Document root**: whatever `uapi` creates by default — irrelevant to serving, since this is a reverse proxy, not static file serving.
3. **Reverse proxy**: the corrected pattern from staging — a dedicated, unconditional match-and-stop `RewriteRule` for `/.well-known/acme-challenge/` placed *before* any redirect/proxy rule, **not** the original negated-`RewriteCond` pattern (proven unreliable on the staging LiteSpeed build; see `docs/10-release-process.md` "Stage 5.22 addendum" for the exact corrected `std/`/`ssl/` content — same shape, port `3102` instead of `3002`).
4. **Local container health**: `curl -I http://127.0.0.1:3102/` before touching DNS/SSL.
5. **HTTP verification**: `curl -I http://admin.biawin.ir/` once the vhost exists — expect a `307` to `/login`, matching staging's exact behavior.
6. **ACME challenge verification**: drop a real test file under `.well-known/acme-challenge/` and confirm it's served statically, not proxied — the exact self-verification step from the staging fix, done *before* spending an AutoSSL attempt.
7. **AutoSSL**: `whmapi1 add_autossl_user_excluded_domains` (exclude the `www.` alias, which will never get a DNS record) then `/usr/local/cpanel/bin/autossl_check`.
8. **Certificate-on-wire verification**: `openssl s_client -connect admin.biawin.ir:443 -servername admin.biawin.ir` — confirm the issuer is Let's Encrypt and the subject matches, **do not trust AutoSSL's own "Success" message alone** (real staging incident: AutoSSL reported success while LiteSpeed kept serving the old cert until `lshttpd` was explicitly restarted — `whmapi1 restartservice service=lshttpd`).
9. **HTTPS verification**: strict `curl -I https://admin.biawin.ir/` (no `-k`) — expect a valid cert and the same `307` → `/login`.

---

## 8. Customer + API production cutover

**Real production Customer/API situation, confirmed live (§2):**
`biawin.ir` is a live WordPress site today; `api.biawin.ir` has no DNS
record at all. This is **not** a green-field cutover for the Customer
domain — replacing it is a real content/traffic decision requiring the
account owner's explicit sign-off (§3), not something inferred here.

### Recommended sequence (adapt once §3's answers are in)

```
DB/object-storage backup (§4/§5)
        ↓
Backend deploy
        ↓
Migration
        ↓
Compiled idempotent seed
        ↓
Media migration
        ↓
Backend verification
        ↓
Admin deploy (§7)
        ↓
Admin verification
        ↓
── STOP / ROLLBACK POINT ──
  (Backend + Admin are live and verified; Customer traffic has not moved.
  Rolling back here means simply not proceeding — nothing public-facing
  for Customers has changed yet.)
        ↓
Customer deploy (api.biawin.ir DNS created + vhost; biawin.ir cutover only
  after the account owner's explicit go-ahead per §3's open question)
        ↓
Customer smoke tests (§11)
        ↓
Admin → Customer propagation smoke (§11)
        ↓
Release monitoring (§12)
```

Minimizing downtime for the *existing* WordPress site (if it's being
replaced) means: have `web`/`backend`/`admin` fully built, migrated,
seeded, and verified *before* touching `biawin.ir`'s DNS at all — the DNS
cutover itself is then a single, fast, low-downtime switch, not a step that
gates on anything slow.

---

## 9. Seed safety

Inspected `backend/prisma/seed.ts` directly (not assumed): it seeds
Categories, Services, Membership Plans, Rewards, Orbit Items, the full Home
CMS content set (Hero Cards/Service Banners/Mosaic Tiles/News Articles —
matching the approved Stage 5.14.1 prototype content, not placeholder
data), and exactly one `SUPER_ADMIN` from `ADMIN_SEED_EMAIL`/
`ADMIN_SEED_PASSWORD` (`prisma.adminUser.upsert(...)`, skips silently if
those two vars are unset). **No staging-only test fixture, no test
customer account, no hardcoded test phone number, no placeholder content
of any kind exists anywhere in either seed script** — confirmed by grep for
`STAGING_TEST_AUTH`/`test`/the fixed test phone number/`DEV_TEST` across
both files; the only match is an unrelated comment.

**Recommendation: run the complete compiled seed as-is** (`node
dist/prisma/seed.js`) — it *is* the production-appropriate seed, not a
staging-specific variant needing modification. It is fully idempotent
(`upsert`/find-then-update-or-create throughout, confirmed and exercised
repeatedly this stage without duplication).

**The one real risk is not the seed script — it's `STAGING_TEST_AUTH`**,
already covered in §6: the seed script itself introduces nothing
staging-only; the OTP bypass lives entirely in application runtime
behavior, gated by that one env var.

---

## 10. Rollback runbook

| Failure | Rollback |
|---|---|
| Backend does not start | `docker compose ... logs backend`; redeploy the previous known-good commit's images |
| Migration failure | Restore from the pre-deploy backup (§4) only if the migration left the schema in an inconsistent state — additive migrations that fail typically fail *before* altering anything (Prisma wraps each migration transactionally); check `prisma migrate status` first, most failures need only a fix-and-retry, not a restore |
| Admin does not start | Roll back the `admin` container only; no shared state with backend/web beyond the API contract |
| Admin login failure | Confirm `ADMIN_JWT_*` secrets are actually set (§6); if a real regression, roll back `backend` to the previous commit |
| Admin RBAC failure | Roll back `backend`; this is application-code behavior, not data |
| Media upload failure | Roll back `backend`; confirm MinIO connectivity (§5) independently — this could be an infra issue, not a code regression |
| Media public-serving failure | Roll back `backend`; media itself lives in object storage, unaffected by an app-level rollback |
| Home CMS API failure | Roll back `backend`; Customer's `homeCmsAdapter.ts` fallback to `home.mock.ts` is the built-in safety net if the API degrades before a rollback completes |
| Customer application failure | Roll back `web`; the static Home fallback (§0/§draft) covers a CMS-API-specific failure even without an immediate `web` rollback |
| Admin → Customer propagation failure | Roll back `backend` (both sides of the propagation path run through it); this is unlikely to be a partial/one-sided failure |
| Visual regression | Roll back `web` if structural; for isolated content issues, fix via Admin directly instead (fast, intended path) |
| Bad CMS content | Fix via the Admin Portal directly — deactivate or correct the row; not a deploy rollback at all |

**Point after which DB writes make rollback more complex**: once real
Admin/Customer usage begins writing new rows (Admin mutations, new
customer signups, new media uploads) *after* a deploy, a pure code rollback
to the previous commit is still safe (all migrations are additive — the
previous code version works fine against the new, superset schema) but a
**database rollback to the pre-deploy backup would lose that real,
post-deploy activity**. Treat the pre-deploy backup as a last resort for
catastrophic failure, not a routine rollback tool — prefer application/code
rollback for everything short of actual data corruption.

**Never** attempt to reverse an applied Prisma migration as the primary
rollback mechanism for an additive migration.

---

## 11. Production smoke test — smallest safe suite

Deliberately **not** staging's exhaustive authenticated QA suite — no
disposable Home CMS rows, no temporary admin accounts, no deactivating or
reordering real production content just to prove it can be done.

```bash
# READ-ONLY, all of these
curl -I https://biawin.ir/                          # Customer loads
curl -sS https://api.biawin.ir/api/health            # API health
curl -I https://admin.biawin.ir/                     # Admin loads (expect 307 -> /login)
curl -sS https://api.biawin.ir/api/v1/home/hero-cards       # Home CMS public reads
curl -sS https://api.biawin.ir/api/v1/home/service-banners
curl -sS https://api.biawin.ir/api/v1/home/service-mosaic-tiles
curl -sS https://api.biawin.ir/api/v1/home/news-articles
echo | openssl s_client -connect admin.biawin.ir:443 -servername admin.biawin.ir 2>/dev/null | openssl x509 -noout -issuer -subject -dates
curl -sSI -H "Origin: https://admin.biawin.ir" https://api.biawin.ir/api/v1/home/hero-cards | grep -i access-control-allow-origin
curl -sSI -H "Origin: https://evil.example.com" https://api.biawin.ir/api/v1/home/hero-cards | grep -i access-control-allow-origin || echo "correctly absent"
```

- **Admin login**: one real login as the seeded `SUPER_ADMIN`, confirming
  the account works — not a scripted flow, a manual sign-in.
- **Expected Admin RBAC boundary**: no new mutation needed to *prove* RBAC
  in production — it was already proven exhaustively on staging against
  identical application code (§0). A single manual confirmation that
  `SUPER_ADMIN` can view the dashboard is sufficient here.
- **Media existing asset serves**: fetch one of the URLs returned by the
  `service-banners` call above directly; confirm `200` and a real
  `image/webp` content type.
- **Customer Home renders CMS content / no broken images / no mobile
  overflow / no console 5xx**: one real, manual visit to `biawin.ir` in a
  browser (desktop and mobile viewport), the same structural checks proven
  automatable on staging (`docs/stage-5.22-staging-production-readiness-qa.md`
  §13/§14), done manually here to avoid running unattended browser
  automation against real production on day one.
- **Certificate correct**: covered by the `openssl s_client` line above.
- **CORS correct**: covered by the two `curl` lines above.

**If one Admin → Customer propagation mutation is genuinely wanted as
proof in production** (not required by this smoke suite — RBAC/propagation
mechanics were already proven exhaustively on identical code, on staging):
the safest, lowest-impact, fully-reversible method is a text-only change to
one Hero Card's `subtitle` (never `active`/`sortOrder`/`mediaAssetId`,
which have more visible blast radius), snapshotted and restored within
minutes, verified on the public API before and after. **Do not execute
this in production without the account owner's explicit approval at the
time** — this preflight does not pre-authorize it.

---

## 12. Monitoring window

| Window | Focus |
|---|---|
| T+5 min | Container health (`docker compose ps`), backend `/api/health`, immediate 5xx spike, container restart count |
| T+15 min | Admin auth failures, Customer auth failures (if Customer cutover included), database connection errors, Prisma errors in logs |
| T+30 min | Object-storage errors, missing/broken media reports, frontend runtime errors (real user reports or any error-tracking integration) |
| T+60 min | CPU/RAM/disk trend (not just a point-in-time check), DB connection pool exhaustion, sustained error-rate trend vs. the first 30 minutes |

```bash
# READ-ONLY monitoring commands
docker compose -f deploy/production/docker-compose.production.yml --env-file deploy/production/.env.production ps
docker compose ... logs backend --tail 200 | grep -iE "error|exception"
docker stats --no-stream
df -h /
```

Extend the window if anything in the first 30 minutes looks marginal —
these four checkpoints are a floor, not a ceiling.

---

## 13. Quality gates (this stage's repository changes)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 181 tests, 0 failures |
| `pnpm build` | PASS |

(Full output in the commit associated with this document — see §15.) This
stage added only deployment configuration and documentation
(`deploy/production/**`, this file); no application source changed, so
these gates were run to confirm nothing broke, not because application
logic changed.

---

## 14. Repository changes this stage

| File | What |
|---|---|
| `deploy/production/Dockerfile.backend` / `.web` / `.admin` | Duplicated from `deploy/staging/`, environment-agnostic content, path references updated |
| `deploy/production/docker-compose.production.yml` | New — production topology, proposed ports/subnet clearly marked pending §3 |
| `deploy/production/.env.production.example` | New — production env template, `STAGING_TEST_AUTH=false` explicit, SMS blocking-prerequisite flagged |
| `deploy/production/deploy.sh` | New — mirrors `deploy/staging/deploy.sh`'s fixed logic (re-exec safety, compiled seed commands) from day one |
| `docs/production-deployment-home-cms.md` | New — this document |
| Git tag `biawin-home-cms-v1` | New — immutable pointer to `2fc7e69` |

No production server, DNS, vhost, certificate, database, or storage was
touched. No secrets were created or committed — every `.env.production.example`
value is a placeholder or a non-secret default.

---

## 15. Repository operations performed

```bash
git tag -a biawin-home-cms-v1 2fc7e69 -m "Biawin Home CMS — production release candidate (Stage 5.22 closure)"
git push origin biawin-home-cms-v1
git add deploy/production docs/production-deployment-home-cms.md
git commit -m "..."
git push origin main
```

(Exact commit hash reported after this message — see the closing summary.)

---

## 16. Open questions — must be answered before proceeding past preflight

1. Is `62.204.61.18` the intended production server, or a separate,
   dedicated machine? (§2/§3)
2. What is the plan for `biawin.ir`'s existing live WordPress site? (§2/§3)
3. Once the host is confirmed: do the proposed ports/subnet in
   `docker-compose.production.yml` actually avoid collision with whatever
   else runs there? (§2/§3's discovery command answers this directly)
4. When will a real SMS provider be credentialed? Customer cutover should
   not proceed with `SMS_PROVIDER=mock` (§6/§9) — Admin/CMS-management
   deployment is not blocked by this, only real Customer login is.

---

## 17. Sign-off checklist (for the account owner, before execution)

- [ ] §3 discovery run, both plain-text questions answered
- [ ] Production server confirmed (same as staging, or a new host with access details shared)
- [ ] `biawin.ir` WordPress decision made
- [ ] Real production secrets generated (never copied from staging) and `deploy/production/.env.production` created on the server
- [ ] Real SMS provider credentialed (blocks Customer cutover only, not Admin/backend deploy)
- [ ] DB backup tooling in place and tested (§4)
- [ ] Object storage backup/rotation in place (§5)
- [ ] This runbook read end-to-end by whoever executes it
