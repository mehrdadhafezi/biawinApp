# Admin Portal Shell — Implementation Report (Stage 5.17)

Source of truth: `docs/admin-architecture-decision-record.md` and the
Stage 5.16 `/admin/auth/**` API (`docs/admin-identity-foundation-report.md`).
Scope: the Admin frontend shell only — no CMS, no Home Management, no Media
Library, no Customer App change.

## 1. Files created/changed

### New app: `apps/admin` (Next.js 16, App Router, TypeScript, Tailwind v4 — mirrors `apps/web`'s toolchain exactly)

**Scaffolding**: `package.json`, `tsconfig.json`, `next.config.ts`,
`eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `.env.example`
(`NEXT_PUBLIC_ADMIN_API_URL`, declared independently of `apps/web`'s
`NEXT_PUBLIC_API_URL` per ADR §11, same backend).

**Auth/API layer** (`src/lib/`):
- [api-client.ts](../apps/admin/src/lib/api-client.ts) — mirrors `apps/web/src/lib/api-client.ts` line-for-line (same fetch wrapper, same single-silent-refresh-on-401 pattern), pointed at admin's own token store and `/admin/auth/refresh`
- [auth/admin-token-storage.ts](../apps/admin/src/lib/auth/admin-token-storage.ts) — distinct localStorage keys (`biawin.admin.*`, not `biawin.*`)
- [auth/admin-auth-api.ts](../apps/admin/src/lib/auth/admin-auth-api.ts) — thin wrapper over Stage 5.16's 4 endpoints
- [auth/admin-auth-context.tsx](../apps/admin/src/lib/auth/admin-auth-context.tsx) — `AdminAuthProvider` / `useAdminAuth()`, plus the exported pure `resolveInitialAuthState()` (see §4/§4.3)

**Foundation components** (`src/components/`):
- [shell/AdminShell.tsx](../apps/admin/src/components/shell/AdminShell.tsx), [shell/AdminSidebar.tsx](../apps/admin/src/components/shell/AdminSidebar.tsx), [shell/AdminHeader.tsx](../apps/admin/src/components/shell/AdminHeader.tsx)
- [shell/AdminRouteGuard.tsx](../apps/admin/src/components/shell/AdminRouteGuard.tsx) — plus exported pure `shouldRedirectFromGuard()`
- [auth/AdminLoginForm.tsx](../apps/admin/src/components/auth/AdminLoginForm.tsx) — plus exported pure `performAdminLogin()`

**Routes** (`src/app/`):
- `layout.tsx` — RTL, Vazirmatn font, wraps in `AdminAuthProvider`
- `page.tsx` — `/` → `redirect("/login")`
- `login/page.tsx` — public, wrapped in `<AdminRouteGuard mode="require-guest">`
- `dashboard/page.tsx` — protected, wrapped in `<AdminRouteGuard mode="require-auth"><AdminShell>` — foundation placeholder content only, no business features

**Tests** (co-located `*.test.ts`/`*.test.tsx`, 12 tests / 4 suites — see §4.4 for why the shape differs from a typical RTL suite):
- `src/lib/auth/admin-auth-context.test.ts`
- `src/components/shell/AdminRouteGuard.test.tsx`
- `src/components/auth/AdminLoginForm.test.ts`
- `src/app/login/page.test.tsx`
- `jest.config.js`, `jest.env-setup.js`

### Shared packages

- `packages/types/src/admin.ts` (new) — `AdminRole`, `AdminLoginInput`, `AdminProfile`, exported from `packages/types/src/index.ts`. `AuthTokens` (already existing) is reused as-is for admin tokens — identical shape, no duplicate type needed.

### Root/workspace

- `package.json` — added `dev:admin` script, matching the existing `dev:web`/`dev:backend` pattern
- `pnpm-lock.yaml` — updated for the new app's dependencies

### Backend (config only, no code)

- `backend/.env.example` (and local `backend/.env`, gitignored) — `CORS_ORIGINS` extended to include `http://localhost:3002` (apps/admin's dev origin). **This was a real bug found during live verification**, not a preemptive change: the backend's CORS allow-list only had `apps/web`'s origin, so every `/admin/auth/**` request from `apps/admin` failed the browser's CORS preflight before Stage 5.16's own auth logic ever ran. Fixed per ADR §12.8's own requirement — admin's origin as its own allow-list entry, not folded into the same value web checks against.
- `.claude/launch.json` (local, gitignored — not part of this commit) — added an `admin` dev-server entry for local preview tooling only.

## 2. Architecture decisions implemented

Every choice below traces to a specific ADR section — none introduced ad hoc:

- **Separate app, same monorepo, own design system** (ADR §1): `apps/admin` is its own Next.js app, not routes bolted onto `apps/web`. It reuses `@biawin/ui`'s design **tokens** (`color`, `font`, and the generic `Button`/`Input` primitives) but not `apps/web`'s mobile-shell layout components (`AppShell`, `BottomNavigation`) — `AdminShell`/`AdminSidebar`/`AdminHeader` are a genuine desktop sidebar+header layout, built fresh.
- **Isolated authentication** (ADR §3): `apps/admin` never imports anything from `apps/web/src/lib/auth/**`. Separate token-storage keys, separate API client instance, separate context (`AdminAuthProvider`, not `AuthProvider`). Calls only `/admin/auth/**`, never `/auth/**`.
- **Session management goes one step further than the customer pattern** (beyond ADR, a direct consequence of RBAC existing at all): `AdminAuthProvider` also resolves the signed-in admin's *profile* (id/email/fullName/role) via `GET /admin/auth/me`, not just an authenticated boolean — needed for role-aware UI (the header's role badge today; a future role-gated sidebar item later) and doubles as the live validity check described next.
- **Secure token handling, consistent with what Stage 5.16 built**: `apiClient`'s single-silent-refresh-then-retry on 401 means an admin session naturally re-validates against `AdminJwtStrategy`'s per-request `AdminUser.active` check (see `docs/admin-identity-foundation-report.md` §3 item 6) — a disabled admin's session dies within one request cycle, not just at token expiry.
- **Route protection is client-side, not middleware** (mirrors ADR-adjacent `apps/web` precedent exactly): tokens live in `localStorage`, which Next.js middleware cannot read — `AdminRouteGuard` is built on `useAdminAuth()`, the same reasoning `apps/web`'s `AuthGuard` already documents.
- **CORS as its own allow-list entry, not appended to the customer value** (ADR §12.8): implemented and *verified live* — see §3.

## 3. Authentication flow

1. **Login** — `AdminLoginForm` calls `performAdminLogin()` (pure, testable), which calls `adminAuthApi.login({email, password})` → `POST /admin/auth/login`. On success: tokens are hashed into `AdminAuthProvider.setAuthenticated()`, which stores them (`adminTokenStorage`) and immediately re-resolves the profile; the form then calls `router.push("/dashboard")`. On failure: the `ApiError`'s message (from Stage 5.16 — e.g. *"ایمیل یا رمز عبور نادرست است."*) renders inline; no navigation, no tokens stored.
2. **Session restoration** — on mount, `AdminAuthProvider` calls `resolveInitialAuthState()`: no stored access token → unauthenticated immediately, no network call. A stored token → `GET /admin/auth/me`; success sets `isAuthenticated: true` + `profile`; failure (expired/revoked/disabled) clears storage and reports unauthenticated — the same outcome as never having a session.
3. **Route protection** — `AdminRouteGuard` reads `isAuthenticated` from context and redirects: `require-auth` routes (`/dashboard`) bounce a signed-out visitor to `/login`; `require-guest` routes (`/login`) bounce an already-signed-in visitor to `/dashboard`. `null` (check still in flight) renders nothing either way, avoiding a content flash.
4. **Logout** — clears local storage immediately (so the UI reacts instantly) and best-effort calls `POST /admin/auth/logout` to revoke the refresh token server-side; a network failure here doesn't block the local logout.
5. **Token refresh** — transparent: any authenticated request that 401s triggers one silent `POST /admin/auth/refresh` (with the customer-app's exact retry-once, shared-in-flight-promise pattern to avoid a refresh stampede) before the caller ever sees the failure.

**Live end-to-end verification** (local dev server, real HTTP calls against the Stage 5.16 backend seeded `SUPER_ADMIN` — not just the unit tests below):
- Visiting `/dashboard` signed out → redirected to `/login` ✓
- Logging in with `admin@biawin.ir` / the seeded password → tokens stored, redirected to `/dashboard`, header shows *"مدیر ارشد" / "Biawin Admin" / "admin@biawin.ir"* (real profile data) ✓
- Reloading `/dashboard` fresh → session restored from storage, same profile shown, no re-login needed ✓
- Logging in with a wrong password → inline error *"ایمیل یا رمز عبور نادرست است."*, stayed on `/login` ✓
- Clicking "خروج" (logout) → tokens cleared, redirected to `/login` ✓
- `GET /admin/audit-logs` (as `SUPER_ADMIN`) after this session showed the real `LOGIN_FAILED` (`bad_password`) and `LOGOUT` entries this browser session generated, with the real browser's user-agent — confirming Stage 5.16's audit logging captures Stage 5.17's real traffic, not just its own test calls.

A real bug was found and fixed during this live pass, not assumed away: the backend's `CORS_ORIGINS` didn't include `apps/admin`'s origin, so the very first login attempt failed at the browser's CORS preflight (`backend/.env`/`.env.example`, §1).

## 4. Test results

```
Test Suites: 4 passed, 4 total
Tests:       12 passed, 12 total
```

Mapped to the 5 required scenarios:

| Required scenario | Test(s) |
|---|---|
| Login rendering | `src/app/login/page.test.tsx` — static-render smoke test (see §4.4) confirming email/password fields and a submit button are present |
| Successful login flow | `AdminLoginForm.test.ts` → `performAdminLogin` succeeds: stores tokens, signals success |
| Failed login | `AdminLoginForm.test.ts` → `performAdminLogin` fails with the server's message on invalid credentials; also a generic-message fallback case for a non-`ApiError` failure |
| Protected route redirect | `AdminRouteGuard.test.tsx` → `shouldRedirectFromGuard` unit tests (all mode × state combinations) + static-render checks that protected/guest content is actually suppressed |
| Auth state restoration | `admin-auth-context.test.ts` → `resolveInitialAuthState`: restores session+profile from a valid token, treats a missing token as unauthenticated with zero API calls, clears state on an invalid/expired token |

### 4.1 A deliberate substitution, disclosed up front

**`jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` could not be installed.** The npm registry was unreachable specifically for these packages for the entire implementation window — confirmed via direct `curl` to `registry.npmjs.org` (not a `pnpm`-specific issue) and via ~9 minutes of `pnpm install` retries with increased `fetch-retries`/timeouts, both before falling back. This is the same class of environmental constraint Stage 5.16 hit with `bcryptjs` (resolved there by substituting Node's built-in `crypto.scrypt`); the same principle applies here.

### 4.2 What changed as a result

Every genuinely testable **decision** — the thing each required scenario is actually about — is factored out of its component as a plain, dependency-injected function and exported alongside it:

- `AdminAuthProvider`'s mount-time session check → `resolveInitialAuthState(deps)`
- `AdminRouteGuard`'s redirect decision → `shouldRedirectFromGuard(mode, isAuthenticated)`
- `AdminLoginForm`'s submit handler → `performAdminLogin(input, deps)`

These are unit-tested directly under Jest's default `node` test environment — no DOM, no rendering, no new dependency. This is not a workaround bolted on around the missing packages; it's a legitimate, independently-defensible separation of logic from presentation that happens to also sidestep the constraint.

### 4.3 What still uses rendering, and how

"Login rendering" and the render-suppression half of "protected route redirect" use `renderToStaticMarkup` from `react-dom/server` — already a first-party dependency (no DOM environment required, since SSR string-rendering doesn't need one). This confirms the actual JSX/markup is correct (the right input types, the right button, content appearing/disappearing by auth state) without needing `@testing-library/react`.

### 4.4 What this does NOT cover, disclosed explicitly

`renderToStaticMarkup` never runs `useEffect` (SSR doesn't execute effects), so no test asserts that `router.replace(...)`/`router.push(...)` is actually *called* by the mounted component — only that the underlying decision function returns the right boolean, and that the component renders the right thing given that decision. The `router.replace/push` calls themselves are one-line, directly gated by the already-tested booleans (`if (shouldRedirect) router.replace(redirectTo)`; `onSuccess: () => router.push("/dashboard")`), so the coverage gap is narrow — but it is a gap, and the live end-to-end browser verification in §3 is what actually exercises those calls for real, not a substitute claimed to be equivalent to component-level interaction tests.

`tsc --noEmit`: clean across all 6 buildable workspace packages (`pnpm typecheck`, turbo-orchestrated). `eslint`: clean across all 6 (`pnpm lint`) — only pre-existing, unrelated `apps/web` `no-img-element` warnings appear, nothing new. `next build`: clean for both `apps/admin` and `apps/web` (`pnpm build`) — confirms the customer app is genuinely unaffected, not just untouched in source.

## 5. Explicitly out of scope (confirmed not built)

No CMS, no Home Management, no Media Library screens. The sidebar lists exactly one real item (`/dashboard`) — no placeholder/disabled entries were added for future features, since inventing navigation structure for a feature whose own IA hasn't been decided isn't "foundation," it's guessing ahead of the stage that actually owns that decision.

---

# ADMIN PORTAL SHELL:
READY
