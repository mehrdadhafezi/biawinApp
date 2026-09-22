# STAGE 5.16-E — CI Authenticated API Fixture Verification: RESULT

**Final status: infrastructure READY, execution NOT RUN.** This stage builds the CI-based path Stage 5.16-D identified as missing, but a `workflow_dispatch` run still requires a human click in the GitHub Actions UI (or an authenticated `gh`/API call) — neither is available from this sandbox, exactly the same class of limitation already established for triggering `deploy-staging.yml` earlier in this engagement. **No HTTP request was sent to any admin endpoint. No fixture was created. Stage 5.16 remains PARTIAL/BLOCKED, not CLOSED.**

## 1. Scope
API-only. No application source code (`backend/src`, `apps/admin`, DTOs, controllers, services, Prisma schema, migrations, seeds) was changed. Everything added is isolated QA/CI infrastructure, per this task's own §16.

## 2. Workflow used
**New:** `.github/workflows/stage-5-16-e-home-verification.yml` — `workflow_dispatch` only, never on push, never automatic. It does not deploy and does not restart any running container; it SSHes to the server, updates the source checkout (fetch/checkout/reset, the same git sequence `deploy.sh` already uses for that step, but stops there — it never runs migrate/seed/`up`), rebuilds only the `backend` image (used for a throwaway `run --rm` container, per Compose semantics that never touch the already-running `backend`/`web`/`admin` containers, verified against `run-authenticated-qa.sh`'s own identical, already-in-production claim), runs the new verifier script inside it, and uploads the sanitized report as a GitHub Actions artifact.

Supporting files added:
- `backend/scripts/staging-qa/stage-5-16-e-home-fixture-verifier.ts` — the actual test implementation (compiles to `dist/scripts/staging-qa/stage-5-16-e-home-fixture-verifier.js`).
- `deploy/staging/run-stage-5-16-e-verification.sh` — the same-pattern wrapper `run-authenticated-qa.sh` already establishes, invoked by the workflow and equally runnable by a human directly on the server.

## 3. Staging target
`https://api-staging.biawin.ir` publicly; internally the verifier defaults to `http://backend:4000` (the same internal-Docker-network origin `run-authenticated-qa.sh`'s API layer already uses, for the same reason — the container cannot reach the public HTTPS domain from inside the compose network).

## 4. Authentication mechanism (description only — see §5 for why no secret appears here)
Identical to the mechanism `authenticated-qa-runner.ts` already uses in this repository: `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` reach the `backend` container through Compose's `env_file: .env.staging` (a file that exists only on the server, is gitignored, and is never committed). The verifier calls `POST /api/v1/admin/auth/login` with these two values, receives a real, short-lived admin JWT, and uses it only in-process for the remainder of the run. **No new credential was created.** No `ADMIN_SEED_*` GitHub Actions secret exists or was invented — the workflow never references one; only the four pre-existing `STAGING_SSH_*` secrets (already used by `deploy-staging.yml`) are referenced, by their exact existing names.

## 5. No secret values
Confirmed by inspection of every new file:
- The workflow file only ever references `secrets.STAGING_SSH_HOST/PORT/USER/PRIVATE_KEY` via `${{ secrets.* }}` interpolation — never echoed, never written to a variable that's printed.
- No `set -x` anywhere in the new workflow or wrapper script.
- The verifier's `redact()` strips anything JWT-shaped (`header.payload.signature` pattern) and the literal `ADMIN_SEED_PASSWORD` value from every string before it is logged or written to a report — applied uniformly in `record()` and in `finish()`'s report-writing.
- The verifier never logs `Authorization` headers, never writes the access token to disk, and only ever holds it in a local `admin.accessToken` variable in process memory.
- Nothing in this stage was run, so nothing was printed anywhere by it either.

## 6. Baseline timestamp
**Not applicable — the workflow was never triggered.** The verifier script, when it does run, computes the BEFORE baseline immediately after login and before any fixture write (see its own `main()`), so a real timestamp will exist in `stage-5.16-e-before.txt` and in the human report's header the first time it actually executes.

## 7. Fixture inventory
**None created.** For completeness, here is exactly what the script *would* create on a real run, and — disclosed prominently, not silently — two deliberate deviations from a literal reading of the task's fixture list, both explained at length in the script's own header comment:

| Task's fixture item | What this script actually does | Why |
|---|---|---|
| A. Temporary Hero/Card | **Not created.** `cardKey` is a closed 3-value enum (`earn`/`biawin`/`reward`), `@unique`, already fully seeded. Creating a "4th" is impossible. The duplicate-key test instead attempts to reuse the existing `earn` key and asserts 409 + unchanged row count. | Structural impossibility; identical precedent already in this repo (`authenticated-qa-runner.ts`'s `heroCardExistingRowCheck`). |
| B. Temporary News | Created — 3 disposable rows total across the run (News #1 with active media, News #2 for reorder, News #3 for the soft-deleted-media test), each tagged `stage516e_qa_...`. | As specified. |
| C. Temporary Category | **Not created.** Every category-dependent test in this script is the *negative* case (an unknown, guaranteed-nonexistent uuid), so no real category is ever required. | Removes `categories` — one of the 5 protected tables — from this script's own write surface entirely. |
| D. Temporary active Media | Created — "Media A", attached to News #1. | As specified. |
| E. Temporary soft-deleted Media | Created — "Media C", uploaded then soft-deleted while unreferenced. | As specified. |
| F. Temporary Home row referencing the soft-deleted media | Created — News #3, but reaching that state needs **one deliberate, disclosed direct Prisma write** (see §8) because the hardening this very script is verifying makes that state unreachable through the API by construction. | See the script's header §4 for the full reasoning. |

## 8. Test matrix (as designed — NOT executed)
| # | Test | Method/endpoint | Fixture used | Expected |
|---|---|---|---|---|
| 1 | Malformed UUID | `GET /admin/home/hero-cards/not-a-uuid` (authenticated) | none | 400 |
| 2 | Duplicate cardKey | `POST /admin/home/hero-cards` with `cardKey: 'earn'` | none (reuses existing key) | 409, hero count unchanged |
| 3 | Duplicate bodySlug | `POST /admin/home/news-articles` reusing News #1's slug | News #1 | 409 |
| 4 | Unknown category | `POST /admin/home/service-banners` with a nonexistent uuid | none | 422, nothing written |
| 5 | Unknown media | `POST /admin/home/news-articles` with a nonexistent uuid | none | 422, nothing written |
| 6 | Empty reorder | `PATCH /admin/home/news-articles/reorder` `{items:[]}` | none | 400 |
| 7 | Malformed reorder UUID | same, `id: 'not-a-uuid'` | none | 400 |
| 8 | Duplicate reorder ID | same, News #1 listed twice | News #1 | 400 |
| 9 | Duplicate reorder position | same, News #1 & #2 at the same position | News #1, #2 | 400 |
| 10 | Unknown reorder ID | same, one real + one nonexistent id | News #1 | 422, News #1's `sortOrder` unchanged |
| 11 | Valid partial reorder | swap News #1/#2, verify, then restore | News #1, #2 | 200 both times |
| 12 | Soft-deleted media | `GET /home/news-articles` (public) | News #3 → Media C (soft-deleted via the one deliberate direct-Prisma step) | 200, row present, `image: null` |
| 13 | Media delete protection | `DELETE /admin/media/:id` on Media A while referenced by News #1 | Media A, News #1 | 409, media still exists, `mediaAssetId` unchanged |
| 9 (task) | Public Home GET regression | 4 public GETs, pre- and post-cleanup | — | 200, no 5xx, counts back to baseline |

## 9. Actual HTTP statuses
**None recorded — nothing was sent.** No admin-authenticated request was made in this stage.

## 10. Expected vs actual status
Not applicable for the same reason.

## 11. Soft-deleted media result
**NOT RUN.**

## 12. Media delete protection result
**NOT RUN.**

## 13. Public Home GET results
**NOT RUN as part of this stage's own test matrix.** (Stage 5.16-D already re-confirmed, this session, the four public endpoints healthy at 3/5/4/8 — see that report §14 — but that was a separate, prior, unauthenticated check, not a result of this stage's infrastructure.)

## 14. Cleanup result
**N/A — nothing was created, so nothing needed cleaning up.** The script's own cleanup is implemented as a mandatory `finally` block (`runCleanup()`), verified by `tsc --noEmit`/`nest build` to compile and by the finally-block's placement to run regardless of which `step()` failed, but has not been exercised against a live server.

## 15. Remaining fixture count
**0** — because 0 fixtures were ever created.

## 16. BEFORE checksums
**Not captured this stage.** Carried forward from Stage 5.16-D (themselves carried forward unchanged from 5.16-B/C, never independently recomputed from this sandbox): `card_products=3820a5b2562c2f49e4022d8a2ef8d413`, `category_cards=a1810c0e7e050f9b0000327c3c8b8b9d`, `categories=e7dd7c01de3c76c8fd0460a3116a27b6`, `services=5c75a0e357a7b4a0870ddb52cbed1d84`, `services.gallery=1426eb78c0855edcd8c633c881dcde12`.

## 17. AFTER checksums
**Not captured — no run occurred.**

## 18. Checksum comparison
**Not performed this stage.** When the workflow does run, the verifier computes and compares all five automatically (`compareChecksums()`) and records a PASS/FAIL line per table in its own report, plus writes `stage-5.16-e-before.txt`/`stage-5.16-e-after.txt` for an independent, out-of-band check.

## 19. Artwork/media integrity result
**Not verifiable this stage — nothing ran.** By construction, the verifier's only fixture writes touch `home_news_articles` and `media_assets`; it contains exactly one direct Prisma write beyond its own cleanup deletes (§8/F above), and that single write only ever targets a `home_news_articles` row the script itself created in the same run. It performs **zero** writes, direct or via API, to `card_products`, `category_cards`, `categories`, `services`, or `services.galleryMediaAssetIds` at any point — confirmed by reading the file (no `prisma.cardProduct`, `prisma.categoryCard`, `prisma.category`, or `prisma.service` calls appear anywhere in it) and by the same static-guard discipline Stage 5.16-B's `home-image-integrity.spec.ts` already established for the application code.

## 20. Browser QA
**NOT RUN.** Not referenced by any new file. `run-stage-5-16-e-verification.sh`'s header explicitly states it does not build or run the Playwright/browser-qa image.

## 21. `authenticated-qa-runner.ts`
**NOT RUN.** Not referenced by any new file; the verifier script's own header states this explicitly and by name.

## 22. Final determination

**BLOCKED — infrastructure built, not executed.**

What actually changed this stage: three new, isolated files (a verifier script, a shell wrapper, and a `workflow_dispatch`-only GitHub Actions workflow), all of them reusing existing secrets/mechanisms and none of them touching application source. `tsc --noEmit`, `nest build`, `eslint`, and the full existing backend suite (51 suites / 347 tests) all pass with these files present, confirming the new code compiles cleanly and introduces no regression — but **compiling cleanly is not the same as having been exercised against a live server**, and this report does not claim otherwise.

What did not happen: the workflow was not triggered. Triggering a `workflow_dispatch` requires either a person clicking "Run workflow" in the GitHub Actions UI, or an authenticated `gh`/GitHub REST API call — this sandbox has neither (`gh` is not installed, no `GITHUB_TOKEN`/`GH_TOKEN` is present, confirmed identically to Stage 5.16-D's search). This is not a new limitation invented for this stage; it is the same one that already applies to `deploy-staging.yml` throughout this entire engagement.

## Stage 5.16 closure checklist (per this task's §18)
Every item requires the workflow to have actually run:
```
[ ] Authentication succeeded securely through existing GitHub Actions secrets   — NOT RUN
[ ] Fixture created successfully                                                — NOT RUN
[ ] malformed UUID = 400                                                        — NOT RUN
[ ] duplicate cardKey = 409                                                     — NOT RUN
[ ] duplicate bodySlug = 409                                                    — NOT RUN
[ ] unknown category = 422                                                      — NOT RUN
[ ] unknown media = 422                                                         — NOT RUN
[ ] empty reorder = 400                                                         — NOT RUN
[ ] malformed reorder UUID = 400                                                — NOT RUN
[ ] duplicate reorder ID = 400                                                  — NOT RUN
[ ] duplicate reorder position = 400                                            — NOT RUN
[ ] unknown reorder ID = 422                                                    — NOT RUN
[ ] valid partial reorder = PASS                                                — NOT RUN
[ ] soft-deleted media = image:null                                            — NOT RUN
[ ] referenced media delete = 409                                               — NOT RUN
[ ] public Home GETs = PASS                                                     — NOT RUN (this stage); PASS as of Stage 5.16-D (unauthenticated, separate)
[ ] fixture cleanup = PASS                                                      — NOT RUN
[ ] remaining fixture count = 0                                                 — vacuously true (0 created)
[ ] card_products checksum unchanged                                           — NOT RUN
[ ] category_cards checksum unchanged                                          — NOT RUN
[ ] categories checksum unchanged                                              — NOT RUN
[ ] services checksum unchanged                                                — NOT RUN
[ ] services.gallery checksum unchanged                                        — NOT RUN
[ ] no existing artwork/media reference changed                                — vacuously true (nothing ran); code review confirms no write path exists to any protected table
[x] Browser QA NOT RUN                                                         — confirmed
[x] authenticated-qa-runner.ts NOT RUN                                         — confirmed
```

**Stage 5.16 remains PARTIAL/BLOCKED. It is not closed.**

## 23. Exact next step
Someone with access to this repository's GitHub Actions (write/admin access, able to see and run workflows) needs to:
1. Confirm this stage's commit has been pushed to `origin/main` (see the commit hash in my final response).
2. Go to **Actions → "Stage 5.16-E — Home Verification (API only)" → Run workflow**, on the `main` branch.
3. Wait for it to finish, then download the **`stage-5-16-e-verification-report`** artifact from the run.
4. Share that artifact's contents (or just the `.txt` report) back — I will read it and write the final, evidence-based Stage 5.16 closure determination from real results, with no further code changes needed unless the run itself surfaces a genuine defect.

If it fails on its very first real run, that is expected to be informative, not alarming — this script has been typechecked, built, and linted, but has never executed against a live database or a live admin session from anywhere in this engagement; the first run is also its first real-world test.
