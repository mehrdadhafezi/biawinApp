# Stage 5.22 — Authenticated Staging QA Runner

One command, run on the staging server, that performs the authenticated
verification the Stage 5.22 QA report could not perform directly (see
`docs/stage-5.22-staging-production-readiness-qa.md` §0): Admin auth, RBAC,
Media Library, Home CMS CRUD, Admin→Customer propagation, audit logging,
Customer authenticated access, and a browser-driven visual/regression pass.

```bash
cd /srv/biawin-staging
./deploy/staging/run-authenticated-qa.sh
```

## Why this is structured as a script, not an interactive session

Every check this runner performs — logging into the real Admin Portal,
creating a temporary CONTENT_EDITOR/SUPPORT_VIEWER account, mutating and
restoring approved content — requires an authenticated session. That is
categorically different from an agent interactively entering credentials
in the moment: this is a fully committed, reviewable, deterministic script
that **you** choose to execute, the same way any Cypress/Playwright/CI test
suite performs its own login as a documented step. Nothing here happens
without you running the command yourself.

## What it does — two independent layers

### 1. API layer (`backend/scripts/staging-qa/authenticated-qa-runner.ts`)

Runs inside the real `backend` Docker image (`docker compose run --rm
backend`) — the same proven runtime packaging `deploy.sh` itself uses, with
direct Prisma/DB access. That access is load-bearing, not incidental: **this
codebase has no REST endpoint for creating an AdminUser** (confirmed by a
full-repo search), so the only way to provision temporary CONTENT_EDITOR /
SUPPORT_VIEWER accounts for a real RBAC test is directly through Prisma,
using the same `hashPassword()` util `prisma/seed.ts` already uses for the
real SUPER_ADMIN. Both temporary accounts are deleted in a `finally`-style
cleanup phase, always, even if an earlier check fails.

Everything else is a plain HTTP call — Node 20's built-in `fetch` /
`FormData` / `Blob` cover login, CRUD, multipart media upload, and
propagation checks with **zero new npm dependencies** in `backend/`.

Covers: Admin login/`/me`/wrong-password/logout/cross-boundary rejection,
RBAC (a real `SUPPORT_VIEWER` mutation attempt returning a real `403`),
Media upload/reject/delete, Home CMS CRUD for all four resources (create,
edit, active toggle, reorder endpoint, delete), the Category-UUID-not-
display-name relationship proof, four classes of Admin→Customer propagation
(text/active/reorder/image) each verified on the real public API and then
**restored and re-verified**, audit log entries, and a Customer
`STAGING_TEST_AUTH` login plus the reverse identity-boundary check.

**SERVICES-R5.1.1** (added after the R5.1 transaction foundation shipped):
exercises the real `POST /orders` boundary against the real deployed
backend and Postgres, using the `STAGING_TEST_AUTH` customer session —
unauthenticated rejection, discovery of a real Service the authoritative-
pricing rule must block, the 422 pricing-block itself, client `amount`
tampering rejected by the deployed `ValidationPipe` (`whitelist` +
`forbidNonWhitelisted`), unsupported-method / nonexistent-service /
merchant-mismatch rejection, idempotent-replay determinism for a blocked
request, an ownership-hijack attempt via a client-supplied `userId`, and a
direct Prisma read proving zero `Order`/`Payment`/`Installment` rows and no
`Wallet` balance change resulted from any of it. See
`docs/services-r5-1-transaction-domain-foundation.md` for what this proves
and what it deliberately cannot (a successful-Order idempotency replay,
blocked by there being no real Service with a usable price today).

### 2. Browser/visual layer (`deploy/staging/qa/browser/`)

Runs inside the official Playwright Docker image (`mcr.microsoft.com/
playwright:v1.48.2-jammy`) — **not** `backend`'s own `node:20-alpine` image,
because Playwright's Chromium binary needs glibc and does not run reliably
on Alpine's musl libc. This is an isolated, throwaway package (its own
`package.json`, not added to `backend/` or any app's dependencies) —
justified because visual/browser QA is a fundamentally different tooling
need from the application runtime, and a heavy, QA-only dependency has no
business in `backend/package.json` or `apps/admin/package.json`.

Performs a real login through the actual UI (not an API shortcut) for both
the Admin Portal and the Customer app, captures screenshots at mobile
(390×844) and desktop (1440×900) widths, checks for broken images and
horizontal overflow, captures console errors and failed/5xx network
requests, and re-proves the Stage 5.20 Media Picker regression bar
(uploading inside the picker must not submit the outer Home form) by
actually clicking through it in a real browser.

**What this layer does *not* do**: pixel-diff against the Stage 5.14.1
approved baseline. No baseline image exists as a repository artifact to
compare against. The screenshots prove the pages render with real CMS
content, no broken images, and no layout overflow at both breakpoints — a
human still needs to look at them next to the approved baseline for exact
visual sign-off. The script's own report says this explicitly; it is not
glossed over.

Selectors are grounded in the real component source (there is no
`data-testid`/ARIA-role convention anywhere in `apps/admin` or `apps/web` as
of this stage — confirmed by a full-tree search — so this matches on real
visible Persian text/labels/input types, each with a source comment citing
exactly where that text came from).

## Secret handling

- `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` are read from the real
  `deploy/staging/.env.staging` on the server (gitignored, never committed)
  — the API layer via `docker compose`'s normal `env_file:` mechanism (same
  as every other `docker compose run --rm backend` in this repo), the
  browser layer via the wrapper script reading those two lines directly
  from the file and passing them as container env vars, never echoing them
  to the terminal or a log.
- Neither script ever prints a raw access/refresh token. `authenticated-qa-
  runner.ts`'s report redaction strips anything JWT-shaped
  (`xxx.yyy.zzz`) and the literal `ADMIN_SEED_PASSWORD` value before
  writing any line to its report or the console.
- Temporary CONTENT_EDITOR/SUPPORT_VIEWER passwords are generated with
  `crypto.randomBytes(24)` in memory, never logged, never written anywhere
  — even if cleanup somehow failed to run, no predictable-password account
  would be left behind.
- Reports and screenshots are written to `/tmp/biawin-staging-qa/` (or
  `$QA_REPORT_DIR` if set) — a local, non-repo, non-committed path.

## Cleanup guarantee

Both layers use a register-then-run pattern: every mutation of *approved*
content registers its own restore action immediately after snapshotting the
original value, **before** making the mutation — so a `finally`-equivalent
phase runs every registered restore regardless of what happens afterward,
including a fatal error partway through. The API layer's report explicitly
states whether cleanup succeeded (`Cleanup: OK` / `Cleanup: FAILED`) and
treats a failed cleanup as a run failure (non-zero exit) even if every other
check passed — per this stage's explicit "if cleanup is incomplete, QA
RESULT MUST FAIL" requirement.

## If the backend container can't reach the public staging URLs

Both scripts default to the real public HTTPS origins
(`https://api-staging.biawin.ir`, `https://staging.biawin.ir`,
`https://admin-staging.biawin.ir`). Whether the `backend` container's
outbound internet egress actually reaches those from inside Docker was not
independently verified against this specific host's CSF configuration (the
documented CSF rule is scoped to host-level INPUT/OUTPUT for specific
ports/subnet, not necessarily container-to-internet egress through Docker's
own NAT/FORWARD chain — these are often, but not always, independent). If
the API layer fails immediately with a connection error rather than a real
assertion failure, override the targets to the internal Docker network
instead, no file edits needed:

```bash
QA_API_ORIGIN=http://backend:4000 \
QA_CUSTOMER_ORIGIN=http://web:3000 \
QA_ADMIN_ORIGIN=http://admin:3000 \
  ./deploy/staging/run-authenticated-qa.sh
```

(The browser layer's Customer/Admin login flow specifically needs the real
public origins — the internal service names have no TLS/LiteSpeed layer in
front of them — so this fallback is really only for the API layer if it's
ever needed. The browser layer's Playwright container runs on Docker's
default bridge network, which has normal outbound internet access.)

## Reading the output

`./deploy/staging/run-authenticated-qa.sh` prints both reports' paths and
the screenshots directory at the end, and exits non-zero if either layer
had a required-check failure or an incomplete cleanup. A `NOT_TESTED`
result (as opposed to `PASS`/`FAIL`) means a prerequisite for that specific
check didn't hold — e.g. `STAGING_TEST_AUTH` not being enabled on this
deployment — and is reported plainly, not silently skipped.

## Integrating results back into the Stage 5.22 report

After a run, hand the two report files (and, if useful, the screenshots)
back — they get incorporated into
`docs/stage-5.22-staging-production-readiness-qa.md`, each previously
`NOT TESTED` section reclassified `PASS`/`FAIL` based on the real output,
and the final release verdict re-issued from there.
