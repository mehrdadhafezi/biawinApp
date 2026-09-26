# Stage 5.17-E — Browser QA Safety Hardening: Result

**Browser QA NOT RUN.** No staging mutation, no deploy, no application behaviour change. Only verifier
infrastructure was modified. Findings addressed: `docs/STAGE-5.17-D-PREFLIGHT-SAFETY-AUDIT.md`.

## Fixes

### U1 — Reorder firewall (`qa-contract.ts` → `decideMutation`)
Reorder is now allowed only when **all** of the following hold: the flag `STAGE517C_ALLOW_REORDER_METADATA_TOUCH=true`;
method is `PATCH`; `body.items` is a non-empty array; every `items[].id` is a uuid **and** a registered current-run
QA fixture **of the matching resource type**. Anything else — a real Home id, a mix of QA + real ids, empty/missing
items, malformed/non-uuid ids, a QA id of another resource type — is blocked (the verifier aborts the request,
records a firewall event, the running test FAILs and the run verdict FAILs). Real Home rows can never be reordered.

Consequence (by design): the Admin UI reorders the *whole displayed list*, so REO-02 can only run when the news list
contains current-run QA rows exclusively. The verifier checks this **before sending anything** (`reorderListIsQaOnly`)
and otherwise reports REO-02 as **BLOCKED** with the reason. On staging the list will hold real rows, so REO-02 is expected to
be BLOCKED (and the run verdict cannot be PASS) — REO-01 (capture+abort payload validation) and REO-03/04 (stubs) still run.

### U2 — `active` protection
* **Create** (all three creatable Home resources and Hero): the body must contain `active === false`. Missing,
  `true`, `null`, or non-boolean values are blocked.
* **Update:** `PUT {active:true}` on a QA row is blocked (a QA row can never be made public). ERR-01 (which toggles a row
  that was deleted elsewhere → the UI sends `{active:true}`) now stubs the 404 (class `S`) instead of sending the real
  activation request; the test still asserts the toggle payload and that the row really is gone.

### Cleanup hardening
* Wrapper: added `trap … HUP` and `trap … PIPE` (alongside EXIT/INT/TERM); once `finalize` starts, `HUP PIPE INT TERM`
  are ignored so cleanup cannot be interrupted, and `finalize` is guarded by a `FINALIZED` flag (runs once).
* Verifier (Node): `SIGHUP/SIGTERM/SIGINT` handlers write results and close the browser; `SIGPIPE` is ignored so a
  closed stdout cannot kill it before results are written.
* Idempotence: `FixtureRegistry.register` returns the existing entry (state preserved), teardown treats an absent
  object as already cleaned, the audit ids are persisted before deletion; unit-tested (registry idempotence).
* Still not coverable by any trap: `SIGKILL` / host loss (a later `control.js teardown` is safe and idempotent).

### Temporary-role audit residue (`control.ts`, `qa-orchestration.ts`)
Before deleting a temporary admin, teardown records the ids of `admin_audit_logs` rows attributed to it (the FK is
`onDelete: SetNull`, so rows remain with a null actor). `verify` reports: temporary users created, temporary users deleted
(verified absent), audit rows created by temporary QA users, and audit rows **REMAINING** (counted by id after
cleanup; assumed all remaining if the count cannot be taken). The wording states they are **NOT cleaned**; rows written by
the seeded admin are stated as not attributed and also remaining. Included in `stage-5-17-c-report.txt|json`.

### Missing category → NOT_RUN
`categoryDependency()` + `needCategory()` in the verifier: BAN-02, BAN-05, BAN-06, MOS-01, MOS-02 (which need an existing
active/inactive category that is only ever *read*) become **NOT_RUN** with the reason instead of FAIL. (Fixture-gated
tests such as BAN-03/MOS-03 were already NOT_RUN through `gateTest`.)

## Tests added / changed
`stage-5-17-c-qa-contract.spec.ts`: reorder (PASS QA id; FAIL real id, mixed both orders, empty/missing/non-array,
malformed ids, wrong resource type, non-PATCH, unknown resource, no-flag), create `active` (missing / true / null / `'false'`
blocked; `false` allowed) across news/banner/mosaic, PUT `active:true` blocked, existing create/Hero tests updated to the
explicit `active:false` rule. `stage-5-17-d-orchestration.spec.ts`: category dependency, reorder pre-check, audit-residue
wording, registry idempotence. Total backend tests: 423 (was 410).

## Gates (all local, all passing)
| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | pass |
| Backend `nest build` | pass |
| Backend Jest | 53 suites, 423 tests pass |
| ESLint/Prettier on changed backend files | clean |
| Admin `tsc` | pass |
| Admin Jest | 36 suites, 193 tests pass |
| Admin lint | 0 errors (4 pre-existing warnings) |
| Verifier strict `tsc` (+ existing browser tsconfig) | pass |
| `bash -n` on the wrapper | pass |

## Status
Audit findings U1, U2, G1 (HUP/PIPE), G3 (audit residue) and G5 (category → NOT_RUN) are fixed. Remaining known limits:
`SIGKILL`/host loss; verifier selectors/timing still unproven until a real run; REO-02 BLOCKED on staging by design.

**Browser QA NOT RUN.**
