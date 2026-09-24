# Stage 5.17-D — Home Admin Browser QA: Implementation Result

**Browser QA was NOT run in Stage 5.17-D.** This stage only implements the executable verifier and its
infrastructure. Nothing was executed against staging, nothing was deployed, no real Home/catalog data was
touched. **Stage 5.17 is not closed by this stage.**

## 1. What was implemented

| Piece | File |
|---|---|
| Safety contract (unchanged logic, ERR-04 title corrected) | `backend/scripts/staging-qa/stage-5-17-c/qa-contract.ts` |
| Pure orchestration helpers (run-file names, env flags, capabilities, slug guard, redaction, screenshot names, reorder-payload analysis, outcome merge, tally) | `backend/scripts/staging-qa/stage-5-17-c/qa-orchestration.ts` |
| Fixture control: `setup` / `teardown` / `verify` (backend image, Prisma + storage) | `backend/scripts/staging-qa/stage-5-17-c/control.ts` |
| Playwright verifier — all 46 matrix tests, mutation firewall, stubs/captures, screenshots | `deploy/staging/qa/browser/stage-5-17-c/verifier.ts` |
| Typecheck shims (overwritten by the real files in the Docker build context) | `deploy/staging/qa/browser/stage-5-17-c/{qa-contract,qa-orchestration}.ts` |
| Verifier image / strict tsconfig | `deploy/staging/qa/browser/Dockerfile.stage-5-17-c`, `tsconfig.stage-5-17-c.json` |
| Server wrapper | `deploy/staging/run-stage-5-17-c-browser-qa.sh` |
| Manual-only workflow | `.github/workflows/stage-5-17-c-home-admin-browser-qa.yml` |
| Unit tests for the new helpers | `backend/src/qa-contract/stage-5-17-d-orchestration.spec.ts` |

No backend application code, Prisma schema/migration/seed, catalog code or Admin UI code was modified. No new
framework: Playwright 1.48.2 in the same `mcr.microsoft.com/playwright:v1.48.2-jammy` image as
`deploy/staging/qa/browser`.

## 2. Workflow and how to run it

* Workflow name: **Stage 5.17-C — Home Admin Browser QA** (`workflow_dispatch` only; never push/PR/schedule).
* Manual trigger: GitHub → **Actions → "Stage 5.17-C — Home Admin Browser QA" → Run workflow**. Inputs (both default `false`):
  * `allow_reorder_metadata_touch` → `STAGE517C_ALLOW_REORDER_METADATA_TOUCH`
  * `provision_temporary_roles` → `STAGE517C_PROVISION_ROLES`
* Uses the existing `STAGING_SSH_HOST/PORT/USER/PRIVATE_KEY` secrets only. Never deploys/restarts, never runs
  `authenticated-qa-runner.ts` / `run-authenticated-qa.sh`. Uploads a sanitized artifact
  (`stage-5-17-c-home-admin-browser-qa-report`) with `if: always()`; if SSH fails it writes a
  `CONTROLLED-FAILURE.txt` report instead.
* Direct execution on the server (from `/srv/biawin-staging`):

```bash
STAGE517C_ALLOW_REORDER_METADATA_TOUCH=true STAGE517C_PROVISION_ROLES=true ./deploy/staging/run-stage-5-17-c-browser-qa.sh
```

**A PASS verdict requires both flags `true`**: without the reorder flag REO-02 is BLOCKED; without temporary
roles RBAC-01..04 are BLOCKED (no existing SUPPORT_VIEWER/CONTENT_EDITOR account is assumed and none is
fabricated). BLOCKED is never a pass — the run exits non-zero and says why.

## 3. Lifecycle

`1` clear throttler keys → `2` build backend + verifier images → `3` **setup** (login, BEFORE checksums + Home
baseline + public counts, fixtures, optional temporary roles, `manifest.json`) → `4` **browser tests** →
`5` **teardown** → **verify**. Teardown and verify run from an `EXIT/INT/TERM` trap, so they execute even when
setup or the browser crashed; a missing setup is reported as BLOCKED/NOT_RUN for all 46 tests.

## 4. Fixtures

* Run id `<epoch-ms>_<hex>`; tag `stage517c_qa_<run-id>`; `bodySlug` only via `makeQaBodySlug` (`stage517c-qa-<run-id>-<suffix>`), asserted against `^[a-z0-9]+(-[a-z0-9]+)*$` before every News POST.
* Every created object is registered immediately and `state.json` is rewritten after every registration. Objects created by the UI are registered the moment the creating response arrives (`dynamic-fixtures.ndjson`) and, as a second net, adopted at teardown by a tag/slug sweep.
* Created: media A/B/C/D/D2/E (+ tagged pad uploads if the active library has < 60 assets, so pagination is exercisable), banners, mosaic tile, news rows. Categories are only *read* (no category is created or changed; `categories` has no delete endpoint). Media C is soft-deleted through the API; the "legacy reference" rows are pointed at it by direct Prisma **only** on current-run QA rows after an ownership proof and read-back.
* A fixture that cannot be created is recorded with its reason; dependent tests become **NOT_RUN** (never run with undefined ids).
* All QA rows are created inactive (`active:false`); the firewall blocks a create with `active:true`.

## 5. Mutation firewall

A context-level route registered first (so it runs last) applies `decideMutation` from `qa-contract.ts` to every
non-GET request for the whole run. Blocked → aborted, recorded in `firewall-events.json`, the running test FAILs,
the verdict FAILs. Upload file names must carry the QA tag. Direct API calls made by the verifier go through the same
`decideMutation`. Per-test stubs/captures are page-level, so they run before the firewall and never reach the backend.

## 6. Hero handling (no real Hero row is ever mutated)

HERO-01 observation (all keys occupied → disabled submit); HERO-02 validation only, PUT captured+aborted (0 requests);
HERO-03 stubbed 409. Reported per test in the final report (`heroReport`).

## 7. Reorder handling

`STAGE517C_ALLOW_REORDER_METADATA_TOUCH=false` by default and never auto-enabled. The Admin UI always sends the
whole displayed list (touching real rows' `updatedAt/updatedBy`), so the firewall blocks reorder unless the flag is
`true`. REO-01 captures+aborts the PATCH and validates the payload; REO-03/04 are stubbed; REO-02 (real reorder of two
QA rows) is BLOCKED unless the flag is set. With the flag, the Home baseline comparison ignores only `updatedAt/updatedBy`
of real rows (ids, order, active, media, category must still match).

## 8. RBAC

Temporary `SUPPORT_VIEWER` / `CONTENT_EDITOR` accounts (Prisma `adminUser.create`, same precedent as the existing QA
runner) only when `STAGE517C_PROVISION_ROLES=true`; registered as fixtures, credentials in a 0600 `roles.json` that is
deleted at teardown, accounts deleted at teardown (refresh tokens cascade). `admin_audit_logs` rows are append-only and
remain; the report says so explicitly. Otherwise RBAC-01..04 are BLOCKED.

## 9. Cleanup and verification

Reverse order: rows → media → storage → temporary admins. Media is hard-deleted only if registered, carries this run's
tag, has zero references and matches the expected id; storage objects are deleted by key. Afterwards: fixture-id lookups,
tag/slug sweep, storage `HeadObject`, reference check. `remaining-fixtures.json` must be empty.

## 10. Checksums and baseline

The 5 protected tables (`card_products`, `category_cards`, `categories`, `services`, `services.gallery`) are checksummed
BEFORE and AFTER (`stage-5.17-c-before.txt` / `-after.txt`) and must be identical. The Home real-row baseline (ids, active,
sortOrder, media, category, updatedAt, updatedBy) and public counts must be restored.

## 11. Report / artifact

`stage-5-17-c-report.txt|json`: run id, commit SHA, timestamps, 46-test matrix statuses (PASS/FAIL/NOT_RUN/BLOCKED with
reasons), fixture registry, cleanup result, remaining fixtures, checksums BEFORE/AFTER, Home baseline, firewall events,
final verdict; plus `screenshots/stage517c-<run-id>-<TEST-ID>.png` (screenshots only — no video, no trace).
Exit 0 only if every required test PASS, none FAIL/NOT_RUN/BLOCKED, cleanup PASS, 0 remaining, checksums match, baseline
restored, no firewall violation. Everything written passes through `redact()`; `state.json`, `roles.json` and raw
snapshots are never copied into the artifact.

## 12. Plan deviation

ERR-04: the plan expected a "Persian-prefixed 400 message". Edit pages actually show the backend message unprefixed
(only list/action paths use `describeHomeError`). The test is now an observation (alert visible, no crash, no internal
details); the contract title and the plan text were corrected. No UI code was changed.

## 13. Local gate results

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | pass |
| Backend `nest build` (emits `dist/scripts/staging-qa/stage-5-17-c/control.js`) | pass |
| Backend Jest (53 suites) | 410 / 410 pass (incl. 46 contract + 17 new orchestration tests) |
| ESLint + Prettier on new backend files | clean |
| Verifier `tsc` (strict, `tsconfig.stage-5-17-c.json`) and existing browser `tsconfig.json` | pass |
| Admin lint / `tsc` / Jest | 0 errors (4 pre-existing warnings) / pass / 193 pass |
| `bash -n` on the wrapper | pass |

The verifier has no ESLint config of its own (the browser package has none); its gate is strict type-checking.

## 14. Known limits (honest)

* The selectors, timing and staging behaviour of the verifier are **unexercised** — it has never been run in a browser.
  The first real run may need selector/timing adjustments; that is what the run is for.
* The Windows dev machine cannot run the backend (Redis port blocked) and no staging run was allowed, so nothing here
  was executed end to end.
* Pagination tests need > 50 active assets; setup pads with tagged uploads (paced ~1 s each) and removes them at cleanup.

**Browser QA was NOT run in Stage 5.17-D.**
