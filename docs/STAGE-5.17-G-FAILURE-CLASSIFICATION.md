# Stage 5.17-G — Browser QA Failure Classification & Fix

## 1. Executive summary

Run 36553154337 (commit `08bd809`) produced 17 PASS / 25 FAIL / 2 NOT_RUN / 2 BLOCKED. The run's own
GitHub Actions artifact was deleted before this analysis; the only evidence available is the
25 failure summary lines the operator pasted into this task, plus the current repository source at
`08bd809` (confirmed to be exactly the commit the workflow executed).

Of the 25 failures: **1 shared, CONFIRMED verifier defect** was found and fixed (loss of diagnostic
detail — every failure's message was truncated to its first line, which for Playwright timeouts
discards the one line that names the actual locator). No other code change was made: for every
individual test, the evidence available (a one-line summary, no screenshot, no network/console log)
is not enough to prove root cause beyond that confirmed defect, so this report classifies each as
precisely as the evidence supports — several as **UNRESOLVED**, none as a forced guess.

The single most important **hypothesis** raised by source inspection — not confirmed, but well
supported and worth checking before writing any more verifier code — is **deployment lag**: this
QA pipeline's own wrapper explicitly does *not* rebuild or restart the live `admin`/`web`/`backend`
containers (only a one-off image used by `control.js`); a separate, manual, `workflow_dispatch`-only
`Deploy Staging` workflow is the only thing that updates what the browser actually talks to. Several
failures match *exactly* the symptom a documented, already-fixed bug would produce if the deployed
build predates that fix (SDM-04 is the clearest case — see §9). This is stated as a hypothesis
requiring verification, not a conclusion.

No product code (backend, Admin UI, Prisma, seeds) was modified. No staging data was touched. Browser
QA was not run again.

## 2. Run identity

- Workflow run: `36553154337`
- Commit executed: `08bd809d99d3331fbcb20131ec3e5a8d15f92ef4` (confirmed: this is the current
  repository `HEAD` at the time of this analysis — `git log --oneline -1` shows the same SHA, so
  every source excerpt in this report is the exact code that ran).
- Result: 17 PASS, 25 FAIL, 2 NOT_RUN, 2 BLOCKED (46 total), per the operator's paste.

## 3. Evidence available

- The 25 failure `detail` lines and their test IDs, as pasted by the operator (treated as a literal
  transcript of the run's summary, not re-derived or embellished).
- The full current source of `verifier.ts`, `qa-contract.ts`, `qa-orchestration.ts`, `control.ts`,
  and the relevant Admin UI components, API clients and error-mapping utilities, at commit `08bd809`.
- The run's own reported safety result (§5), given by the operator as already established and not
  re-investigated as a data-corruption event, per instruction.
- `deploy/staging/run-stage-5-17-c-browser-qa.sh`'s own documentation of what it does and does not
  rebuild/restart (source evidence for the deployment-lag hypothesis).

## 4. Evidence NOT available (and not invented)

- The original `stage-5-17-c-home-admin-browser-qa-report` artifact: **deleted**.
- `browser-results.json` (which would carry each test's `evidence` object and, before this fix, the
  same truncated `detail` string as the summary).
- Screenshots for any of the 25 failing tests.
- Network requests/responses, console logs, or DOM snapshots at the moment of any failure.
- The exact multi-line Playwright error text for any "Timeout Nms exceeded" failure (only the first
  line survived into the summary — see §6, the confirmed verifier defect).
- The commit/build date actually deployed to the staging `admin`/`backend` containers at the time of
  this run (needed to confirm or rule out §1's deployment-lag hypothesis).

Nothing below infers content for any of the above; where evidence is missing, the entry says so.

## 5. Safety result (as reported; not re-investigated)

Fixtures created: 29, unavailable: 0. Cleanup: OK. Remaining fixtures: 0. Protected checksums BEFORE
== AFTER: PASS. Home baseline restored: PASS. Public counts restored: PASS. Mutation firewall: 0
blocked mutations. Temporary QA users: 2 created / 2 deleted. Temporary-user audit rows remaining: 4
(append-only, intentionally not cleaned). Per instruction, this run is not treated as a
data-corruption event; nothing in the source review below contradicts it.

## 6. Confirmed verifier defect (fixed)

**`runTest`'s catch block kept only the first line of a thrown error:**

```ts
// deploy/staging/qa/browser/stage-5-17-c/verifier.ts (before this fix)
outcome.detail = clean(err instanceof Error ? err.message.split('\n')[0] : String(err));
```

Playwright's own `TimeoutError` messages are multi-line, e.g.:

```
locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for locator('table.biawin-home-list-table tbody tr, p:has-text("هنوز")').first()
```

`.split('\n')[0]` keeps only `"locator.waitFor: Timeout 20000ms exceeded."` — discarding the `Call
log:` line that names the *actual locator*, every time. This is why 15 of the 25 failures in this
run carry the generic, unattributable detail `"locator.waitFor: Timeout 20000ms exceeded"` /
`"locator.click: Timeout 20000ms exceeded"` with no indication of which element was being waited
for. This is a verifier defect independent of any individual test's root cause: it made every
timeout in this run — and every prior run — impossible to classify beyond "something timed out
somewhere".

**Fix** (`qa-orchestration.ts` + `verifier.ts`, minimal, additive, no assertion touched):

```ts
export function summarizeError(message: string, maxLen = 600): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLen ? `${collapsed.slice(0, maxLen)}…` : collapsed;
}
```
used in place of `err.message.split('\n')[0]`. The whole message is collapsed onto one line (so the
report stays one line per test) instead of being truncated, capped only so a pathological message
can't blow up the report.

**Regression test** (`backend/src/qa-contract/stage-5-17-g-artifact-isolation.spec.ts`): reproduces
the exact multi-line shape shown above, proves the *old* code (`split('\n')[0]`) would have dropped
the locator, and proves the fix keeps it, plus whitespace-collapsing and a length-cap case. 4 new
tests, all passing.

This fix does not make any test pass or fail differently — it only ensures the *next* run's report
carries enough detail to classify a timeout without guessing.

## 7. Complete 25-test classification table

| Test | Classification | Evidence | Source evidence | Confidence | Required next action |
|------|----------------|----------|------------------|------------|----------------------|
| NAV-01 | UNRESOLVED — evidence insufficient | `locator.waitFor: Timeout 20000ms exceeded` — no locator named | `waitLoaded`/the 4-link waits use the context default (20000); several candidates, none identifiable from this evidence | LOW | Re-run with the §6 fix; if still failing, the report will now name the exact locator |
| NAV-02 | UNRESOLVED — evidence insufficient | Same generic timeout, first of a 4-resource loop (`hero` iteration) | `openList()`'s row/empty-state wait, or the alert-count read; can't tell which without the locator | LOW | Same as NAV-01 |
| HERO-02 | UNRESOLVED — evidence insufficient | Generic timeout; test opens the real Hero list then a real row | `openList()` row wait vs. `field()`/`fieldError()` waits inside the edit form | LOW | Same as NAV-01 |
| BAN-01 | UNRESOLVED — evidence insufficient | Generic timeout on `/home/service-banners/new` | `waitLoaded()` vs. `fieldError()` waits | LOW | Same as NAV-01 |
| BAN-03 | UNRESOLVED — evidence insufficient | Real assertion (not a timeout): `info.value !== cats.inactiveId` after `readCategorySelect()` already waited for options to populate | §8: `buildCategoryOptions`/`CategorySelect` source is internally consistent and *should* make `select.value === cats.inactiveId` unconditionally once options load; failed identically across two different verifier implementations (raw read, then wait-then-read) | MEDIUM (source rules out the "premature read" theory that motivated the round-2 fix; does not identify the true cause) | Capture the row's real `categoryId`/`categoryName` via `adminGet` alongside the DOM read (a safe, additive diagnostic — not implemented here, since BAN-03 is not classified VERIFIER_BUG) |
| MOS-02 | UNRESOLVED — evidence insufficient | Generic timeout on `/home/service-mosaic/new` | Multiple `fieldError()` waits after an empty submit | LOW | Same as NAV-01 |
| NEWS-01 | UNRESOLVED — evidence insufficient | Generic timeout on `/home/news/new` | 4 `fieldError()` waits after an empty submit | LOW | Same as NAV-01 |
| NEWS-02 | UNRESOLVED — evidence insufficient | `locator.innerText: Timeout 20000ms exceeded` — the bodySlug error span never became readable | `fieldError()` for the bodySlug field, inside a 5-iteration loop of invalid slugs | LOW | Same as NAV-01 |
| SDM-01 | UNRESOLVED — evidence insufficient | Generic timeout inside `expectLegacyWarning()` | §9: the legacy-media-unavailable warning/buttons are a documented Stage 5.17-B feature; if not present in the deployed build, this wait never resolves | MEDIUM (plausible, specific mechanism identified; not confirmed) | Confirm deployed admin commit; re-run with §6 fix |
| SDM-03 | UNRESOLVED — evidence insufficient | `locator.click: Timeout 20000ms exceeded` on the "پاک‌کردن مرجع تصویر" button | That button only renders when `MediaPickerField`'s `unavailable` prop is true — same Stage 5.17-B dependency as SDM-01 | MEDIUM | Same as SDM-01 |
| SDM-04 | UNRESOLVED — evidence insufficient | `HTTP 422 — رسانه انتخاب‌شده معتبر نیست.` (full backend message, captured by the round-2 `backendErrorText` diagnostic — proof that diagnostic addition works) | §9: this is *exactly* the symptom `mediaField.ts` was written to prevent (re-sending a stale/invalid `mediaAssetId` on an unrelated edit) | MEDIUM-HIGH (the error is media-specific, which is only possible if `mediaAssetId` reached the backend at all — the client is designed to omit it) | Confirm deployed admin commit includes `mediaField.ts`'s omit-when-unresolved logic |
| SDM-05 | UNRESOLVED — evidence insufficient | Generic timeout inside `expectLegacyWarning()` (same helper as SDM-01) | Same as SDM-01, on the banner form | MEDIUM | Same as SDM-01 |
| MED-01 | UNRESOLVED — evidence insufficient | Real assertion: `total is 87 (> 50) but no pager is shown`, after `mediaPageLoad()` already waited for the grid to render | §10: `MediaPager`'s render condition (`totalPages(total,50) > 1`) and `total` are set from the *same* API response as the rendered cards — source gives no path for cards-without-pager at total=87 | MEDIUM (source rules out "read too early"; does not identify the true cause) | Confirm deployed admin build includes the pager component at all; capture the raw `GET /admin/media` response on the next run |
| MED-04 | UNRESOLVED — evidence insufficient | Generic timeout | Could be `mediaPageLoad()`'s own wait, or `findMediaCard()`'s pagination loop (`next.click()` uses the context default) | LOW | Same as NAV-01; also see the shared media-pagination pattern, §11.2 |
| MED-05 | UNRESOLVED — evidence insufficient | `media card …-d.png not found` (verifier's own explicit error, not a Playwright timeout) | `findMediaCard()` pages up to 12×50=600 items — more than enough for 87 total *if* the "next" control works; ties to the same MED-01 pager finding | MEDIUM | Same as MED-01 |
| MED-06 | UNRESOLVED — evidence insufficient | `locator.click: Timeout 20000ms exceeded` inside `deleteReferencedA()` | Could be `findMediaCard()`'s own `next.click()`, or the delete-confirm dialog button | LOW | Same as MED-01/NAV-01 |
| MED-07 | UNRESOLVED — evidence insufficient | Same pattern as MED-06, own flow (external delete + reconcile) | Same candidates | LOW | Same |
| MED-08 | UNRESOLVED — evidence insufficient | Same as MED-06 (shares `deleteReferencedA()`) | Same candidates | LOW | Same |
| ERR-01 | UNRESOLVED — evidence insufficient | `locator.waitFor: Timeout 15000ms exceeded` — the 15s budget is unique to `expectAlert()`, so *this* locator is identifiable: the stubbed-404 toggle alert never appeared with matching text | §11.3: `describeHomeError`'s 404 branch is unconditional and always appends the searched-for Persian phrase for *any* 404 — should be unreachable-to-fail per source | LOW-MEDIUM (narrower than most, still no root cause) | Capture the toggle response status/body on the next run |
| ERR-02 | UNRESOLVED — evidence insufficient | Generic 20000ms timeout — several un-timestamped `waitFor()`s in the body, cannot tell which | Same 404 path as ERR-01, but the specific step is unknown here (20000, not 15000, so it is *not* `expectAlert`) | LOW | Same as NAV-01 |
| ERR-03 | UNRESOLVED — evidence insufficient | The alert showed the verifier's own stubbed raw text verbatim (`PrismaClientKnownRequestError internal-stack-secret`) | §12: `describeHomeError`'s `if (error.status >= 500) return fallback;` is unconditional — per source this exact leak should be impossible for a genuine `ApiError` with status 500 | LOW (strong source evidence *against* a UI defect; cause otherwise unknown) | Network/console capture of the actual toggle response on the next run — this is the single most important thing to capture next |
| REO-03 | UNRESOLVED — evidence insufficient | `locator.waitFor: Timeout 15000ms exceeded` — identifiably `expectAlert()` again (stubbed 422 "some ids don't exist") | Same 15s-budget reasoning as ERR-01 | LOW-MEDIUM | Same as ERR-01 |
| REO-04 | UNRESOLVED — evidence insufficient | Same pattern as ERR-03: the alert showed the verifier's own stubbed raw text (`internal failure text`) verbatim | §12: `performReorder`'s catch also goes through the same unconditional `describeHomeError` 500 branch | LOW (same source-level contradiction as ERR-03) | Same as ERR-03 |
| RBAC-03 | UNRESOLVED — evidence insufficient | `a delete control is visible to the read-only role` (`button.biawin-media-card-delete`, a specific, non-text-based class selector — not an overly broad match) | §13: `MediaLibraryGrid` only renders that button inside `{canManage && (...)}`; `canManageHomeContent(role)` is `role === "SUPER_ADMIN" \|\| role === "CONTENT_EDITOR"` (false for SUPPORT_VIEWER and for `undefined`); `AdminRouteGuard` does not mount the page's children until `isAuthenticated` and `profile` are set together — no code path makes the button appear for a SUPPORT_VIEWER session per current source | MEDIUM (source strongly argues against a *current-source* UI bug) | Confirm the deployed build's RBAC gating matches current source (deployment-lag hypothesis, §9); capture a screenshot/DOM dump next time |
| RBAC-04 | UNRESOLVED — evidence insufficient | `locator.click: Timeout 20000ms exceeded`, CONTENT_EDITOR role, first use of that context in the run | Could be the news-create submit, the media page's own load, or `findMediaCard()`/delete click | LOW | Same as NAV-01 |

**All 25 failures are individually classified.** None were forced into a stronger category than the
evidence supports; every UNRESOLVED entry states exactly what additional evidence (a screenshot, the
full Playwright error text now preserved by §6, a network capture, or the deployed commit SHA) would
resolve it.

## 8. BAN-03 analysis

Test: `expect(info.value === cats.inactiveId, ...)` then `expect(/غیرفعال/.test(info.label), ...)`,
against `apps/admin/src/features/home/components/CategorySelect.tsx` and
`apps/admin/src/features/home/categoryOptions.ts`.

- `ServiceBannerForm`'s `categoryId` state is initialized from `initial.categoryId` — and `initial`
  is only ever passed once the banner row has already been fetched (`EditServiceBannerContent`
  conditionally renders the form only after `item` is set), so the `<select value={categoryId}>`'s
  target value is `cats.inactiveId` from the form's very first render, independent of when
  `CategorySelect`'s own `categoriesApi.listAll()` resolves.
- `buildCategoryOptions(all, selectedId, currentLabel)` unconditionally `unshift`s an option for
  `selectedId` (labelled with the `" (غیرفعال)"` suffix) whenever `selectedId` is not already among
  the active-only options — which is exactly the inactive-category case — regardless of whether
  `all` includes inactive categories or not.
- The fixture (`bannerInactiveCat`) is created in `control.ts` using the *same* `inactiveCat.id`
  variable that is also written into `manifest.categories.inactiveId` — no way for these to diverge
  within one run.
- `readCategorySelect()` (the round-2 fix) already waits for `select.options.length > 1` before
  reading, ruling out the "read before the categories fetch resolved" theory that motivated it.

**Conclusion: the failure persisted across two different verifier read strategies with the identical
message, and the source gives no path for the observed mismatch.** This is reported as UNRESOLVED,
not forced into VERIFIER_BUG or UI_BUG. The most useful next step is capturing, in the test's own
evidence, the row's real `categoryId`/`categoryName` from `GET /admin/home/service-banners/:id`
alongside the DOM read — not implemented in this stage, since BAN-03 is not classified VERIFIER_BUG.

## 9. SDM-04 analysis

Test: opens `newsLegacyKeep` (a QA row whose `mediaAssetId` points at the soft-deleted `mediaC`),
edits only the title, saves. Failure: `HTTP 422 — رسانه انتخاب‌شده معتبر نیست.` (backend's exact
message, captured by the round-2 diagnostic).

Traced against `apps/admin/src/features/home/mediaField.ts`:

```ts
export function initMediaField(initial) {
  const id = initial?.mediaAssetId ?? null;
  return { value: id, unavailable: id !== null && !initial?.image, resolved: false };
}
export function mediaPayloadValue(state) {
  if (state.unavailable && !state.resolved) return undefined;
  return state.value;
}
```

For `newsLegacyKeep`, `mediaAssetId` is set and `image` is `null` (the asset is soft-deleted) →
`unavailable = true`, `resolved` stays `false` (SDM-04 never touches the media field) →
`mediaPayloadValue()` returns `undefined` → `JSON.stringify` drops the key → the PUT body should not
contain `mediaAssetId` at all. `mediaField.ts`'s own doc comment states this is *exactly* the fix for
a documented Stage 5.16/5.17-B bug: "A form that kept the stale id in state and re-sent it on every
save was therefore unable to save ANY edit."

The backend's 422 message is media-reference-specific — it cannot fire unless the backend received
(and rejected) a media reference in the request. That is only possible if `mediaAssetId` **was**
present in the PUT body, which the current client source says it should not be.

**This is exactly the symptom the documented fix was written to eliminate, still occurring.** The
most parsimonious explanation, not confirmed, is that the deployed admin build predates
`mediaField.ts`'s fix (see §1/§14 deployment-lag hypothesis). SDM-04's own test code (`watch.bodies`)
already captures the actual PUT payload — but the test throws inside `saveEdit()`'s own status check
*before* reaching that payload assertion, so this run's evidence does not actually show what was
sent. Classified UNRESOLVED, with a specific, testable next step: confirm the deployed commit, or
re-run and let the (now-preserved, §6) evidence field show the captured payload.

## 10. MED-01 analysis

Failure: `total is 87 (> 50) but no pager is shown`, after `mediaPageLoad()` already waits for
`li.biawin-media-card, .biawin-media-empty` to exist (round-2 fix, ruling out "checked before the
grid rendered").

Traced against `apps/admin/src/app/media/page.tsx`, `components/media/MediaPager.tsx`,
`lib/media/mediaPagination.ts`:

- `MediaLibraryContent.loadPage()` calls `mediaApi.list(page, 50)`, then `setItems(result.items)` and
  `setTotal(result.total)` in the **same function, from the same `result` object** — there is no
  React-state path where `items` renders with a stale/zero `total`.
- `MediaPager`'s render guard is `if (totalPages <= 1) return null;`, and
  `totalPages(total, 50) = Math.ceil(total / 50)`. For `total = 87`, `totalPages = 2`, so the pager
  should render.
- `pager(page)` (`page.getByRole('navigation', { name: 'صفحه‌بندی رسانه' })`) matches
  `<nav className="biawin-media-pager" aria-label="صفحه‌بندی رسانه">` exactly — a standard,
  unambiguous ARIA role/name pair.

**No path in current source produces "cards rendered, pager absent" at `total = 87`.** Classified
UNRESOLVED. The round-2 fix (waiting for the grid) is shown by this recurrence to not have been the
(sole) cause. The concrete next step is a raw capture of `GET /admin/media`'s response body on the
next run, or confirmation that the deployed build contains `MediaPager` at all.

## 11. Cross-test patterns

### 11.1 Do the ~20s timeouts share one verifier synchronization defect?

**Partially — one confirmed, shared defect (§6): the detail field never carried the locator.** Beyond
that, the timeouts do not share one root cause provable from this evidence: some are narrowed to a
specific function by their timeout value (`expectAlert()`'s hardcoded 15000ms — ERR-01, REO-03),
most are not (the 20000ms context default is used by many different waits in many different
functions). Merging all of them into one classification would not be supported by the evidence, so
each stayed UNRESOLVED individually per §7.

### 11.2 Do the media failures share one media-library/picker state defect?

Yes, circumstantially: MED-01 (no pager despite 87 assets), MED-02 (not in this run's failures, but
structurally depends on the same pager), and MED-05 (`findMediaCard` exhausts pagination without
finding a real, unreferenced, freshly-uploaded asset) all point at the pagination control
specifically. MED-04/06/07/08's generic click timeouts are consistent with the same area
(`findMediaCard`'s `next.click()` uses the un-narrowed context timeout) but cannot be proven to be
the same cause without the preserved locator detail from §6.

### 11.3 Is the Hero failure (HERO-02) independent?

Yes. HERO-01 (same area, same run) did not fail — it is designed to degrade to NOT_RUN/BLOCKED rather
than FAIL for exactly this class of environment uncertainty (see `verifier.ts`'s HERO-01 body), and
per the operator's count it did not appear in the FAIL list. HERO-02's own generic timeout has no
evidence tying it to HERO-01 or to the media pattern.

### 11.4 Do the RBAC failures share one selector/permission problem?

RBAC-03 and RBAC-04 do not share an obvious *selector* problem — RBAC-03's selector
(`button.biawin-media-card-delete`) is specific and non-text-based (§13), and RBAC-04's failure is a
generic click timeout with no named locator. Both are consistent with the same deployment-lag
hypothesis (§14) but that is not confirmed.

### 11.5 Do ERR-03 and REO-04 expose the same error-mapping defect?

They **expose the same symptom** (verbatim raw stubbed text reaching the rendered alert), but source
inspection of `describeHomeError` (used by both `performToggleActive` and `performReorder`, via the
identical `failure()` helper) shows an unconditional, unreachable-to-bypass `if (error.status >= 500)
return fallback;` — i.e. **the error-mapping function itself is not the defect per current source.**
If there is a shared defect, it is not the one visible in `errors.ts`.

### 11.6 Are the SDM failures caused by fixture lifecycle or by UI behavior?

Not fixture lifecycle: the fixtures (`newsLegacyReplace`, `newsLegacyClear`, `newsLegacyKeep`,
`bannerLegacy`) are created via `control.ts`'s own ownership-proven direct-Prisma legacy-reference
setup, which the run's own safety result (§5: 29 fixtures created, 0 unavailable) shows succeeded.
SDM-01/03/05's failures are consistent with the deployed-UI-missing-a-feature hypothesis (§9); SDM-04
is the clearest single data point for that same hypothesis; SDM-02 (not in the failure list) does not
contradict it, because its own `pickMedia()` step matches a button label common to both the
"unavailable" and normal states (see §7's SDM-04 row) and so cannot itself prove the feature works.

## 12. ERR-03 / REO-04 detailed trace

Both stub a PUT/PATCH with `status: 500` and a message chosen specifically to be recognizable if
leaked (`PrismaClientKnownRequestError internal-stack-secret`, `internal failure text`). Both then
read `page.getByRole('alert')` and find that text verbatim.

Traced call chain for both: `apiClient.request()` → `handleResponse()` → `!body.success` →
`throw new ApiError(body.error.message, body.error.code, res.status, body.error.details)` →
`performToggleActive`/`performReorder`'s `catch` → `failure(error, fallback)` →
`describeHomeError(error, fallback)`:

```ts
export function describeHomeError(error, fallback) {
  if (!(error instanceof ApiError)) return fallback;
  const raw = (error.message ?? "").trim();
  if (error.status >= 500) return fallback;   // <- unconditional, first substantive check
  ...
}
```

`route.fulfill({ status: 500, ... })` in Playwright fabricates the real HTTP response the page's
`fetch()` sees, including the status code — so `res.status` (and thus `ApiError.status`) should be
`500`. Every step of this chain, as currently written, should discard `raw` and return the generic
Persian fallback. **No source-level explanation was found for the observed leak.** This is reported
as UNRESOLVED rather than guessed at; the single most useful piece of missing evidence is the actual
network response and the matched alert's `outerHTML` from a real run.

## 13. RBAC-03 / RBAC-04 detailed trace

**RBAC-03** — exact control: `<button className="biawin-media-card-delete">` inside
`MediaLibraryGrid`, rendered only when `{canManage && (...)}`. Page: `/media`. `canManage =
canManageHomeContent(profile?.role)`, and `canManageHomeContent` returns `role === "SUPER_ADMIN" ||
role === "CONTENT_EDITOR"` — `false` for `"SUPPORT_VIEWER"` and for `undefined`/`null`. RBAC source:
the backend's `AdminRolesGuard` is the actual authorization boundary (per `rbac.ts`'s own comment);
this button is UX-only. `AdminRouteGuard` withholds all children (including this page) until
`isAuthenticated` is non-null, and `isAuthenticated`/`profile` are set together in one `restore()`
call — no window exists where the media page is visible with an unresolved/default role. The
verifier's selector (`button.biawin-media-card-delete`) is a specific CSS class, not a text search —
not overly broad. **No code path was found that would show this control to SUPPORT_VIEWER per current
source.**

**RBAC-04** — CONTENT_EDITOR's first use of its own browser context this run (`asRole('CONTENT_EDITOR')`
triggers a fresh login). Failure is a generic click timeout with no locator preserved by this run's
evidence (§6 will fix this for future runs). Candidates from source: the news-create submit button,
`mediaPageLoad()`'s own grid wait, `findMediaCard()`'s pagination, or the delete-confirm click — all
plausible, none provable from a one-line summary.

## 14. Deployment-lag hypothesis (not confirmed — the report's central open question)

`deploy/staging/run-stage-5-17-c-browser-qa.sh`'s own header states: *"Deliberately does NOT deploy,
rebuild-and-restart, or touch the running backend/web/admin containers."* The only thing it rebuilds
is a **separate, one-off** `backend` image used solely by `control.js` (setup/teardown/verify) — the
**persistently running** `backend`/`admin`/`web` containers that the browser actually talks to are
only ever updated by the fully separate, manual, `workflow_dispatch`-only `Deploy Staging` workflow
(`.github/workflows/deploy-staging.yml`, confirmed `workflow_dispatch` only, no auto-deploy-on-push).

This means every browser-observed behavior in this run reflects whatever was **last manually
deployed**, which can be arbitrarily far behind `main` — while `control.js`'s own fixture
setup/teardown (and this report's source reading) reflects `main` exactly. Several UNRESOLVED
findings above are the *exact* symptom a documented, already-committed fix would produce if the
deployed build predates it:

- **SDM-04** (§9): the precise bug `mediaField.ts` documents itself as fixing.
- **SDM-01/03/05**: depend on the Stage 5.17-B legacy-media-warning UI existing at all.
- **BAN-03** (§8) and **MED-01** (§10): both are provably-correct-per-source, yet failed
  identically/repeatedly.
- **RBAC-03** (§13): provably-correct-per-source RBAC gating.

**This is not confirmed** — this report has no access to the actual deployed commit SHA on staging.
It is the single highest-value thing to check before writing any more verifier code, because if
correct, no amount of further verifier work will make these tests pass until staging is redeployed.

## 15. Verifier fixes made

Exactly one, classified VERIFIER_BUG with CONFIRMED evidence (§6): `summarizeError()` added to
`qa-orchestration.ts`, used in `verifier.ts`'s `runTest` catch block in place of
`err.message.split('\n')[0]`. Regression test: 4 new cases in
`backend/src/qa-contract/stage-5-17-g-artifact-isolation.spec.ts`, including a reproduction of the
exact real-world Playwright timeout shape and proof the old code would have dropped the locator.

No assertion was removed or weakened. No test's PASS/FAIL condition changed. No Admin UI, backend
application code, Prisma schema/migrations, or seed data was modified.

## 16. Product/backend defects discovered

None **confirmed**. §14's deployment-lag hypothesis, if correct, means the *symptoms* observed are
not defects in `main`'s committed code at all — they would be an artifact of staging not yet running
`main`. No product-code defect is claimed in this report.

## 17. Unresolved items

All of §7's 25 entries except the one shared, confirmed verifier defect (§6) remain UNRESOLVED.
Grouped by what evidence would resolve them:

- **Needs the preserved locator detail (now available from the next run via §6):** NAV-01, NAV-02,
  HERO-02, BAN-01, MOS-02, NEWS-01, NEWS-02, SDM-01, SDM-05, MED-04, MED-06, MED-07, MED-08, ERR-02,
  RBAC-04.
- **Needs a network/DOM capture specifically:** BAN-03 (row's real categoryId), SDM-04 (actual PUT
  payload), MED-01/MED-05 (raw `GET /admin/media` response and pager DOM), ERR-01/REO-03 (the
  toggle/reorder response body), ERR-03/REO-04 (the response body and the matched alert's
  `outerHTML`), RBAC-03 (a screenshot/DOM dump of the SUPPORT_VIEWER session).
- **Needs confirmation of the deployed commit** (§14, the highest-leverage single check): all of the
  above, since a deployment-lag confirmation would immediately explain most of them without further
  verifier changes.

## 18. Recommended next execution

1. **Before any further verifier changes:** confirm what commit is actually running in staging's
   `admin`/`backend` containers (compare against `main`/`08bd809`+). This one check could resolve or
   rule out the majority of §7's UNRESOLVED entries at once.
2. If staging is behind `main`, run the existing, separate `Deploy Staging` workflow (manual,
   `workflow_dispatch`) — **not part of this stage, and not run here** — then re-run Browser QA.
3. If staging is already current, re-run Browser QA with this stage's fix in place: the next
   report's `detail` fields will carry the full (collapsed, capped) error text, including the actual
   Playwright locator for every timeout, which this report could not obtain.
4. Re-classify from that evidence rather than from another summary paste, since full detail plus
   `browser-results.json`'s per-test `evidence` object will be available.

## 19. Explicit statement

No product code was changed: no backend application code, no Admin UI code, no Prisma schema,
migrations, or seed data was modified in this stage. No staging business data was manually altered.
The only code changes are the two files listed in §6/§15 (`qa-orchestration.ts`, `verifier.ts`) plus
their regression test. Browser QA was not run again during this stage.
