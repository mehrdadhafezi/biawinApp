# API Foundation

- **Swagger/OpenAPI UI:** `GET /api/docs` (once the backend is running).
- **Base path:** `/api` — set via `app.setGlobalPrefix('api')` in `backend/src/main.ts`.
- **Versioning:** URI-based, e.g. `/api/v1/...`. `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Every controller not explicitly marked otherwise is versioned; the only exception is `GET /api/health` (`VERSION_NEUTRAL`, for load-balancer/Docker healthchecks — see `docs/04-deployment.md`).
- **Auth:** `Authorization: Bearer <accessToken>`. Every route requires a valid access token by default (global `JwtAuthGuard`); a route opts out with the `@Public()` decorator (used by the OTP/refresh/logout endpoints and public catalog reads).

## Response format (applies to every endpoint)

Success (`ResponseInterceptor`, `backend/src/common/interceptors/response.interceptor.ts`):

```json
{ "success": true, "data": { /* ... */ } }
```

Error (`HttpExceptionFilter`, `backend/src/common/filters/http-exception.filter.ts`):

```json
{
  "success": false,
  "error": { "code": "BAD_REQUEST", "message": "کد وارد شده صحیح نیست.", "details": null }
}
```

`error.code` is the `HttpStatus` name (`BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, ...) — stable for programmatic handling on web/mobile, independent of the (Persian, user-facing) `message` string.

## Pagination convention

Any list endpoint accepts `?page=1&limit=20` (`common/dto/pagination.dto.ts`, max `limit` 100) and returns:

```json
{ "success": true, "data": { "items": [...], "total": 42, "skip": 0, "take": 20 } }
```

## Rate limiting

Global Throttler (`@nestjs/throttler`, Redis-backed storage): 100 requests/60s per client by default (`backend/src/app.module.ts`). `POST /auth/otp/request` and `POST /auth/otp/verify` have tighter per-route overrides — see `docs/07-security.md` "OTP Security".

## Auth contract (Sprint 0-A — unified login/signup, no email/password)

Phone is the only login identifier; there is no password anywhere. The client never declares "login" vs "signup" — the backend decides right after the OTP code is verified, based on whether the phone already has a `User` row (mirrors the prototype's own `unified-auth` logic).

**1. `POST /auth/otp/request`** — `@Public()`, throttled 5/10min/IP
```json
// Request: { "phone": "09121234567" }
// Response 200: { "expiresInSeconds": 120 }
```

**2. `POST /auth/otp/verify`** — `@Public()`, throttled 10/10min/IP
```json
// Request: { "phone": "09121234567", "code": "123456" }

// Response — existing user, logged in directly:
{ "status": "authenticated", "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }

// Response — new phone, must complete signup:
{ "status": "signup_required", "signupToken": "..." }
```

**3. `POST /auth/signup/complete`** — `@Public()`
```json
// Request
{ "signupToken": "...", "fullName": "...", "subscriptionCode": "optional" }
// Response 200: { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```
`signupToken` is a short-lived (`SIGNUP_TOKEN_TTL_SECONDS`, default 600s) stateless JWT — not a DB row — proving the phone was just OTP-verified, without requiring the client to re-send the code. Only `fullName` (required) and `subscriptionCode` (optional) are collected — **no email, no password**. `subscriptionCode` is **not an auth credential**: `AuthService` never writes it to `User`; it is passed to `MembershipService.registerSubscriptionCode(userId, code)`, which owns real redemption/activation (Feature-stage — see `docs/02-database.md`). Terms/consent acceptance is a client-side-only gate for now (no API field) — a future `UserConsent` model is tracked in `docs/07-security.md`.

**4/5. `POST /auth/refresh`, `POST /auth/logout`** — unchanged, `@Public()`.

## Endpoints implemented at Foundation stage

Foundation scope is deliberately thin: enough to prove every module's wiring end-to-end, not full business behavior (see `docs/01-architecture.md`).

| Module | Endpoints |
|---|---|
| `auth` | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/signup/complete`, `POST /auth/refresh`, `POST /auth/logout` — all `@Public()` (contract above) |
| `users` | `GET /users/me` |
| `profiles` | `GET /profiles/me`, `PATCH /profiles/me` |
| `membership` | `GET /membership`, `GET /membership/:id` (current user's memberships) |
| `subscriptions` | `GET /subscriptions`, `GET /subscriptions/:id` — public catalog read |
| `wallet` | `GET /wallet`, `GET /wallet/:kind/transactions` |
| `transactions` | `GET /transactions` — merged read-model over wallet (and, later, credit/installments) |
| `credit` | `GET /credit`, `GET /credit/:id` |
| `installments` | `GET /installments`, `GET /installments/:id` |
| `services` | `GET /services`, `GET /services/:id` — public catalog read |
| `categories` | `GET /categories`, `GET /categories/:id` — public catalog read |
| `merchants` | `GET /merchants`, `GET /merchants/:id` — public catalog read |
| `orders` | `POST /orders`, `GET /orders`, `GET /orders/:id` |
| `payments` | `GET /payments`, `GET /payments/:id` |
| `rewards` | `GET /rewards`, `GET /rewards/:id` — public catalog read |
| `notifications` | `GET /notifications`, `GET /notifications/:id` |
| `advisor` | `GET /advisor`, `GET /advisor/:id` — public catalog read (persona list, no live chat/LLM yet) |
| `health` | `GET /health` — `VERSION_NEUTRAL`, `@Public()` |

Write endpoints beyond what's listed (e.g. redeeming a reward, paying an installment, admin CRUD for catalog modules) are Feature-stage work — they need product decisions this stage intentionally deferred (see the "نیاز به تصمیم Product" list in the final report).
