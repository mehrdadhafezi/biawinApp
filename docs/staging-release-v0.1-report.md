# Staging Release Report — Biawin v0.1 (Stage 5.11)

First complete staging release, executing the plan approved in
`docs/release-readiness-report.md` (Stage 5.10) after the diagnosis in
`docs/staging-alignment-report.md` (Stage 5.9). No new features were
built in this stage — commit, push, and deploy only.

**Result: release succeeded. All 8 required routes are live on staging
with real backend data, zero console errors, and zero responsive
overflow.**

---

## 1. Final Diff Review (before commit)

Re-reviewed the full working tree one more time immediately before
staging, per this stage's instruction:

- `git status` matched `docs/release-readiness-report.md`'s inventory
  exactly: 71 untracked files + 2 modified tracked files (72 including
  the readiness report itself, created after that report's snapshot —
  74 files total once staged).
- Re-read the full diffs for both modified tracked files in full (not
  just the stat summary):
  - **`packages/ui/src/components/Modal.tsx`** — confirmed purely
    additive: 3 new `@keyframes` + `animation` on the overlay/panel, a
    `prefers-reduced-motion` guard that disables both, zero changes to
    `ModalProps` or component behavior. Grep-checked the only consumer
    (`AuthModal.tsx`, already-shipped Auth flow) — no new module
    actually depends on this change, but it's safe for the one that
    does.
  - **`apps/web/src/app/home/page.tsx`** — confirmed the diff is exactly
    "remove the Sprint-0-A inline placeholder, compose the real
    dashboard through `AppShell`" — net *fewer* lines despite being far
    more capable.
- Read `apps/web/src/components/shell/AppShell.tsx` and
  `AuthGuard.tsx` in full (the "shared shell components" this stage
  specifically called out): `AuthGuard` correctly renders `null` during
  the unresolved (`isAuthenticated === null`) and about-to-redirect
  states — no protected content ever flashes before the guard resolves.
  `AppShell` reuses the existing `useAuth()` context unmodified, fetches
  the profile once, and doesn't reimplement any auth/token logic. No
  concerns found.

## 2. Safety Re-Verification

Re-ran the checks from `docs/release-readiness-report.md` §3 immediately
before staging (not just trusting the prior report):

| Check | Result |
|---|---|
| Secrets | ✅ Clean — no matches in a fresh content scan |
| `.env` files | ✅ Clean — `apps/web/.env.local` / `backend/.env` exist on disk but stayed out of `git status` (gitignored) |
| Database dumps | ✅ Clean — no `.sql`/`.dump` files |
| Test artifacts | ✅ Clean — all temporary DB rows from every module's QA were already deleted (per each implementation report); nothing file-based was ever created |
| Screenshots | ✅ Clean — zero binary files among the 74 staged paths |
| Local artifacts | ✅ Clean — no `.next/`, `.turbo/`, `.tsbuildinfo` staged |

`git diff --cached --name-only | grep -E "(^|/)\.env$"` returned nothing
immediately before commit — the exact check `docs/09-git-workflow.md`
prescribes.

## 3. Release Commit

```
commit 59a33cedec2543877ece431ae69ef38a1228fc54
feat: biawin app v0.1 foundation release

App Shell + Navigation foundation, Home Dashboard, and read-heavy v1s of
Wallet, Credit, Installment, and Services (browse-only) — first complete
staging-deployable feature set beyond the Sprint-0-A auth placeholder.

74 files changed, 6348 insertions(+), 56 deletions(-)
```

One commit, as instructed — not split per module (Stage 5.10's §5 offered
a 9-commit split as an option but explicitly noted a single commit is
equally valid; this stage asked for exactly one).

## 4. Push

```
git push origin main
   5fb0e29..59a33ce  main -> main
```

`origin/main` advanced from the Orbit-only commit (`5fb0e29`, unchanged
since before Stage 4.1) to `59a33ce`. Verified via SSH immediately
before deploying that the server's own clone was still at `5fb0e29`
(confirming Stage 5.9/5.10's diagnosis was accurate right up to this
push) before running the pipeline.

## 5. Staging Deployment

Ran `./deploy/staging/deploy.sh` on the server via SSH, per
`docs/08-staging-deployment.md` (the GitHub Actions path remains gated
on the 4 missing repository secrets — unchanged from Stage 5.9's
finding, not addressed here since it's out of this stage's scope).

All 6 steps completed successfully:

1. `git fetch` + `reset --hard origin/main` → server now at `59a33ce`
2. `docker compose build backend web` → both images built; the `web`
   build's own `next build` output confirms all 10 routes compiled:
   `/`, `/credit`, `/home`, `/installments`, `/profile`, `/rewards`,
   `/services`, `/services/[categoryId]`,
   `/services/[categoryId]/[serviceId]`, `/wallet`
3. Infra (postgres/redis/minio) came up healthy
4. `prisma migrate deploy` — no pending migrations (schema unchanged
   this release); `prisma db seed` — re-ran cleanly (categories,
   services, membership plans, rewards, orbit items)
5. `backend`/`web` containers cut over
6. Health check passed: backend healthy on `127.0.0.1:4001`, web
   responding on `127.0.0.1:3001`

No rollback was needed — the deploy script's own health gate passed on
the first attempt.

---

## 6. Live Verification on `staging.biawin.ir`

### Route status

| Route | Before this release (Stage 5.9) | After this release |
|---|---|---|
| `/` | 200 | ✅ 200 |
| `/home` | 200 (Sprint-0-A placeholder) | ✅ 200 — **real dashboard** |
| `/wallet` | 404 | ✅ 200 |
| `/credit` | 404 | ✅ 200 |
| `/installments` | 404 | ✅ 200 |
| `/services` | 404 | ✅ 200 |
| `/services/[categoryId]` | 404 | ✅ 200 (verified with a real category id, `bd8c65b8-...`) |
| `/profile` | 404 | ✅ 200 (Stage 5.2 placeholder — no Profile implementation stage has run yet, expected) |
| `/rewards` | 404 | ✅ 200 (same — Stage 5.2 placeholder, expected) |

### Auth flow — verified end-to-end against the live staging backend

1. Landing → "ورود / ثبت نام" → phone step → entered `09121111111`
2. `POST /auth/otp/request` succeeded (OTP step rendered with the real
   "کد ۶ رقمی به 09121111111 ارسال شد" confirmation and a live countdown)
3. Entered the staging test code `123456` (`STAGING_TEST_AUTH=true`,
   per `docs/08-staging-deployment.md`) → `POST /auth/otp/verify`
   succeeded
4. Redirected to `/home` → **real dashboard rendered**, including
   `"سلام Staging"` (the seeded staging test user's actual profile
   `fullName`, fetched live) — not a hardcoded name, confirming
   `AppShell`'s profile-fetch works against the real staging API

### Navigation — verified by clicking, not just typing URLs

Bottom nav "🛍️ خدمات" tap → `router.push` correctly navigated to
`/services`. Tapped a category chip → navigated to
`/services/bd8c65b8-a650-4b8b-ac11-27bd173bbe70` with the grid correctly
filtered. Tapped a service card → navigated to
`/services/bd8c65b8-.../a1ef4dbe-...` with the full Service Detail
(hero, pricing, disabled purchase CTA showing "به‌زودی") rendering
correctly.

### API connectivity — confirmed with real staging data, not mocks

Every page pulled live data from the staging backend/database, not
placeholder text:

- Home: membership cards (Earn/Core/Reward + 8 tier cards, all
  "غیرفعال" since the test user has no active membership), 19 real
  categories in the ticker/featured banner, wallet balances (`0 تومان`
  ×2 — real `Wallet` rows from signup), correctly empty credit/installment
  states
- Wallet: `"هنوز تراکنشی ثبت نشده."` — correct empty state, real fetch
- Credit: `"هنوز خط اعتباری فعالی نداری."` — correct empty state
- Installments: `"هنوز خرید اقساطی‌ای ثبت نشده."` — correct empty state
- Services: all 108 seeded services across all 19 categories rendered
  with real prices/badges/methods
- Profile / Rewards: correctly still show the Stage 5.2 placeholder text
  (`"این بخش به‌زودی فعال می‌شود."`) — confirms this release didn't
  accidentally regress or fake those two

`read_console_messages` (onlyErrors) returned **zero errors** on every
page checked: `/`, `/home`, `/wallet`, `/credit`, `/installments`,
`/services`, `/services/[categoryId]`, `/services/[categoryId]/[serviceId]`,
`/profile`, `/rewards`.

### Responsive layout — checked live against the real deployment

| Width | Result |
|---|---|
| 375×812 (mobile) | ✅ `scrollWidth === clientWidth` — zero horizontal overflow |
| 1920×1080 (desktop) | ✅ zero overflow; `<main>` measured at exactly 760px, centered — the `AppShell` containing-block trick works identically on the real LiteSpeed-proxied production build, not just local dev |

---

## What Was Not Re-Tested Here

- **Logged-out `AuthGuard` redirect on staging specifically** — not
  re-verified live in *this* session (the verification browser session
  stayed authenticated across tabs via shared `localStorage`, so a true
  logged-out request wasn't exercised against staging this time).
  Substituted with: (a) `AuthGuard.tsx`'s redirect logic was read in
  full this session (§1) and is unchanged from what every prior module
  already validated locally, and (b) Stage 5.9's pre-release check
  already confirmed these exact routes 404'd for an unauthenticated
  request before this release (there was no page to reach yet); now
  that the pages exist, the same `AuthGuard` wrapper gates all of them
  identically. Low risk, but flagged rather than silently assumed.
- **Purchase flows, Profile, Rewards** — out of scope by design, not
  built yet (this release is browse-only for Services, and Wallet/
  Credit/Installment are display-only) — nothing to test that isn't
  already covered by "shows the correct placeholder/empty state" above.

---

## Status: Biawin v0.1 Foundation Release — LIVE ON STAGING

`staging.biawin.ir` now serves commit `59a33ce`. Landing, Auth, Home
Dashboard, Wallet, Credit, Installments, and Services (browse) are all
real, live-data features backed by the actual staging database — closing
the gap `docs/staging-alignment-report.md` identified. Profile and
Rewards remain Stage 5.2 placeholders, correctly and intentionally, with
no implementation stage having run for either yet.
