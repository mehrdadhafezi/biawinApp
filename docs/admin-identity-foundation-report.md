# Admin Identity & Security Foundation — Implementation Report (Stage 5.16)

Source of truth: `docs/admin-architecture-decision-record.md` (§3 auth, §4 RBAC,
§5 ownership, §8 audit, §10 migration order, §12 security requirements).
Scope: identity/auth/RBAC/audit foundation only — no Admin UI, no CMS, no
Customer App change.

## 1. Files changed

### New

**`modules/admin-auth/`** (mirrors `modules/auth/`'s shape exactly, per ADR §3):
- [admin-auth.module.ts](../backend/src/modules/admin-auth/admin-auth.module.ts)
- [admin-auth.controller.ts](../backend/src/modules/admin-auth/admin-auth.controller.ts) — `POST /admin/auth/login`, `POST /admin/auth/refresh`, `POST /admin/auth/logout`, `GET /admin/auth/me`
- [admin-auth.service.ts](../backend/src/modules/admin-auth/admin-auth.service.ts)
- [admin-auth.service.spec.ts](../backend/src/modules/admin-auth/admin-auth.service.spec.ts) — 8 tests
- [admin-auth.controller.spec.ts](../backend/src/modules/admin-auth/admin-auth.controller.spec.ts)
- [strategies/admin-jwt.strategy.ts](../backend/src/modules/admin-auth/strategies/admin-jwt.strategy.ts)
- [types/authenticated-admin-user.type.ts](../backend/src/modules/admin-auth/types/authenticated-admin-user.type.ts)
- [dto/admin-login.dto.ts](../backend/src/modules/admin-auth/dto/admin-login.dto.ts), [dto/admin-refresh-token.dto.ts](../backend/src/modules/admin-auth/dto/admin-refresh-token.dto.ts)
- [password-hash.util.ts](../backend/src/modules/admin-auth/password-hash.util.ts) — see §3's note on the bcrypt→scrypt substitution

**`modules/admin-audit-log/`**:
- [admin-audit-log.module.ts](../backend/src/modules/admin-audit-log/admin-audit-log.module.ts)
- [admin-audit-log.service.ts](../backend/src/modules/admin-audit-log/admin-audit-log.service.ts) — `record()` (append-only), `list()`
- [admin-audit-log.service.spec.ts](../backend/src/modules/admin-audit-log/admin-audit-log.service.spec.ts) — 3 tests
- [admin-audit-log.controller.ts](../backend/src/modules/admin-audit-log/admin-audit-log.controller.ts) — `GET /admin/audit-logs` (SUPER_ADMIN only)
- [admin-audit-log.controller.spec.ts](../backend/src/modules/admin-audit-log/admin-audit-log.controller.spec.ts)
- [dto/list-admin-audit-log-query.dto.ts](../backend/src/modules/admin-audit-log/dto/list-admin-audit-log-query.dto.ts)

**Shared guards/decorators** (`common/`):
- [decorators/admin-roles.decorator.ts](../backend/src/common/decorators/admin-roles.decorator.ts) — `@AdminRoles(...)`
- [decorators/current-admin-user.decorator.ts](../backend/src/common/decorators/current-admin-user.decorator.ts) — `@CurrentAdminUser()`
- [guards/admin-jwt-auth.guard.ts](../backend/src/common/guards/admin-jwt-auth.guard.ts)
- [guards/admin-roles.guard.ts](../backend/src/common/guards/admin-roles.guard.ts) + [admin-roles.guard.spec.ts](../backend/src/common/guards/admin-roles.guard.spec.ts) — 4 tests

**Migration**: `backend/prisma/migrations/20260825120105_admin_identity_foundation/migration.sql`

### Modified

- `backend/prisma/schema.prisma` — `AdminRole`, `AdminAuditAction` enums; `AdminUser`, `AdminRefreshToken`, `AdminAuditLog` models (§2 below)
- `backend/prisma/seed.ts` — seeds the first `SUPER_ADMIN` from `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD`/`ADMIN_SEED_FULL_NAME` (skips silently if unset; upserts, so re-running never clobbers a changed password)
- `backend/src/app.module.ts` — registers `AdminAuditLogModule`, `AdminAuthModule`
- `backend/src/config/env.validation.ts` — `ADMIN_JWT_ACCESS_SECRET/TTL`, `ADMIN_JWT_REFRESH_SECRET/TTL_DAYS`, `ADMIN_LOGIN_MAX_ATTEMPTS/LOCK_MINUTES`, `ADMIN_SEED_EMAIL/PASSWORD/FULL_NAME`
- `backend/.env.example` — documents the same, with dev-safe placeholder values
- `.github/workflows/ci.yml` — added `ADMIN_JWT_ACCESS_SECRET`/`ADMIN_JWT_REFRESH_SECRET` dummy values (required, no default — CI bootstrap would otherwise fail env validation)
- `backend/.env` (local, gitignored) — same additions, real dev values

**Not touched, deliberately**: `OrbitItemsAdminController` is not yet retrofitted with `@AdminRoles()`. ADR §10 step 2 calls for this, but it's not in this stage's explicit scope list (items 1–7) — flagged as the next concrete follow-up, not silently skipped.

## 2. Database changes

Migration `20260825120105_admin_identity_foundation`, applied and verified against the local dev database:

| Table | Purpose |
|---|---|
| `admin_users` | `id, email (unique), passwordHash, fullName, role (AdminRole), active, failedLoginAttempts, lockedUntil, lastLoginAt, createdAt, updatedAt` |
| `admin_refresh_tokens` | `id, adminUserId (FK→admin_users, Cascade), tokenHash (unique), userAgent, ip, expiresAt, revokedAt, createdAt` — separate table from customer `refresh_tokens`, per ADR §3 |
| `admin_audit_logs` | `id, adminUserId (FK→admin_users, SetNull, nullable), action (AdminAuditAction), resourceType, resourceId, beforeJson, afterJson, ip, userAgent, createdAt` — append-only |

Enums: `AdminRole` (`SUPER_ADMIN`, `CONTENT_EDITOR`, `SUPPORT_VIEWER`), `AdminAuditAction` (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT` — kept minimal to this stage's actual actions; domain-mutation actions are added by whichever stage builds the first real admin-managed content controller).

No existing table was altered — this is a fully additive migration.

## 3. Security decisions implemented

Mapped directly to ADR §3/§4/§5/§8/§12:

1. **Separate identity** — `AdminUser`, not `User`. No code path in `AdminAuthService` ever reads/writes a customer row.
2. **Email + password, not phone+OTP** — hashed with **scrypt via Node's built-in `crypto` module** (`salt:derivedKeyHex`, `timingSafeEqual` comparison), not bcrypt/argon2 as literally named in ADR §12.6. **Deviation, and why**: the npm registry was unreachable from this environment for the entire implementation window (confirmed with a direct `curl https://registry.npmjs.org/...`, timing out identically for `bcryptjs`, `lodash`, and `class-validator` — not package-specific). scrypt is an OWASP-recommended memory-hard adaptive KDF and satisfies the ADR's actual requirement ("a modern adaptive hash, never anything reversible") with zero new external dependency, reusing `node:crypto`, which this codebase already depends on (`auth.service.ts`, `storage.service.ts`). If the registry becomes reachable and the team prefers to standardize on the literal bcrypt/argon2 package, `password-hash.util.ts` is a 2-function, single-file surface to swap.
3. **Separate JWT secret + audience** — `ADMIN_JWT_ACCESS_SECRET` (distinct from `JWT_ACCESS_SECRET`), signed/verified with `audience: 'admin', issuer: 'biawin-admin'`. Verified live: a real customer OTP-issued token gets `401` against `/admin/auth/me`, and a real admin token gets `401` against `/wallet` (§4 below).
4. **Shorter admin token TTL** — `ADMIN_JWT_ACCESS_TTL` defaults to `10m` vs. the customer default `15m`; `ADMIN_JWT_REFRESH_TTL_DAYS` defaults to `7` vs. the customer default `30`.
5. **Mandatory refresh-token rotation** — `refresh()` revokes the presented token and issues a new one, mirroring `AuthService.refresh()`'s existing pattern exactly.
6. **Immediate revocation, not just short TTL** — `AdminJwtStrategy.validate()` re-checks `AdminUser.active` on the database on every request (the customer strategy does not do this for its own token). Verified live: disabling an admin blocks their *next login attempt* immediately, and the same check independently blocks a still-unexpired token if the account is disabled mid-session.
7. **Fixed RBAC enum, not flat or granular-matrix** — `AdminRole` (`SUPER_ADMIN`/`CONTENT_EDITOR`/`SUPPORT_VIEWER`), enforced by `AdminRolesGuard` reading `@AdminRoles(...)` metadata. Verified live: a `CONTENT_EDITOR` gets `403 FORBIDDEN` on the `SUPER_ADMIN`-only `/admin/audit-logs`, and `200` on the any-role `/admin/auth/me`.
8. **Login lockout** — `ADMIN_LOGIN_MAX_ATTEMPTS` (default 5) / `ADMIN_LOGIN_LOCK_MINUTES` (default 15), mirroring `PhoneVerification.attemptsRemaining`'s existing shape for the OTP flow, applied to password attempts.
9. **Login-endpoint throttling** — `@Throttle({ limit: 10, ttl: 600_000 })` on `POST /admin/auth/login`, same mechanism `AuthController`'s OTP endpoints already use.
10. **Append-only audit log** — `AdminAuditLogService` exposes no update/delete method. Every login attempt (success, unknown email, wrong password, locked, disabled) and every logout is recorded with actor (nullable), action, resource, and a reason in `afterJson`. `record()` never throws — a transient write failure is logged loudly (`Logger.error`) but doesn't block the login/logout it's describing, matching `AuthService.completeSignup`'s existing "non-critical side effect" pattern.
11. **Request-property isolation** — `AdminJwtAuthGuard` overrides `handleRequest` to attach the authenticated admin to `request.adminUser`, never `request.user` (which the customer `JwtStrategy`/`CurrentUser` own) — `@CurrentAdminUser()` reads only that property, so the two identities can never be cross-read through the wrong decorator.
12. **`@Public()` reused deliberately, not accidentally** — every admin controller carries `@Public()` to opt out of the *global* customer `JwtAuthGuard`; `AdminJwtAuthGuard`/`AdminRolesGuard` are applied explicitly via `@UseGuards(...)` on the routes that need them. Documented prominently in both guard files' doc comments, since this is the one place in the pattern most likely to be misread as "no auth."
13. **Non-uniform failure messages, deliberately** — "wrong email or password" is identical for an unknown email and a wrong password (prevents email enumeration); "account disabled"/"account locked" are distinct and specific, a deliberate usability call for a small internal staff population, not a public-facing surface. The audit log always records the real reason regardless of what the client sees.

## 4. Tests result

```
Test Suites: 20 passed, 20 total
Tests:       45 passed, 45 total
```

The 5 explicitly required scenarios, and where they live:

| Required scenario | Test(s) |
|---|---|
| Successful admin login | `admin-auth.service.spec.ts` → *"succeeds with correct email/password, issues tokens, and records a LOGIN_SUCCESS audit entry"* |
| Invalid credentials | `admin-auth.service.spec.ts` → *"rejects an unknown email..."* and *"rejects a wrong password, increments failedLoginAttempts..."* |
| Disabled admin user | `admin-auth.service.spec.ts` → *"rejects a disabled admin user without checking the password, and records the reason"* |
| Unauthorized role access | `admin-roles.guard.spec.ts` → *"denies access when the authenticated admin does not have a required role"* (plus 3 more guard-behavior cases: allow-with-matching-role, allow-with-no-restriction, deny-with-no-admin-attached) |
| Audit log creation | `admin-audit-log.service.spec.ts` → *"creates an audit log row with the given actor, action, and resource"* (plus null-actor and write-failure-doesn't-throw cases) |

Two extra scenarios covered beyond the minimum, both directly exercising ADR requirements: account **lockout** after the max-attempts threshold, and a **locked** account being rejected before password/active checks are even reached.

`tsc --noEmit`: clean. `eslint` (all new/changed files): clean (one file-scoped `eslint-disable` for `@typescript-eslint/no-unsafe-assignment` in `admin-auth.service.spec.ts`, with an inline comment explaining why — `expect.any(...)`/`expect.objectContaining(...)` are typed `any` in `@types/jest`; this doesn't touch the shared `eslint.config.mjs`). `nest build`: clean.

**Live end-to-end verification** (local dev server, seeded `SUPER_ADMIN`, real HTTP calls — not just mocked unit tests):
- `POST /admin/auth/login` with correct credentials → `200`, JWT payload confirmed to carry `aud: "admin"`, `iss: "biawin-admin"`, correct `role`
- `GET /admin/auth/me` with that token → `200`, correct profile
- `GET /admin/audit-logs` with that (`SUPER_ADMIN`) token → `200`, showing the real login events just performed
- `POST /admin/auth/login` with wrong password → `401`
- A `CONTENT_EDITOR` token on `/admin/audit-logs` → `403 FORBIDDEN`; the same token on `/admin/auth/me` → `200`
- A disabled admin's login attempt → `401` with the disabled-specific message
- A real customer OTP-issued JWT on `/admin/auth/me` → `401`
- A real admin JWT on `/wallet` (customer route) → `401`

All test-admin rows and scratch scripts created for this live verification were deleted afterward; nothing test-only was left in the dev database or working tree.

## 5. Deferred, not forgotten

- **`OrbitItemsAdminController` role retrofit** (ADR §10 step 2) — not in this stage's scope list; the guard/decorator infrastructure it needs (`AdminJwtAuthGuard`, `AdminRolesGuard`, `@AdminRoles`) now exists and is proven, so this is a small, mechanical follow-up, not a redesign.
- **Domain-mutation audit actions** (`CREATE`/`UPDATE`/`DELETE`/`REORDER`/`IMAGE_UPLOAD`/`IMAGE_DELETE`) — `AdminAuditAction` intentionally only has this stage's own actions (`LOGIN_SUCCESS`/`LOGIN_FAILED`/`LOGOUT`); the next stage that builds a real admin-managed content controller extends the enum then, against a real call site, instead of speculative values now.
- **`createdBy`/`updatedBy` on content models** (ADR §5) — not applicable yet; no admin-managed content model exists in this codebase to attach them to. Applies starting with whichever stage builds `docs/home-admin-contract.md`'s first model.

---

# ADMIN IDENTITY FOUNDATION:
READY
