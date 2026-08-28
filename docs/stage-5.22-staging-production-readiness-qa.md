# Stage 5.22 — Staging & Production Readiness QA

**Status: CLOSED — final real staging run passed.** This document supersedes
all earlier BLOCKED states from this same stage (retained below in §20 as
history, not as the current status).

| | |
|---|---|
| Tested revision | `db35c27` |
| Customer | `https://staging.biawin.ir` |
| API | `https://api-staging.biawin.ir` |
| Admin | `https://admin-staging.biawin.ir` |
| Final API/authenticated QA | **54 PASS, 0 FAIL, 0 NOT_TESTED** |
| Final browser/visual QA | **15 PASS, 0 FAIL, 0 NOT_TESTED** |
| Cleanup | **OK — staging restored to its approved state** |

---

## 1. Deployed revision

`db35c27` — the commit that fixed the six QA-tooling defects found across
this stage's earlier rounds (see §20). The application code the containers
run was last rebuilt from `a14e54a` (the MinIO credential-derivation fix);
every commit between there and `db35c27` is QA-tooling/docs-only and never
required a redeploy, confirmed by diff each time before declaring so.

## 2. Deployment / SSL state — **PASS**

- `admin-staging.biawin.ir` reverse-proxied correctly (HTTP → 307 → `/login`, HTTPS → 307 → `/login`).
- TLS certificate: Let's Encrypt, issuer `C=US, O=Let's Encrypt, CN=YR1`, subject `CN=admin-staging.biawin.ir`, verified on the wire (`openssl s_client` / strict `curl`, no `-k`).
- ACME/DCV path (`/.well-known/acme-challenge/`) confirmed bypassing the reverse proxy with a real static test file, independent of backend/admin container health.
- AutoSSL renewal requires an explicit `lshttpd` restart on this host (does not self-propagate) — documented as an operational note in `docs/10-release-process.md`, not a defect.

## 3. Infrastructure health — **PASS**

Backend, Customer Web, and Admin all healthy and responding; PostgreSQL,
Redis, and MinIO all confirmed healthy indirectly via successful DB-backed
reads/writes and real media upload/retrieval during the authenticated run
(no restart-loop or crash evidence at any point across this stage).

## 4. Database migrations / seed — **PASS**

All 7 Prisma migrations applied, no pending migrations. `prisma migrate
deploy` and the compiled seed script (`node dist/prisma/seed.js` — not
`prisma db seed`, which fails in the runtime image; see §20 lesson) both
confirmed idempotent across repeated real runs this stage.

## 5. Home media migration — **PASS**

17/17 approved static Home assets linked to real `MediaAsset` rows, MinIO
credential derivation fixed and verified (`STORAGE_ACCESS_KEY`/
`STORAGE_SECRET_KEY` structurally derived from `MINIO_ROOT_USER`/
`MINIO_ROOT_PASSWORD` at the compose level — see §20). Script confirmed
idempotent (skips rows that already have a `mediaAssetId`).

## 6. Admin authentication — **PASS**

| Check | Result |
|---|---|
| `SUPER_ADMIN` login | PASS |
| Wrong-password rejection | PASS |
| Admin token rejected on customer `/auth/refresh` | PASS |
| Admin logout invalidates refresh token | PASS |
| Customer token rejected on Admin `/auth/me` | PASS |

Both cross-boundary directions verified live — Admin and Customer identity
domains (separate JWT secrets, separate audience/issuer checks) are
genuinely isolated, not just isolated in source.

## 7. RBAC — **PASS**

| Check | Result |
|---|---|
| Temporary `CONTENT_EDITOR` provisioned, logged in | PASS |
| Temporary `SUPPORT_VIEWER` provisioned, logged in | PASS |
| `CONTENT_EDITOR` create/delete (News Article) | PASS |
| `SUPPORT_VIEWER` read (Hero Cards) | PASS |
| `SUPPORT_VIEWER` mutation → real HTTP 403 | **PASS** (the explicit forbidden-mutation proof this stage required) |
| Audit log route SUPER_ADMIN-only, `CONTENT_EDITOR` → 403 | PASS |
| Temporary accounts deleted, no residue | PASS |

A hidden button was never accepted as proof — every RBAC boundary above was
proven with a real HTTP call and a real status code.

## 8. Media Library — **PASS**

Valid PNG upload, magic-byte/signature validation (valid accepted, mismatched
rejected), public retrieval over the real media URL, `SUPPORT_VIEWER` upload
→ 403, disposable asset deleted and cleanup verified. The 17 approved Home
assets were never touched.

## 9. Home CMS CRUD — **PASS**

| Resource | Result | Note |
|---|---|---|
| Hero Cards | PASS | Architecturally 3 fixed unique `cardKey` slots — create/delete not applicable; edit, active-restore, and reorder-acceptance proven against an existing approved row instead (snapshotted, restored) |
| Service Banners | PASS | create/edit/active/reorder |
| Service Mosaic Tiles | PASS | create/edit/active/reorder |
| News Articles | PASS | create/edit/active/reorder |

## 10. Category UUID relationship proof — **PASS**

A real `Category.id` (UUID) was fetched and used as `categoryId` on Service
Banner/Mosaic Tile create; the persisted value was asserted equal to that
UUID. Display-name identity matching was never accepted anywhere in this
contract.

## 11. Admin → Customer propagation — **PASS** (the critical release gate)

| Class | Steps | Result |
|---|---|---|
| TEXT | snapshot → mutate → verify on public API → restore → verify restored | PASS |
| ACTIVE | snapshot → deactivate → disappears from public API → reactivate → reappears | PASS |
| REORDER | snapshot → swap → new order live on public API → restore → verify restored | PASS |
| IMAGE | snapshot → upload disposable asset → new URL live on public API → restore original → delete disposable | PASS |

Every mutation of approved content was restored and independently
re-verified against the real public API afterward — not assumed.

## 12. Customer authenticated QA — **PASS**

`STAGING_TEST_AUTH` fixed-phone login succeeded via the real API; the
resulting customer token confirmed rejected on the Admin identity boundary
(§6). Browser-layer login (below) independently confirmed the same flow
through the real UI.

## 13. Browser/Admin QA — **PASS**

Real login through the actual form (not an API shortcut), dashboard render,
Home Hero Cards list render, Media Picker upload proven **not** to submit the
outer Home form (the Stage 5.20 regression bar), no broken images, no
horizontal overflow, desktop + mobile screenshots captured, zero console
errors, zero failed/5xx requests.

## 14. Browser/Customer QA — **PASS**

Unauthenticated landing render, real `STAGING_TEST_AUTH` browser flow
(phone → OTP → verify, through the actual UI), authenticated Home renders
with real CMS content, no broken images, no overflow desktop or mobile,
screenshots captured both breakpoints, zero console errors, zero failed/5xx
requests.

## 15. Console / network QA — **PASS**

Zero real console errors and zero failed/5xx requests across both Admin and
Customer sessions in the final run. The earlier round's benign Next.js RSC
prefetch-cancellation false positives (§20) are gone — not by suppressing
real signal, but because the classifier now requires all three of
`net::ERR_ABORTED`, `resourceType === 'fetch'`, and a `_rsc=` query marker
before excluding a failed request; anything else still fails the run.

## 16. Audit log — **PASS**

A dedicated, self-contained probe (create → update → explicit delete, not
deferred to cleanup) confirmed CREATE, UPDATE, and DELETE audit entries
matching that exact row's id — precise, not inferred. A broader run-level
sanity check also passed.

## 17. Cleanup / data integrity — **PASS**

13 cleanup/restore operations registered, all completed successfully:
Hero Card text, News active state, Service Mosaic order, Service Banner
MediaAsset, Hero Card temporary edit, disposable Service Banner/Mosaic
Tile/News Article, disposable QA MediaAsset, propagation replacement
MediaAsset, temporary `CONTENT_EDITOR`/`SUPPORT_VIEWER` accounts, and the
audit-test disposable row. Staging's approved content state is unchanged
from before this run. The intentional, permanent `STAGING_TEST_AUTH` fixture
customer account remains by design (it is a reusable test fixture, not QA
residue).

## 18. Automated workspace quality gates — **PASS**

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS — 6/6 packages |
| `pnpm lint` | PASS — 0 errors (pre-existing `no-img-element` warnings unchanged) |
| `pnpm test` | PASS — 104 backend + 57 admin + 20 web = 181 tests, 0 failures |
| `pnpm build` | PASS — 3/3 |
| `deploy/staging/verify-runtime-image.sh` | PASS (confirmed green this stage) |
| `deploy/staging/run-authenticated-qa.sh` | **PASS — 54+15 = 69/69, real staging** |

## 19. Production configuration checklist

Confirmed present in the deployment contract (`deploy/staging/.env.staging.example`,
`backend/src/config/env.validation.ts`) — production needs its own distinct
values for every one of these, never copied from staging:

- `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET` (required, no default)
- Admin token TTLs
- `CORS_ORIGINS` (production's exact Customer + Admin origins)
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_ADMIN_API_URL` (build-time, not runtime)
- `PUBLIC_API_ORIGIN` (required — code default is `localhost:4000`)
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` **only** — do not also set `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` independently (§20 lesson; the compose file derives them structurally)
- `MEDIA_MAX_FILE_SIZE_BYTES`
- Admin domain (`admin.biawin.ir`)
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` (first `SUPER_ADMIN`, change password immediately after first login)

## 20. Previous Stage 5.22 defect history — all resolved

Every item below was found, root-caused against real source/real staging
evidence, fixed, and reverified — none is an open issue. Recorded here as
history, not as current status.

| # | Defect | Class | Fix |
|---|---|---|---|
| 1 | Backend runtime image couldn't run `prisma db seed` (needs `backend/src`, not copied into the image) | Deploy defect | Run compiled `dist/prisma/seed.js` instead |
| 2 | `deploy.sh` self-modifying-script hazard — a running process kept executing stale logic after its own `git reset --hard` rewrote the file underneath it | Deploy defect | Re-exec itself immediately after the git reset |
| 3 | MinIO/backend credential drift — `STORAGE_ACCESS_KEY`/`SECRET_KEY` and `MINIO_ROOT_USER`/`PASSWORD` were two independently-fillable secrets that could silently diverge | Deploy defect | Backend derives its credentials from the same `MINIO_ROOT_*` vars at the compose level |
| 4 | ACME challenge path was being proxied to Next.js instead of served statically | Deploy defect | Dedicated match-and-stop `RewriteRule` before any proxy rule |
| 5 | AutoSSL install succeeded but LiteSpeed kept serving the old cert | Ops defect | `whmapi1 restartservice service=lshttpd` after every AutoSSL install/renewal (documented, not a repo fix) |
| 6 | QA shell entrypoints committed as mode `100644`, not `100755` | Deploy defect | `git update-index --chmod=+x` |
| 7 | Admin `/me` 401 immediately after a successful login | **QA-tooling defect** | Runner didn't unwrap the backend's global `{success,data}` response envelope |
| 8 | Admin browser QA flagged 9 `net::ERR_ABORTED` requests | **QA-tooling defect** | Benign Next.js RSC prefetch cancellations misclassified as failures; narrowed the filter to the specific, provably-benign signal |
| 9 | Hero Card create → HTTP 500 | **QA-tooling defect** | Probe payload collided with `cardKey`'s real unique constraint (3 fixed, always-seeded slots) — see the non-blocking observation below |
| 10 | All four propagation snapshots failed ("no existing X") against data proven to exist | **QA-tooling defect** | Runner assumed the admin list endpoints returned a bare array; they return `{items,total,skip,take}` |
| 11 | Audit log missing a DELETE entry | **QA-tooling defect** | Assertion ran before this run's only (deferred) DELETE calls; replaced with a self-contained create→update→explicit-delete→verify probe |
| 12 | Reorder-propagation assertion checked the wrong array index | **QA-tooling defect** | Found only by running the repaired script against real local infra; fixed to compute the expected leader from actual resulting sort values |

**Non-blocking observation (carried forward, not fixed this stage):**
creating a `HomeHeroCard` with a `cardKey` that collides with one of the 3
already-seeded fixed slots surfaces an untranslated Prisma unique-constraint
violation as a raw HTTP 500 rather than a clean 409 Conflict — no
`PrismaClientKnownRequestError` translation exists anywhere in this backend.
**Classification: P2.** Not a release blocker: the real Admin workflow only
ever edits the 3 existing Hero Card rows, never creates a 4th; this path is
only reachable by a request no legitimate Admin UI flow constructs. Worth a
clean 409 translation as a future hardening pass, not urgent.

## 21. Visual fidelity — the one honest distinction in this report

Two different things are being asked, and this report answers them
separately rather than blurring them into one PASS:

**Structural / live browser visual QA: PASS.** Proven live, this run, against
real staging: real CMS content renders (not mock/fallback), all 17 approved
migrated images load with no broken `<img>` elements, no horizontal overflow
at either desktop or mobile width, Admin and Customer both render cleanly,
zero console/network errors during any of it. Real screenshots exist for
both apps at both breakpoints.

**Pixel-level automated baseline comparison: NOT TESTED — no baseline
artifact exists in the repository to compare against.** This is not a
software defect, and this report does not claim otherwise. No pixel-diff
tooling was run because there is nothing committed for it to diff against.

Given Stage 5.14.1 already received human visual approval, and Stage 5.21
deliberately changed only the data source (mock → real CMS) without any
intended UI/redesign change, and the structural checks above all pass
cleanly — **the remaining gap is a manual release-gate item, not an
engineering blocker**: one human comparing the real screenshots produced by
this run (`screenshots/` from `run-authenticated-qa.sh`'s browser layer)
against the Stage 5.14.1 approved baseline, to confirm no unintended visual
drift crept in alongside the CMS migration. This is a process/sign-off step,
not an unresolved P0/P1.

## 22. P0 / P1 / P2 issue table

| # | Issue | Class | Status |
|---|---|---|---|
| — | *(none)* | P0 | None open |
| — | *(none)* | P1 | None open |
| 1 | HeroCard duplicate `cardKey` surfaces raw HTTP 500 instead of 409 | P2 | Open, non-blocking, future hardening |
| 2 | Human visual sign-off (screenshots vs. Stage 5.14.1 baseline) | Process gate, not a defect | Outstanding — see §21 |

No P0 or P1 issue is open. Every defect found across this entire stage (12
items, §20) was resolved and reverified against real staging before this
closure.

## 23. Production rollout plan

1. **DB backup** — before touching anything.
2. **Object storage safety/backup check** — confirm the production bucket is isolated and backed up.
3. **Production environment validation** — confirm every var in §19 is set to production-specific values (not copied from staging).
4. **Admin secrets validation without exposing them** — confirm `ADMIN_JWT_*`/`ADMIN_SEED_*` are set and non-default, without printing values (`[ -n "$VAR" ]`-style presence checks only).
5. **Build the release candidate** — `docker compose build backend web admin` from the exact tagged/reviewed commit.
6. **Backend deploy.**
7. **`prisma migrate deploy`** — idempotent, safe to re-run.
8. **Compiled idempotent seed** — `node dist/prisma/seed.js`, never `prisma db seed` (§20 lesson).
9. **Home media migration** — `node dist/prisma/seed-home-media.js`, idempotent.
10. **Backend health check** before proceeding.
11. **Admin deploy.**
12. **Admin domain/vhost** — one-time setup, mirroring the staging addendum in `docs/10-release-process.md`.
13. **ACME exclusion** — the dedicated match-and-stop `RewriteRule` pattern (§20 lesson), applied from the start this time, not discovered the hard way.
14. **SSL/AutoSSL** — issue the certificate; restart `lshttpd` explicitly afterward regardless of AutoSSL's own reported status (§20 lesson).
15. **Verify the certificate on the wire** — `openssl s_client`/strict `curl`, not just AutoSSL's own success message.
16. **Admin login smoke test** — one real login.
17. **Admin RBAC smoke test** — one `CONTENT_EDITOR` mutation, one `SUPPORT_VIEWER` real 403.
18. **Media smoke test** — one upload, one retrieval.
19. **── Rollback checkpoint before Customer cutover ──** Backend + Admin are live and verified; Customer Web has not yet been cut over. This is the last point where rolling back is trivial (Customer traffic is still on the previous release, if any). Confirm everything above before proceeding past this point.
20. **Customer deploy.**
21. **Customer Home smoke test** — real render, real CMS content, no broken images.
22. **Admin → Customer propagation smoke test** — one real text change, confirmed live, restored.
23. **Visual smoke test** — screenshots at both breakpoints; human comparison against the approved baseline (§21) before declaring done, not after.
24. **Logs/monitoring** — watch error logs through the first real traffic window.
25. **Retain the static Home fallback (`home.mock.ts`) initially** — do not remove it as part of this rollout; it is the resilience net for a bad first day.

## 24. Rollback procedure

| Failure | Rollback |
|---|---|
| Backend failure | Redeploy the previous known-good commit's images; migrations are additive, no down-migration needed for an app-level rollback |
| Admin failure | Roll back the `admin` container only; no shared state with backend/web beyond the API contract |
| Admin authentication failure | Roll back `admin` (and `backend` if the JWT contract itself changed); confirm `ADMIN_JWT_*` secrets weren't rotated as part of the same deploy |
| CMS API failure | Roll back `backend`; Customer's `homeCmsAdapter.ts` fallback to `home.mock.ts` is the built-in safety net if the API degrades before a rollback completes |
| Media serving failure | Roll back `backend` only; media itself lives in object storage, unaffected |
| Visual regression | Roll back `web` (Customer) container to the pre-change build if structural; for isolated content issues, fix via Admin directly instead (see below) |
| Invalid content | Fix via the Admin Portal directly — deactivate or correct the row; this is the fast, intended path, not a deploy rollback |
| Customer CMS regression | Same as CMS API failure — roll back `backend`/`web`, rely on the static fallback in the interim |

**Never** attempt to reverse an applied Prisma migration as a rollback
mechanism — every migration through this stage is additive; a commit-level
rollback works against the current (superset) schema without needing a
down-migration.

## 25. Final recommendation

Every defect discovered across the entirety of Stage 5.22 — application,
deployment, and QA-tooling alike — was found through direct evidence,
root-caused against real source or a real reproduction, fixed, and
reverified against real staging or a real local infrastructure run. No P0
or P1 issue remains open. The one open P2 (§22) is a documented,
non-blocking robustness gap in a code path no real Admin workflow reaches.
The one outstanding item that is not a defect at all is a human visual
sign-off against the Stage 5.14.1 baseline — a process gate, explicitly
distinguished in §21 from an engineering blocker.

## 26. Final verdict

**BIAWIN HOME CMS RELEASE:**
**PRODUCTION READY**

**Outstanding manual action (not a blocker to this verdict, but required
before the human sign-off step in the rollout plan, §23 item 23):** a person
compares the real screenshots from this run's browser layer against the
approved Stage 5.14.1 visual baseline before Customer cutover completes.
