# Staging Alignment Report (Stage 5.9 — Diagnosis Only)

No code was written or modified to produce this report. Pure
investigation: git state, the deploy pipeline, and a live comparison
against `staging.biawin.ir`, per this stage's explicit instructions.

**Bottom line, stated up front:** the deployment pipeline is not broken.
Staging is correctly running exactly what exists on `origin/main` — the
problem is that **none of the Home/Wallet/Credit/Installment/Services/
AppShell/Navigation work (Stages 4.1–9.1) was ever committed or pushed**.
It has existed only as uncommitted changes in this one local working
tree the entire time. `deploy.sh` has had nothing new to pull.

---

## 1. Git State

| | |
|---|---|
| Current local branch | `main` |
| Local `main` HEAD | `5fb0e29` — "fix(orbit): connect the 12th Orbit asset (insurance) that never deployed" |
| `origin/main` HEAD | `5fb0e29` — **identical to local** (`git rev-list --left-right --count main...origin/main` → `0  0`) |
| Branches that exist (local or remote) | Exactly one: `main`. `git ls-remote --heads origin` returns only `refs/heads/main`. No feature branches, no other refs. |
| Stashes | None (`git stash list` empty) — the missing work isn't stashed away either |
| Working tree | 2 modified tracked files + 31 untracked paths (full list in §4) — **all uncommitted** |

The last 5 commits on `main` (local = remote, identical) are all Orbit
Landing work:

```
5fb0e29 fix(orbit): connect the 12th Orbit asset (insurance) that never deployed
513d39e feat(orbit): replace static Orbit catalog with a database-backed Media Library + Admin API
47bd6ab feat(web): freeze Orbit production catalog at 12 items (Stage 1.9)
f3d2c2a feat(web): connect second production Orbit asset batch (7 of 8 regenerated)
3d62e85 feat(web): connect first production Orbit asset batch (4 of 12)
```

Nothing from Stage 4.1 onward (Home Dashboard, AppShell, Navigation,
Wallet v1, Credit v1, Installment v1, Services v1) has a commit at all —
not on `main`, not on any branch, not anywhere in git history.

**Build artifact version:** there is no version/commit tagging scheme for
Docker images in this pipeline (`docker-compose.staging.yml` builds
untagged `latest` local images; `deploy.sh` has no `docker build --build-arg
GIT_SHA=...` or image-label step). The only meaningful "version" concept
is *which commit was checked out when `docker compose build` last ran* —
and since `deploy.sh` always does `git reset --hard origin/main`
immediately before building, that's equivalent to asking "what is
`origin/main` HEAD," which is `5fb0e29`.

---

## 2. Staging Pipeline Verification

### `deploy.sh` (`deploy/staging/deploy.sh`) — verified correct, not the problem

```
1/6  git fetch origin main && git checkout main && git reset --hard origin/main
2/6  docker compose build backend web
3/6  bring up postgres/redis/minio, wait for health
4/6  prisma migrate deploy && prisma db seed
5/6  docker compose up -d backend web
6/6  curl health checks on both
```

Step 1 is the entire explanation: it deploys **exactly** `origin/main`,
nothing else. There is no branch-selection logic, no environment
variable that could point it at a different ref, no cache directive that
could serve stale content from a *newer* commit than what's checked out.
The script is doing precisely what it's designed to do — the input
(`origin/main`) is simply behind.

### Docker image — not the problem

`deploy/staging/Dockerfile.web` is a standard multi-stage build (`deps` →
`build` → `runtime`) that `COPY`s source from the build context, which is
the freshly-`reset --hard`-ed working tree from step 1. No layer caching
issue is possible here for *missing routes* specifically — a stale cache
could theoretically serve old *content* for unchanged files, but it
cannot serve routes (`/wallet`, `/credit`, etc.) that were never present
in any commit `COPY`'d into any image at all. Confirmed directly: `git
ls-tree -r --name-only 5fb0e29 -- apps/web/src/app` lists only
`page.tsx` (Landing) and `home/page.tsx` — no `wallet/`, `credit/`,
`installments/`, `services/`, `profile/`, `rewards/` directories exist in
that commit for any Docker build to have picked up.

### Environment variables — not the problem

`deploy/staging/.env.staging` (server-only, gitignored) supplies
`NEXT_PUBLIC_API_URL=https://api-staging.biawin.ir/api/v1` and standard
DB/Redis/MinIO/CORS values per `docs/08-staging-deployment.md`. None of
these affect *which routes exist* in the built Next.js app — that's
purely a function of which `.tsx` files were present in the git checkout
at build time.

### Branch source — not the problem (in the sense of "wrong branch")

`deploy.sh` hardcodes `origin/main`, and `origin/main` is the only branch
that has ever existed on this remote. There is no wrong-branch scenario
possible here — there's only one branch, and it's the one being deployed.

### Build output — confirms the above

Live `curl` checks against `staging.biawin.ir` this session:

```
GET /                200  (Landing — matches 5fb0e29)
GET /home             200  (client-side redirects to "/" for an unauthenticated
                            visitor; the underlying page is 5fb0e29's Sprint-0-A
                            auth-success placeholder, not the real dashboard —
                            see §3)
GET /wallet           404
GET /credit           404
GET /installments     404
GET /services          404
GET /profile           404
GET /rewards            404
```

This is exactly what a Next.js build of commit `5fb0e29` produces — those
six routes 404 because their `page.tsx` files don't exist in that
commit, not because of a routing misconfiguration, a proxy issue, or a
CDN/cache problem. (`api-staging.biawin.ir/api/health` responds `{"status":
"ok"}` — the backend and the LiteSpeed reverse proxy are both healthy;
this is purely a "which frontend code got built" issue.)

### CI (`ci.yml`) — not implicated

Runs lint/typecheck/test/build on push/PR, no server access. Since
nothing has been pushed past `5fb0e29`, CI has had nothing new to
validate either — consistent with everything else found here, not a
separate problem.

---

## 3. Route Comparison: Local (working tree) vs. Staging

| Route | Local working tree (uncommitted) | Staging (deployed `5fb0e29`) |
|---|---|---|
| `/` (Landing) | Present, Orbit landing v16 | ✅ Present — **matches**, this was the last thing actually committed |
| `/home` | Full Home Dashboard (Stage 4.1–4.4): hero carousel, financial summary cards, quick actions, stories, ticker, featured banner, membership stories | Sprint-0-A placeholder only — literally titled in its own code comment: *"ورود با موفقیت انجام شد. داشبورد کامل خانه در Sprint 0-B ساخته می‌شود."* ("Login succeeded. The full home dashboard will be built in Sprint 0-B.") This **is** the "Auth success page" / "Sprint 0-B dashboard placeholder" referenced in this stage's brief — confirmed by reading `git show 5fb0e29:apps/web/src/app/home/page.tsx` directly. |
| `/wallet` | Wallet Overview + Transaction History (Stage 6.1) | ❌ 404 — route doesn't exist in the deployed commit |
| `/credit` | Credit Overview (Stage 7.1) | ❌ 404 |
| `/installments` | Installment List + Detail (Stage 8.1) | ❌ 404 |
| `/services` , `/services/[categoryId]` , `/services/[categoryId]/[serviceId]` | Services browse — List/Category/Detail (Stage 9.1) | ❌ 404 |
| `/profile` , `/rewards` | Stage 5.2 placeholder pages (reserved routes, minimal content) | ❌ 404 — even the *placeholders* for these never made it, since Stage 5.2's route scaffolding itself was never committed |

Also entirely missing from staging because they were never committed:
`components/shell/` (`AppShell`, `AuthGuard`, `GlobalHeader`,
`PageContainer`, `PageHeader`, `navigation.ts`) — the shared shell every
one of the above pages depends on — and `components/common/`
(`SkeletonBlock`, `ComingSoonCaption`, `NotificationButton`).

---

## 4. Root Cause

**Confirmed cause: uncommitted local work, not a deployment pipeline
defect.** Ranking the possibilities this stage asked to check:

| Possible cause | Verdict |
|---|---|
| Wrong branch deployed | ❌ Ruled out — only one branch exists (`main`), locally and remotely, and `deploy.sh` correctly targets it |
| Old Docker image (stale cache) | ❌ Ruled out — `deploy.sh` always rebuilds from a fresh `git reset --hard origin/main`; no route can be "cached back in" that was never in a commit to begin with |
| Old commit deployed | ✅ **Partially true, but not a deploy-script bug** — `origin/main` genuinely is `5fb0e29`, and deploying it is correct behavior given that input. The commit is "old" only because nothing newer was ever pushed. |
| Frontend build cache | ❌ Ruled out — same reasoning as Docker image; Next.js's own build cache can't materialize routes whose source files don't exist in the checkout |
| Wrong environment | ❌ Ruled out — `NEXT_PUBLIC_API_URL`, CORS, and every other env value checked against `docs/08-staging-deployment.md` match the intended staging configuration |
| Deployment pipeline issue | ❌ Ruled out — `deploy.sh` and `deploy-staging.yml` both do exactly what they're documented to do; verified step-by-step above |
| **Work never committed/pushed** | ✅ **This is the actual root cause** — `git status` shows 31 untracked paths + 2 modified tracked files covering all of Stages 4.1–9.1, sitting only in this local working tree. `git log`/`git ls-remote` confirm `origin/main` has never had a commit past the Orbit work. There is nothing for `deploy.sh` to have pulled. |

---

## Current Staging Version

**Commit `5fb0e29`** (= current `origin/main` HEAD) — Orbit Landing
foundation + Sprint-0-A auth-success placeholder at `/home`. No AppShell,
no Navigation foundation, no Wallet/Credit/Installment/Services modules,
no `/profile` or `/rewards` routes (not even Stage 5.2's placeholders).

## Expected Version

A commit containing everything currently sitting uncommitted in the
local working tree: Stage 4.1–4.4 (real Home Dashboard), Stage 5.1–5.2
(AppShell + Navigation foundation + all 7 route placeholders), Stage 6.1
(Wallet v1), Stage 7.1 (Credit v1), Stage 8.1 (Installment v1), and Stage
9.1 (Services v1 browse). 31 new files + 2 modified tracked files in
total (exact list in §1/§4 — `apps/web/src/app/{credit,installments,
profile,rewards,services,wallet}/`, `apps/web/src/components/{common,
credit,home,installment,services,shell,wallet}/`, 6 files under
`apps/web/src/lib/`, plus `apps/web/src/app/home/page.tsx` and
`packages/ui/src/components/Modal.tsx` as modifications to already-
tracked files, plus this session's own 11 `docs/*.md` deliverables from
those stages).

## Missing Deployment Step

Not a missing *deployment* step at all — a missing **source-control**
step, upstream of deployment entirely:

```
git add → git commit → git push origin main
```

None of these three ever happened for any of Stages 4.1 through 9.1.
`deploy.sh`'s first action (`git reset --hard origin/main`) is exactly
correct — it's just resetting to a ref that was never advanced.

## Exact Fix Required

**No code changes were made to produce this report, per this stage's
explicit instruction — the following is the fix to run in a subsequent,
separate stage, not something executed here:**

1. On this machine, review `git status` / `git diff` one more time
   immediately before committing (standard practice already documented
   in `docs/09-git-workflow.md` — confirm no `.env`/secret files are
   staged; none currently appear in the untracked list, but re-check at
   commit time).
2. `git add` the 31 untracked paths + 2 modified files, then `git commit`
   — per this project's actual practiced workflow (`docs/09-git-workflow.md`
   §"Local development → first push": direct commits to `main`, no
   feature-branch/PR step has been used for any prior stage either).
   Given the size (6 stages of independent, already-QA'd work), consider
   whether the user wants this as one commit or split per stage/module
   for a cleaner history — a judgment call for that stage, not this one.
3. `git push origin main`.
4. CI (`ci.yml`) runs automatically on that push — confirm it passes
   before deploying.
5. Deploy to staging the same way every prior deploy has been done (per
   `docs/08-staging-deployment.md` — the GitHub Actions path is still
   gated on 4 missing repository secrets):
   ```bash
   ssh -p 2490 root@62.204.61.18
   cd /srv/biawin-staging
   ./deploy/staging/deploy.sh
   ```
6. Re-run this stage's route comparison (§3) against staging afterward to
   confirm `/wallet`, `/credit`, `/installments`, `/services`,
   `/profile`, `/rewards` all resolve and `/home` shows the real
   dashboard, not the Sprint-0-A placeholder.

No other pipeline, infrastructure, environment, or configuration change
is needed — every mechanism downstream of `git push` was verified
working correctly in §2.
