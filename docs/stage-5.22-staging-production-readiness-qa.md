# Stage 5.22 — Staging & Production Readiness QA

Performed against the **real deployed staging environment**, 2026-08-27.

## 0. Read this first — scope and a hard constraint on this QA run

This report is honest about what was actually exercised live versus what
could not be, rather than inferring pass results from source code alone
(per this stage's own explicit requirement).

**A significant portion of the requested QA (sections 4-9, 15, 18 of the
task spec) requires an authenticated session** — either a Customer OTP
login or an Admin email/password login on real staging. I do not enter
credentials (real or test/OTP) into any login form, on any environment,
including staging — this holds regardless of whether the credentials are
real secrets or an intentionally-built test bypass (`STAGING_TEST_AUTH`),
and it is not a judgment call available to be overridden for this task.
This is a fixed operating boundary I do not have discretion to relax, not
a technical limitation of the tooling.

**Practical effect**: I was able to fully verify staging's public,
unauthenticated surface — the actual REST APIs Customer Home consumes, the
security boundary around `/admin/**`, CORS, media serving, SSL, and all
automated repository quality gates — live, against the real deployed
environment. I was **not** able to view the authenticated Customer "Home"
screen itself (navigating there while logged out redirects to the public
landing page), the Admin Portal's authenticated screens, or perform any
mutation, propagation, RBAC, Media Library, Audit Log, or visual-fidelity
check that requires being logged in. Screenshot capture was also
unavailable in this session's browser pane (compositing did not activate),
so even the pages I could reach were inspected via DOM/accessibility-tree
and network-log extraction, not pixel comparison.

Every section below is marked **PASS**, **FAIL**, or **NOT TESTED**
per the task's own requirement, and **NOT TESTED** sections state plainly
why and whether that blocks release. Given the task's own stated
production-readiness bar explicitly requires Admin auth, RBAC, Media,
Admin→Customer propagation, and visual fidelity to be *verified* (not
inferred), and none of those could be verified by me, **the honest
conclusion is that this run cannot certify production readiness on its
own** — see §26 for exactly what closes the gap.

---

## 1. Deployed Version Verification

| Item | Value |
|---|---|
| Repository HEAD (this session) | `6a08e38` |
| Backend/Customer Web/Admin container build revision | `a14e54a` |

**Status: PASS**, with an important distinction. `a14e54a` (the MinIO
credential-derivation fix) is the last commit that changed anything
`deploy.sh` rebuilds images from, and is the commit `deploy.sh` was
confirmed to build and deploy successfully against in this conversation
(all 7 steps, media migration linking 17 assets). The two commits since
(`12a30c3`, `6a08e38`) are **documentation-only** — the ACME-exclusion
proxy.conf fix and the LiteSpeed-restart-after-AutoSSL note — neither
touches `backend/`, `apps/web/`, `apps/admin/`, or any Dockerfile, so no
redeploy was required or performed for them, and the running containers
are correctly still built from `a14e54a`. This was **not** independently
verified via SSH/`docker inspect` (no SSH access in this session) — it is
based on this conversation's own record of what was deployed and what
changed after. I confirmed no drift risk by re-diffing `12a30c3` and
`6a08e38` against `a14e54a` — both are `docs/10-release-process.md` only.

---

## 2. Infrastructure Health

| Component | Result | Basis |
|---|---|---|
| Backend (`api-staging.biawin.ir`) | **PASS** | `GET /api/health` → `200 {"status":"ok"}` |
| Customer Web (`staging.biawin.ir`) | **PASS** | `GET /` → `200`, page renders |
| Admin Portal (`admin-staging.biawin.ir`) | **PASS** | `GET /` → `307` → `/login`, login page renders, RTL confirmed (`<html dir="rtl" lang="fa">`) |
| PostgreSQL | **PASS (inferred)** | Real DB-backed CMS data returned correctly on every Home endpoint (§3) — not reachable without a live, correctly-migrated Postgres |
| Object storage (MinIO) | **PASS (inferred)** | Media URLs return real image bytes (`Content-Type: image/webp`, correct `Content-Length`) — see §3 |
| Redis | **NOT independently confirmed** | No direct check available without SSH; indirect evidence only (`X-RateLimit-*` headers are present and decrementing correctly across requests, which this stack backs with Redis — consistent with, not proof of, health) |

No restart-loop or crash evidence found — every endpoint responded
promptly and consistently across repeated requests in this session.

---

## 3. Backend Public API QA — **PASS**

Live `curl` against `https://api-staging.biawin.ir`:

| Endpoint | HTTP | Items | Order | Notes |
|---|---|---|---|---|
| `/api/v1/home/hero-cards` | 200 | 3 | `sortOrder` 0,1,2 | No `image` field (by design — hero cards use `colorPreset`, not media) |
| `/api/v1/home/service-banners` | 200 | 5 | `sortOrder` 0-4 | Every row has a real `categoryId` (UUID), never a display-name match |
| `/api/v1/home/service-mosaic-tiles` | 200 | 4 | `sortOrder` 0-3 | Real `categoryId` per row |
| `/api/v1/home/news-articles` | 200 | 8 | `sortOrder` 0-7 | |

**Media-count cross-check**: 5 + 4 + 8 = **17** media-bearing rows, exactly
matching the Stage 5.21 migration's own "17 assets linked" report — a real
data-integrity confirmation, not just a shape check.

Spot-checked one resolved media URL directly:
```
GET https://api-staging.biawin.ir/api/v1/media/5191ba0c-....webp
→ 200, Content-Type: image/webp, Content-Length: 39576, Cross-Origin-Resource-Policy: cross-origin
```
Correct content type, correct cross-origin policy (needed for `<img>`
loads from the Customer/Admin origins — the Stage 5.21 Helmet fix), long
cache lifetime set appropriately.

No `isActive`/inactive rows appeared in any response — consistent with the
public endpoints filtering server-side, as designed.

---

## 4. Admin Authentication QA — **NOT TESTED (blocked by §0)**

**What was verified without logging in**:
- Login page loads over HTTPS, renders correctly, RTL — **PASS**.
- `GET /api/v1/admin/auth/me` with no token → **`401`** — **PASS** (correctly rejects unauthenticated requests).
- `GET /api/v1/admin/home/hero-cards` with no token → **`401`** — **PASS** (admin-scoped routes reject unauthenticated access).

**What was not tested**: valid login, wrong-password rejection, session
restoration, logout, expired-session behavior, cross-boundary token
rejection (customer token on admin route and vice versa) — all require an
authenticated session on one or both sides.

**Does this block release?** The unauthenticated boundary (the part most
security-critical to verify externally) checks out. The interactive login
flow itself is standard, well-tested Next.js/NestJS JWT auth with unit
test coverage (`admin-auth.service.spec.ts`, `admin-auth.controller.spec.ts`,
`AdminLoginForm.test.ts`, all passing per §21) — low incremental risk, but
**not the same as a live confirmation**, which the task explicitly
requires. Recommend the account owner performs one real login/logout cycle
before go-live; low effort, closes a real gap.

---

## 5. RBAC QA — **NOT TESTED (blocked by §0)**

Cannot create or use `CONTENT_EDITOR`/`SUPPORT_VIEWER` test accounts
without first being logged in as `SUPER_ADMIN`. Backend authorization is
covered by unit tests (`admin-roles.guard.spec.ts`, `home-admin-permissions.spec.ts`,
`rbac.test.ts`, all passing), but **the explicit ask — a real forbidden
mutation attempt returning a real HTTP 403 on real staging — was not
performed.** This is a real gap for a security-sensitive area; recommend
closing it before go-live (see §26 checklist).

---

## 6. Media Library QA — **NOT TESTED (blocked by §0)**

Requires an authenticated Admin session for every listed check (upload,
rejection, delete, RBAC, audit log). Confirmed indirectly via §3 that the
storage/serving pipeline itself works end-to-end for the 17 already-linked
assets. Upload/delete/validation flows were not exercised live.

---

## 7. Home Admin Management QA — **NOT TESTED (blocked by §0)**

Requires Admin login for all four resource CRUD flows. Covered by passing
unit/component tests for each resource's form and list page (§21), but not
exercised against real staging.

---

## 8. Media Picker QA — **NOT TESTED (blocked by §0)**

Same constraint. The Stage 5.20 regression this specifically asks about
(upload-inside-picker submitting the outer form) has a dedicated passing
test (`MediaPickerField.test.tsx`, `MediaPickerModal` coverage) confirming
the `stopPropagation()` fix remains in place in the current build, but this
was not re-verified interactively on real staging.

---

## 9. Admin → Customer Propagation — **NOT TESTED (blocked by §0)**

This is explicitly called out as a **CRITICAL release gate** in the task,
and it is the single largest gap in this report: it requires an
authenticated Admin mutation *and* viewing the authenticated Customer Home
screen afterward — both blocked by §0. **This did not happen in this
session.** The data path each change would travel (Admin save → Postgres →
public Home API → Customer Home) is individually confirmed working end to
end (§3 proves the read side with real seeded content), but the write side
and the live re-render were not exercised.

---

## 10. Customer Home CMS Source Verification — **PARTIAL / NOT TESTED**

**Confirmed (PASS)**: the public API layer Customer Home is built to
consume is live, correctly shaped, correctly ordered, and returns real
seeded CMS content with resolved media URLs (§3) — this is the backend
half of "CMS-driven," and it's real, not inferred from source.

**Not confirmed**: that the actual rendered Customer Home page currently
consumes this API (vs. a fallback or stale cache) in the live browser,
because reaching the authenticated `/home` route was not possible (§0) —
navigating there while logged out redirects to the public landing page,
which is expected app behavior, not a bug, but it means the render side of
this check is unverified live this session.

---

## 11. Fallback / Resilience QA — **NOT TESTED — requires controlled failure injection**

Per the task's own instruction, deliberately breaking the public Home API
on shared, live staging (which also serves the Admin Portal and other
in-flight verification) was not attempted. **Does this block production?**
No — the fallback mechanism itself is a well-defined, testable code path
(`apps/web/src/components/home/homeCmsAdapter.ts`'s `try/catch` +
`home.mock.ts` fallback) with existing unit coverage
(`homeCmsAdapter.test.ts`, passing), and this class of risk is best
validated in a dedicated non-shared environment or via a scoped
integration test that mocks a failed fetch, not by breaking a shared host.
Recommend adding that as a follow-up test, not as a go-live blocker.

---

## 12-14. Customer Home Visual Fidelity, Image Fidelity, Responsive QA — **NOT TESTED (blocked by §0)**

Both blockers apply here simultaneously: the authenticated `/home` route
was unreachable without login, and this session's browser pane did not
composite frames for screenshot capture even on pages that were reachable.
**This is the task's own MANDATORY section, and it did not happen.** No
visual comparison against the Stage 5.14.1 baseline — desktop or mobile —
was performed against real staging in this session. Source-level
inspection (already done in Stage 5.21's own QA) is not a substitute per
this stage's explicit instructions, so nothing here is marked PASS on that
basis.

---

## 15. Admin UI QA — **PARTIAL**

**PASS**: login page loads over HTTPS, correct RTL (`dir="rtl"`,
`lang="fa"`), correct Persian copy (`ایمیل` / `رمز عبور` / `ورود`), no
console errors on the login page itself.

**NOT TESTED**: everything past login (sidebar, Home navigation,
dashboard, Media Library, list/form pages, responsive behavior of
authenticated screens) — blocked by §0.

---

## 16. Console / Network QA

**Customer Web** (`staging.biawin.ir`, unauthenticated landing page):
one console error was observed — `Failed to load resource: the server
responded with a status of 401` — the specific request could not be
isolated in the network log after a client-side redirect from `/home` to
`/` occurred (the log appears scoped to the post-redirect page). Most
consistent explanation: an anonymous-session check (e.g. an auth/`me`-style
probe) that is expected to 401 for a logged-out visitor. **Classified P2
(non-blocking)** — flagged rather than dismissed, since it wasn't
root-caused with certainty; worth a 5-minute look by whoever has full
DevTools access, not a release blocker on the evidence available.

**Admin Portal** (login page only, unauthenticated): no console errors, no
CORS/CORP errors observed.

**No other errors, no CORS failures, no CORP failures, no broken media
requests, no request storms** observed on the pages actually reachable
this session. Authenticated-page console/network behavior (hydration,
auth-refresh loops, CMS-call patterns inside the Admin/Home CMS forms) —
**NOT TESTED**, blocked by §0.

---

## 17. Security Sanity QA

| Check | Result |
|---|---|
| Admin JWT secret separate from customer JWT secret | **PASS** (confirmed in repo: distinct `ADMIN_JWT_ACCESS_SECRET`/`ADMIN_JWT_REFRESH_SECRET`, never reused — `.env.staging.example`, `env.validation.ts`) |
| `/admin/**` routes require Admin JWT | **PASS** — live 401 without token (§4) |
| Admin CORS restricted to intended origins only | **PASS** — live-verified: `https://admin-staging.biawin.ir` and `https://staging.biawin.ir` get `Access-Control-Allow-Origin`; an arbitrary third-party origin (`https://evil.example.com`) gets **no** such header |
| Media upload size limit configured | **PASS (config-verified)** — `MEDIA_MAX_FILE_SIZE_BYTES` set in `.env.staging`; not live-tested (needs Admin login) |
| MIME/magic-byte validation active | **NOT TESTED** — needs Admin login to attempt an upload |
| Admin password hashes never exposed | **NOT TESTED live**; statically true — no endpoint in the codebase returns `passwordHash` (`admin-auth.service.ts`'s DTOs strip it), confirmed by source inspection, not a live probe |
| No DB/object-storage credentials exposed to the browser | **PASS** — inspected every response header/body reachable this session (public Home APIs, media headers, landing/login page HTML) for `DATABASE_URL`, `STORAGE_*`, `MINIO_*`; none present, as expected (`STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` are server-only per this stage's own earlier fix) |
| Audit trail created for Admin mutations | **NOT TESTED** — needs Admin login (§18) |

No destructive testing performed, per instruction.

---

## 18. Audit Log QA — **NOT TESTED (blocked by §0)**

Requires Admin login to generate any mutation to audit. Backend coverage
exists (`admin-audit-log.service.spec.ts`, `admin-audit-log.controller.spec.ts`,
including a deliberately-simulated write failure — both passing), not
exercised live.

---

## 19. Data Cleanup

**Nothing to clean up.** No QA mutations, uploads, or accounts were
created against real staging in this session, because no authenticated
action was performed at all (§0). Staging's content is exactly as it was
after the Stage 5.21 media migration — nothing here needs restoring.

---

## 20. Performance Sanity

Within what was observed (public Home APIs, landing page, admin login
page): no duplicate/looping requests, no request storms, no excessive
`/me` calls (none were made — no session existed to poll), no obviously
oversized assets (largest media response seen: ~39KB webp). No CMS
integration performance regression found in the surface actually
reachable. Authenticated-flow performance (Admin form saves, Media Picker
interactions) — **NOT TESTED**.

---

## 21. Automated Quality Gates — **PASS**

Run workspace-wide against HEAD `6a08e38`:

| Gate | Result |
|---|---|
| `pnpm typecheck` | **PASS** — 6/6 packages |
| `pnpm lint` | **PASS** — 0 errors; 11 pre-existing `no-img-element` warnings (unchanged baseline, not new) |
| `pnpm test` | **PASS** — 104 backend + 57 admin + 20 web = 181 tests, 0 failures |
| `pnpm build` | **PASS** — 3/3 (backend, web, admin) |
| `deploy/staging/verify-runtime-image.sh` | **PASS** — confirmed green earlier in this engagement against commit `a14e54a` (the deployed application revision); not re-run this session since no backend/deploy code changed since then |

---

## 22. Production Configuration Review — **PASS (contract present)**

Confirmed the following are already part of the deployment contract
(`deploy/staging/.env.staging.example`, `backend/src/config/env.validation.ts`,
`docker-compose.staging.yml`) and will need real, distinct values for a
production environment — none inspected here contain real secrets:

- `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET` (required, no default, min 16 chars — backend fails to boot without them)
- Admin token TTLs (`ADMIN_JWT_ACCESS_TTL`, `ADMIN_JWT_REFRESH_TTL_DAYS`)
- `CORS_ORIGINS` (must list production's exact Customer + Admin origins)
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_ADMIN_API_URL` (build-time, not runtime — must be baked in at image build)
- `PUBLIC_API_ORIGIN` (required — code default is `localhost:4000`, silently wrong anywhere else)
- `STORAGE_ENDPOINT`/`STORAGE_REGION`/`STORAGE_BUCKET`/`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (backend's own `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` are now derived at the compose level from the MinIO root credentials — do not set them independently, see §26 rollout step 6 and the Stage 5.22 MinIO fix)
- `MEDIA_MAX_FILE_SIZE_BYTES`
- Admin domain (`admin.biawin.ir` per the Environments table in `docs/10-release-process.md`)

---

## 23. Production Rollout Plan

Ordered, incorporating every real lesson from this stage's actual staging
deployment (not hypothetical):

1. **Backup** the production DB before touching anything.
2. **Object storage safety check** — confirm the production bucket/volume
   is not shared with anything else and is itself backed up; this stage's
   MinIO work never touched staging's existing bucket contents, and
   production should get the same guarantee.
3. **Provision production secrets** — generate fresh, production-only
   `ADMIN_JWT_*`, `JWT_*`, `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, etc.
   Set **only** `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` for object storage
   — do **not** also set `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY`; the
   compose file derives them (Stage 5.22 finding — setting both
   independently is exactly what broke staging's first media-migration
   attempt with `SignatureDoesNotMatch`).
4. **Deploy backend** — build the runtime image, confirm
   `deploy/staging/verify-runtime-image.sh`-equivalent passes against the
   production Dockerfile/compose *before* touching the live database.
5. **Run `prisma migrate deploy`** — idempotent, safe to run every deploy.
6. **Run the idempotent seed** (`node dist/prisma/seed.js`, not
   `prisma db seed` — Stage 5.22 finding: the runtime image doesn't
   contain `backend/src`, so the ts-node-based CLI wrapper fails there;
   only the compiled script works).
7. **Run the Home media migration** (`node dist/prisma/seed-home-media.js`)
   — idempotent, skips already-linked rows.
8. **Confirm backend health** (`/api/health`) before proceeding.
9. **Deploy Admin** — build/start the `admin` container.
10. **Admin domain/vhost/SSL** — expect the same LiteSpeed-specific
    subtleties found on staging: use a dedicated match-and-stop
    `RewriteRule` for `/.well-known/acme-challenge/` (not a negated
    `RewriteCond` — proven unreliable on this LiteSpeed build), and
    **explicitly restart `lshttpd`** (`whmapi1 restartservice
    service=lshttpd`) after AutoSSL reports success — it does not reliably
    self-propagate to LiteSpeed on this host.
11. **Admin auth/RBAC smoke test** — a real login, one mutation per role,
    one confirmed 403 for `SUPPORT_VIEWER` — do this live, not inferred;
    this is exactly the gap this staging QA run could not close (§0/§26).
12. **Deploy Customer Web.**
13. **Customer Home visual smoke test** — live, against the actual
    rendered page, by someone who can log in and take real screenshots;
    same gap as above.
14. **Admin → Customer propagation check** — one real text change, one
    real active-state toggle, confirmed live in the Customer app.
15. **Monitoring/log review** — watch error logs for the first real
    traffic window before declaring done.
16. **Keep the static Home fallback (`home.mock.ts`) in place initially**
    — it's the resilience net if the CMS API has a bad first day; don't
    remove it as part of this rollout.

---

## 24. Rollback Plan

| Failure | Rollback |
|---|---|
| Admin container fails/misbehaves | `docker compose ... build backend web admin && docker compose ... up -d backend web admin` at the previous known-good commit (application rollback only — no DB change) |
| Backend failure | Same — checkout previous commit, rebuild, redeploy; migrations are additive, never need reversing for an app-level rollback |
| Customer CMS integration failure (bad render, broken data) | The `homeCmsAdapter.ts` fallback to `home.mock.ts` is the built-in safety net — if the *API* is the problem, Customer Home should already be degrading gracefully; if the *adapter/component* is the problem, roll back the Customer Web container only |
| Media serving failure | Roll back `backend` only; media itself lives in object storage, unaffected by an app-level rollback |
| Home visual regression | Roll back Customer Web container to the pre-Stage-5.21 build if the regression is structural; for isolated content issues, fix via Admin (see below) instead of a deploy rollback |
| Bad CMS content (not a code bug) | Fix via the Admin Portal directly — deactivate or correct the offending row; this is the intended, fast path and doesn't require touching deployment at all |

**Do not** attempt to reverse an applied Prisma migration as a rollback
mechanism — every migration in this stage was additive; a code-level
rollback to a previous commit works against the current (superset) schema
without needing a down-migration.

---

## 25. Issue Classification

**No new P0 or P1 defect was found** in anything actually exercised this
session — every live check performed passed. The blocking issue for this
report's verdict is **not a discovered defect**; it is that this session's
operating constraints prevented completing the task's own mandatory
authenticated verification (§0).

| # | Item | Class | Why |
|---|---|---|---|
| 1 | Admin auth/RBAC/Media/Home CRUD/Propagation/Audit Log not live-verified | **P1 (release blocker)** | Explicitly required by this task's own production-readiness bar; not a code defect, a verification gap |
| 2 | Customer Home visual fidelity vs. Stage 5.14.1 baseline not live-verified | **P1 (release blocker)** | Explicitly marked MANDATORY by this task |
| 3 | One unexplained 401 console error on the Customer landing page | **P2** | Not root-caused with certainty; most likely an expected anonymous-session probe, not a bug |
| 4 | Fallback/resilience not live-tested | **P2, accepted gap** | Correctly deferred per this task's own instruction not to break shared staging; existing unit coverage coverage is adequate for now, live/injected test recommended as follow-up, not a blocker |

---

## 26. What closes the gap

Everything below requires a real login and was explicitly off-limits to me
this session (§0). This is the concrete, minimal list to actually reach a
verified PRODUCTION READY verdict:

1. Log into `https://admin-staging.biawin.ir` as `SUPER_ADMIN`; confirm
   login works, wrong password fails, logout works, reload preserves
   session.
2. Create one `CONTENT_EDITOR` and one `SUPPORT_VIEWER` test account;
   confirm `SUPPORT_VIEWER` gets a real `403` on a mutation attempt (both
   UI-hidden and direct API call); delete the test accounts after.
3. In the Admin Portal: change one Home Hero Card title, deactivate one
   Service Banner, reorder the Service Mosaic, swap one News article's
   image via the Media Picker — then open `https://staging.biawin.ir` (logged
   out is fine for this part) and confirm each change appears; **restore
   every value afterward**.
4. Upload one disposable test image via the Media Library, confirm it
   previews and appears in the list, then delete it; attempt one invalid
   file type and confirm rejection.
5. Take real screenshots of `https://staging.biawin.ir`'s Home screen (desktop
   and mobile) and compare against the Stage 5.14.1 baseline per this
   task's own checklist (§12 of the original task spec).
6. Report results back — I can incorporate them into this document and
   re-issue the verdict without repeating the parts already confirmed here.

---

## Final Verdict

**BIAWIN HOME CMS RELEASE:**
**BLOCKED — mandatory authenticated verification (Admin auth, RBAC, Media Library, Home CRUD, Admin→Customer propagation, visual fidelity) could not be performed in this session; every unauthenticated check performed (infrastructure, public API, security boundary, CORS, media serving, SSL, quality gates) passed with no defects found**

This is not a statement that the system is broken — nothing tested failed.
It is a statement that a required part of this stage's own verification
checklist genuinely did not happen, and marking it PASS anyway would be
exactly the kind of inferred, unverified result this task explicitly
prohibited. §26 is the specific, short list that closes it.
