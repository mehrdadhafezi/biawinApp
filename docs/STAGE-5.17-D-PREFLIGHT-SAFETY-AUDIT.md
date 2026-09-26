# Stage 5.17-D — Preflight Safety Audit (commit `057246c`)

Static inspection only, plus the existing local gates. **Browser QA was NOT run.** Nothing was deployed, no
application code was changed, no code was changed by this audit (findings are reported, not fixed).

Inspected: `qa-contract.ts` (`decideMutation`, `isOwnedByRun`, `compareHomeBaseline`, `gateTest`, `finalVerdict`),
`qa-orchestration.ts`, `control.ts` (setup / teardown / verify), `verifier.ts`, `run-stage-5-17-c-browser-qa.sh`,
`stage-5-17-c-home-admin-browser-qa.yml`, and the relevant backend schema/DTOs.

## Summary

| # | Condition | Verdict |
|---|---|---|
| 1 | Reorder flag only touches current-run QA fixtures | **FAIL** (unsafe path U1) |
| 2 | Temporary roles: created/registered/cleaned safely; audit residue reported | **PASS with gap** (G3) |
| 3 | Every fixture mutation has current-run ownership proof | **PASS** |
| 4 | Every DELETE has ownership proof | **PASS** |
| 5 | Media hard-delete: registered + tag + zero refs + exact id | **PASS** |
| 6 | Firewall blocks catalog / real ids / unexpected DELETE / `active=true` create / non-allowlist | **PARTIAL** (U2: omitted `active`, PUT `active:true`) |
| 7 | Cannot invoke authenticated-qa-runner / deploy.sh / restart / unrelated QA | **PASS** |
| 8 | Cleanup guaranteed via EXIT/INT/TERM/finally | **PARTIAL** (G1: HUP/PIPE, hard kill) |
| 9 | Protected checksum tables never written | **PASS** |
| 10 | Home baseline never auto-restored by writing back real data; mismatch FAILs | **PASS** (but see U1) |
| 11 | Secrets cannot reach stdout / report / screenshots / artifacts | **PASS** (minor G4) |
| 12 | Missing fixture ⇒ NOT_RUN only, never undefined ids / cascade mutation | **PASS** (G5: two non-fixture prerequisites FAIL instead of NOT_RUN) |
| 13 | Local gates | **PASS** |

## Concrete unsafe paths

### U1 — reorder flag permits reordering REAL rows (condition 1: FAIL)
`decideMutation` (`qa-contract.ts`, reorder branch) is `input.allowReorderMetadataTouch ? allow : block`. It
looks only at the URL; it never inspects `body.items`. The Admin UI always sends the **whole displayed list**
(`moveItem()` → `{id, sortOrder: index}` for every row), so with `STAGE517C_ALLOW_REORDER_METADATA_TOUCH=true`
the PATCH is allowed for any of the four resources, and it **rewrites `sortOrder` of every real row to `0..n-1`**
(besides `updatedAt/updatedBy`). If real rows do not already have canonical positions (e.g. 10/20/30, or gaps),
their order values change. Consequences:
* the flag does **not** restrict reorder to current-run QA fixtures — it can change real Home rows;
* the firewall does **not** block that real-row mutation once the flag is on;
* the verifier does not repair it (correct per condition 10), so the verdict FAILs on the baseline comparison —
  but the real data stays modified. Detection, not prevention.
REO-02 also restores only the two QA rows' order, not any real-row `sortOrder` that was rewritten.

Mitigation if the flag must be used: (a) the wrapper/verifier should first assert that the real rows of the target
list already have canonical `sortOrder` (`0..k-1`, no gaps) so the whole-list PATCH is provably a no-op for them, and
(b) `decideMutation` should take the current real-row snapshot and block a reorder body whose entries for
non-QA ids differ from their current `sortOrder`. Until then: **do not enable the flag.**

### U2 — firewall gaps on `active` (condition 6: PARTIAL)
* The Prisma columns and DTOs make `active` optional with `@default(true)`. `decideMutation` blocks only
  `body.active === true`; a create whose body **omits** `active` and carries the tag passes and would create a
  **public** QA row. Not reachable today (the UI forms and `control.ts` always send an explicit `active`), but the
  guard is weaker than its stated purpose.
* `PUT {active:true}` on a registered QA row is allowed. The only test that submits it (BAN-07) is capture+aborted,
  and ERR-01 targets a row already deleted, so it is not reachable today either.
Fix (small, in `decideMutation`): for `POST` require `body.active === false`; for `PUT` block `body.active === true`.

## Detail per condition

**1 — Reorder flag.** See U1. Without the flag (default, never auto-enabled: `envFlag` accepts only the literal
`true`; workflow input default `false`) reorder is blocked outright, REO-02 is `BLOCKED`, REO-01/03/04 are
capture+abort or stubs that never reach the backend. Hero reorder is only reachable via the same flag.

**2 — Temporary roles.** Only `prisma.adminUser.create` (SUPPORT_VIEWER / CONTENT_EDITOR) with email
`qa-<role>-<slugPrefix>@biawin-staging.qa.invalid`; there is no update of any user. Each is registered
(`reg.register` → `state.json` rewritten) immediately after `create` returns; a crash in that instant is still
covered by the teardown sweep (`adminUser.email contains slugPrefix`). Teardown deletes an admin user only if its
email contains this run's `slugPrefix` (`cleanupOne`, `admin-user` branch), so no pre-existing user can be deleted.
Cleanup runs from the wrapper's trap after browser failure (see 8). `roles.json` (0600) is removed in teardown and
again by the wrapper. Audit: `admin_audit_logs.adminUserId` is `onDelete: SetNull`, so user deletion succeeds and the
rows remain (actor nulled). The report contains the fixed statement that audit rows are append-only, **not** cleaned
and **not** counted as fixtures — so they are not falsely reported as cleaned.
*Gap G3:* the residue is stated, not measured (no count of audit rows created by the run's temporary users and by the
seeded admin's fixture operations). Recommended: count rows for the run window and print the number.

**3 — Mutation ownership.** Setup creates new objects (nothing pre-existing is mutated). The only direct-Prisma
updates (legacy references) call `assertOwnedByRun` (registered **and** tag/slug marker) before writing and read the
result back. Browser and verifier-initiated API mutations pass `decideMutation`, which requires registry membership
for every PUT/DELETE (registry contains only this run's objects; ids from UI creates are added only from a
firewall-allowed POST response). Cleanup row deletes call `assertOwnedByRun` first. The sweep adopts objects only by
the run-unique tag/slug prefix.

**4 — DELETE.** Firewall: DELETE allowed only for registered QA media or registered rows of the matching type (unit
tested, including wrong-type and real ids). Cleanup: rows `assertOwnedByRun`; media see 5; admin users see 2.
`control.ts` contains no other `delete` (verified by grep: 8 Prisma write sites, all listed above).

**5 — Media hard delete** (`cleanupOne`, `media` branch), all four required:
registered (`reg.registry.has`), tag (`row.fileName.includes(run.tag)`; the backend stores `file.originalname`, and every
QA upload is named `<tag>-<suffix>.png`), zero references (`countReferences` over banners, mosaic, news, categories,
category cards, services, service galleries, card products — non-zero ⇒ refuse), exact fixture id (`findUnique` +
`delete where {id: f.id}`). Failing any check refuses (safe direction: leftover ⇒ verdict FAIL).

**6 — Firewall.** Blocked (unit-tested): every catalog/unknown mutating endpoint, PUT/DELETE of real ids and of wrong
resource types, hero mutations of real rows, untagged creates, explicit `active:true` creates, media DELETE of
non-QA assets, everything else outside the allowlist. Registered as the *last-running* context route on every context
(including role contexts and the login page). Page-level stubs/captures run before it and never leave the browser;
if a stub pattern ever failed to match, the request would hit the firewall, not the backend. Gap: U2. Residual: only
requests matching `**/api/v1/**` are intercepted — the Admin app calls the API only under that prefix.

**7 — Forbidden invocations.** grep over wrapper, workflow, verifier and control: no `authenticated-qa-runner`,
`run-authenticated-qa.sh`, `deploy.sh`, `docker restart`, `compose up/down/restart`. The wrapper uses `compose build
backend` and `compose run --rm backend` (one-off containers; as with the existing 5.16-E wrapper this may start
`depends_on` services that are down, but never restarts running ones), `docker exec redis … del` limited to the
throttler key pattern `{*:default}*`, and `docker build/run` of its own image. The workflow runs
`git reset --hard origin/main` on the server checkout (same as the 5.16-E workflow; source tree only). No unrelated QA.

**8 — Cleanup guarantee.** Wrapper: `trap finalize EXIT`, `trap … INT TERM`; `finalize` runs teardown then verify
whenever setup started, independent of the browser's exit code and of teardown's own success. Verifier: `finally`
closes contexts/browser and writes results; dynamic fixtures are appended synchronously to an ndjson file at creation.
Control: registry persisted after every registration; setup crash ⇒ teardown still reads `state.json`.
*Gap G1:* `HUP` and `SIGPIPE` are not trapped, and the workflow's `ssh` has no tty — a dropped/cancelled SSH session
(job timeout, cancel) may kill the remote script without a guaranteed `finalize`; `SIGKILL`/host loss cannot be
covered by any trap. Recommended: `trap … HUP PIPE` (or run the wrapper detached with `nohup`/`setsid` and poll), and
a documented manual cleanup command (`control.js teardown` against `/tmp/stage-5-17-c`) — the tag sweep makes a later
teardown safe and idempotent.

**9 — Protected tables.** `control.ts` issues no write to `card_products`, `category_cards`, `categories`, `services`
(the only Prisma writes: Home rows, `mediaAsset.delete`, `adminUser` create/delete; SQL is read-only `SELECT` checksums).
`categories` are only read. The one indirect path — hard-deleting media that a protected table might reference (FK
`SetNull`) — is closed by the zero-reference check in 5. The verifier can only reach catalog endpoints via the
firewall, which blocks them.

**10 — Baseline.** `verify` only reads (`snapshot()`, `compareHomeBaseline`); no code path writes back real Home
data. A mismatch produces `homeBaselineOk=false` ⇒ FAIL. (The only "restore" actions act on QA rows: NEWS-05 re-attaches
media A to a QA row; REO-02 swaps two QA rows back.)

**11 — Secrets.** `ADMIN_SEED_*` reach the backend containers through compose `env_file`, the browser container through
a 0600 `--env-file` (not CLI args); temporary-role passwords live only in `roles.json` (0600, deleted). Everything
written by `control.ts`/`verifier.ts` (logs, results, reports, firewall events — path only, no bodies/headers) passes
`redact()` (JWT, Bearer, `postgres://`, the admin and role passwords). No video/trace/HAR; screenshots are taken only at
the end of a test page, never on the login page, and no page displays a token. The artifact copies an explicit
allowlist (reports, checksum text, `remaining-fixtures`, `cleanup`, `firewall-events`, `browser-results`,
`setup-result`, screenshots) and **excludes** `state.json`, `roles.json`, `manifest.json`, `before/after.json`.
*G4 (minor):* `TMP_ENVFILE` (0600, in `/tmp`) survives a `SIGKILL`; the run dir is `chmod 777` (no secrets are written
there except the 0600 `roles.json`); Playwright error text is redacted but not otherwise filtered.

**12 — Missing fixtures.** `gateTest` yields `NOT_RUN` when any declared fixture is absent and `BLOCKED` for a missing
capability. `FixtureBag.set` ignores non-uuid ids; `registerDynamic` requires a uuid; `fx(name)` throws for a missing
fixture, so an undefined id can never be sent. Setup drops dependent fixtures when a prerequisite fails and records
the reason. A failed test cannot trigger mutations elsewhere: the only cross-test state (media A reference) is repaired
through the firewall-checked path (QA row → QA media) or the dependent test fails.
*G5:* tests that need an existing category (`cats.activeId/inactiveId`) assert it and would **FAIL** rather than
`NOT_RUN` when none exists (no mutation in either case).

**13 — Gates (re-run for this audit).** Backend `tsc` OK; `nest build` OK; Jest 53 suites / 410 tests pass; Admin
`tsc` OK, Jest 36 suites / 193 tests pass, lint 0 errors (4 pre-existing warnings); verifier strict `tsc`
(`tsconfig.stage-5-17-c.json`) OK; `bash -n` on the wrapper OK.

## Is the verifier safe to execute against staging?

* **With `STAGE517C_ALLOW_REORDER_METADATA_TOUCH=false` (default): yes, by static analysis** — every mutation path is
  either provably a current-run QA object, a stub/capture that never leaves the browser, or blocked; protected tables
  and real Home rows cannot be written; secrets are redacted. Expect verdict FAIL (REO-02 BLOCKED, and RBAC BLOCKED
  unless `STAGE517C_PROVISION_ROLES=true`) — that is by design, not a defect. `PROVISION_ROLES=true` is acceptable.
* **With the reorder flag `true`: NOT safe** until U1 is fixed (or the real rows are proven canonical beforehand).
* Recommended before the first run (small, verifier-side, no application change): fix U2, add `HUP PIPE` traps (G1),
  count audit rows (G3). None of these were applied in this audit.
* Static analysis is not execution: selectors/timing of the verifier remain unproven until a real run.

**Browser QA was NOT run.**
