# Admin Architecture Decision Record (Stage 5.15.1)

Analysis-only. No code, no migrations, no Admin UI, no Customer App change
in this stage. Source of truth: the current repository (commit `4362da0`)
and `docs/home-admin-contract.md`. Every decision below is final for v1 —
options are listed for the record, not left open, per this stage's explicit
instruction.

Convention: each decision is **Context → Options considered → Decision →
Reasoning → Consequences**, mirroring the rigor of `docs/11-orbit-asset-system.md`
and `docs/home-admin-contract.md`.

---

## 1. Admin application boundary

**Context.** `apps/web` (customer, Next.js, mobile-app-styled shell capped
at 760px per `AppShell.tsx`) and `apps/mobile` (Expo) already coexist in
this monorepo. No Admin app exists. `docs/04-deployment.md` and
`docs/07-security.md` both already reserve `admin.biawin.ir` as a future
subdomain in their CORS/domain planning — this decision finishes a
placeholder the codebase already committed to, not invents a new one.

**Options considered.**
- **A.** New Next.js app in this monorepo, `apps/admin`, deployed
  independently to `admin.biawin.ir`.
- **B.** Route group inside `apps/web` (e.g. `/admin/*`) behind auth, same
  deployment.
- **C.** Entirely separate repository.

**Decision: A** — a new, independently deployed `apps/admin` Next.js app in
this monorepo.

**Reasoning.** Admin needs a fundamentally different UI paradigm (dense
desktop tables/forms) from `apps/web`'s mobile-app shell — and that shell's
own coupling has already caused two real bugs this engagement fixed
directly (the `translateZ(0)` stacking-context escape, the fixed-nav
containing-block hijack). Bolting admin routes onto `apps/web` (Option B)
means importing that entire mobile-shell CSS/layout architecture into
screens that need the opposite of it. A separate repo (Option C) has no
justification here: one backend, one Prisma schema, one team, one release
cadence — splitting repos would only fragment DTOs and migrations for zero
benefit. Staying in the monorepo (Option A) keeps one `pnpm` workspace, one
`tsconfig`/`eslint` convention, and lets `apps/admin` reuse the same
`ApiError`/`apiClient` request pattern `apps/web/src/lib/api-client.ts`
already established, without inheriting its mobile design tokens.

**Consequences.**
- New `Dockerfile.admin`, a new LiteSpeed vhost + reverse-proxy include
  (mirrors `docs/10-release-process.md`'s existing per-vhost setup for
  web/backend), a new `docker-compose.staging.yml` service.
- `apps/admin` gets its own design system (not `@biawin/ui`'s mobile
  tokens) — accept some early duplication of generic primitives (button,
  table, input) rather than force-fit mobile-shell components; a shared
  `packages/admin-ui` is justified later only if real duplication pain
  shows up, not speculatively now.
- Root `pnpm lint`/`typecheck`/`test`/`build` (already Turborepo-driven per
  `.github/workflows/ci.yml`) picks up `apps/admin` automatically once it
  exists in the workspace — no new CI pipeline needed for this alone.

---

## 2. Backend architecture

**Context.** `OrbitItemsAdminController` (`backend/src/modules/orbit-items/orbit-items-admin.controller.ts`)
already implements `/api/v1/admin/orbit-items` inside the same NestJS
backend that serves all customer traffic, sharing the one `PrismaService`
and one PostgreSQL database.

**Options considered.**
- **A.** Extend the existing NestJS backend — admin controllers live inside
  each domain's existing module, all under `/api/v1/admin/**`.
- **B.** Separate NestJS "admin-api" service/process.
- **C.** GraphQL admin gateway in front of the existing REST API.

**Decision: A** — extend the existing single backend, following
`OrbitItemsAdminController`'s exact pattern for every new admin controller.

**Reasoning.** This is already the working, shipped convention — deviating
now would leave two incompatible "how admin CRUD is built" answers in the
same codebase depending on which stage wrote it. A separate service (B)
means either a second Prisma client against the same schema (drift risk —
the exact "two sources of truth" class of bug that caused the Stage 5.14.1
membership-title mismatch) or an internal service-to-service API for no
real gain: one team, one database, one deploy cadence, no scaling pressure
evidenced anywhere in this codebase that would justify the split. GraphQL
(C) is pure overhead for what is, per `docs/home-admin-contract.md` §6,
standard CRUD + reorder + image upload — REST already expresses this
cleanly and consistently with every other endpoint and with the existing
Swagger setup; a second query paradigm for one feature area fragments
tooling for no expressive-power this feature needs.

**Consequences.**
- Every new admin controller registers in `app.module.ts` like every other
  module today — no new deployment unit, no new health-check target.
- Admin and customer traffic share the same NestJS process — mitigated by
  standard resource limits, not process isolation, at this project's scale.
- Swagger/OpenAPI stays unified under one spec, admin routes distinguished
  by `@ApiTags`/path prefix, same as `OrbitItemsAdminController` today.

---

## 3. Authentication strategy

**Context.** `User.phone` is the sole customer identity (`schema.prisma`'s
own comment: *"No email/password anywhere on this model — phone is the sole
login identifier"*), self-registered via OTP, access tokens default to a
900-second TTL (`JWT_ACCESS_TTL` default `'15m'`, `auth.service.ts:208`).
There is no staff/admin user concept anywhere in this schema.

**Options considered.**
- **A.** Reuse phone+OTP customer auth for staff too.
- **B.** Separate `AdminUser` model, email+password login, distinct JWT
  audience.
- **C.** SSO/OAuth (e.g. Google Workspace).

**Decision: B** — a new `AdminUser` model, email + password (hashed, §12),
issued a JWT signed with a **separate secret** and a distinct audience
claim, validated by a dedicated `AdminJwtAuthGuard`/`AdminJwtStrategy`.

**Reasoning.** `User` is deliberately public self-registration — anyone
with a working phone number becomes one. Admin access must be
staff-provisioned, never self-service; bolting an `isAdmin` flag onto
`User` would contradict that model's own stated design (no role concept,
phone-only identity by design) and would put customer and staff trust
boundaries in the same table. OTP-per-login makes sense for a public
audience where SMS delivery risk is acceptable; it's the wrong fit for a
small, ops-critical internal population that needs to be able to act during
an incident without depending on carrier SMS delivery — password auth is
the standard baseline at this population size. SSO (C) is the strongest
long-term answer but is a real external integration (OAuth app
registration, an assumed identity provider) with no confirmed requirement
in this codebase today — not ruled out permanently, addable later as a
second `AdminAuthProvider` without reworking this decision, just not
chosen for v1 because it adds an unconfirmed dependency. A separate signing
secret/audience means a stolen customer JWT (already the lower trust-bar
artifact — anyone can self-issue one via OTP) cannot pass an admin guard by
construction, not by convention, even if a specific guard implementation
has a bug.

**Consequences.**
- New `AdminUser` Prisma model + migration, new `modules/admin-auth/`
  (near-identical shape to `modules/auth/`, minus OTP, plus password
  hashing).
- A new password-reset flow (email-based) is required — this codebase has
  an `email.processor.ts` queue processor already; it needs confirming/
  extending for this use, not built from zero.
- No shared session between `apps/web` and `apps/admin` — intentional: a
  staff member who is also a customer logs into each surface separately.

---

## 4. RBAC model

**Context.** `docs/home-admin-contract.md` §7 explicitly deferred this
decision, naming the current all-authenticated-users posture
(`OrbitItemsAdminController`'s own comment: *"no admin-role/RBAC system yet"*)
as an accepted-but-flagged gap specifically because Home's content admin
has larger blast radius than Orbit's. This ADR's job is to close that.

**Options considered.**
- **A.** No roles — flat "any `AdminUser` can do anything" (status quo).
- **B.** Fixed role enum (`SUPER_ADMIN | CONTENT_EDITOR | SUPPORT_VIEWER`),
  checked via a `@Roles()` decorator + `RolesGuard`.
- **C.** Full granular permission system (resource × action matrix,
  DB-driven).

**Decision: B** — a fixed `AdminRole` enum on `AdminUser`, enforced by a
`@Roles(...)` decorator + `RolesGuard` on every `/admin/**` route, in
addition to (not instead of) §3's `AdminJwtAuthGuard`.

**Reasoning.** Option A is exactly what this ADR exists to stop deferring —
re-choosing it here would be a second deferral, not a decision. Option C is
real over-engineering against the actual scope: `docs/home-admin-contract.md`
defines exactly 6 admin-manageable resource types total; a DB-driven
permission matrix earns its cost at dozens of resource types and multiple
admin tenants, neither of which exists here — it would mean building and
maintaining a permissions UI for a scope that doesn't need it. A fixed enum
matches the real, evidenced need: someone who can do everything, someone
who edits content but shouldn't touch billing/user data once Admin scope
grows past Home, someone who should only view/monitor. This mirrors the
exact "closed enum over free-form" philosophy `docs/home-admin-contract.md`
§4.3/§4.6 already use for `BannerTheme`/`HeroCardColor` — bounded and
reviewable, not open-ended.

**Consequences.**
- `AdminUser.role AdminRole @default(CONTENT_EDITOR)`, new `AdminRole` enum.
- Every admin controller method needs an explicit `@Roles(...)` annotation
  — a real, non-optional retrofit of `OrbitItemsAdminController` (currently
  unguarded by role) alongside every new controller from
  `docs/home-admin-contract.md` §6.
- Adding a role later (e.g. once Wallet/Credit gets an admin surface) is an
  enum value + migration, not a redesign — and a later move to Option C's
  granular model (if ever justified) can sit underneath the same
  `@Roles()` call sites without another rewrite.

---

## 5. Content ownership model

**Context.** Every existing admin-adjacent model (`OrbitItem`, plus every
model `docs/home-admin-contract.md` §4 defines) has only `createdAt`/
`updatedAt` — no actor attribution. Git blame answers "who changed this
code," but nothing answers "who changed this data" once non-developers can
edit it directly.

**Options considered.**
- **A.** No ownership/attribution beyond timestamps (status quo).
- **B.** `createdBy`/`updatedBy` (nullable FK to `AdminUser`) on every
  admin-managed content row.
- **C.** Full content versioning — every edit creates a new row/snapshot.

**Decision: B.**

**Reasoning.** Option A stops answering the moment Admin ships — a wrong
live banner becomes unanswerable ("who changed this last week") without
git history to fall back on, once the change happens through an Admin form
instead of a PR. This is a foreseeable, not speculative, gap: this very
engagement spent real effort tracing exactly this kind of "where did this
wrong value come from" question through git for CODE; content editors won't
have that tool. Option C (full versioning/rollback/diff-history) solves a
different, broader problem that §7 (Publishing Workflow) already handles
more narrowly and on purpose — building both would be two overlapping
systems. `createdBy`/`updatedBy` is cheap, immediately useful for incident
response, and composes cleanly with §8's audit log: `updatedBy` is the
current-state pointer, the audit log is the append-only event trail behind
it — complementary, not redundant.

**Consequences.**
- Two nullable FK columns (`createdBy`, `updatedBy` → `AdminUser`) added to
  every model in `docs/home-admin-contract.md` §4, plus a retrofit of
  `OrbitItem`.
- `updatedBy` must be set server-side from the authenticated admin's JWT
  claim, never client-supplied — worth one shared interceptor/base-service
  helper rather than repeating this by hand per controller.
- Deleting an `AdminUser`: `onDelete: SetNull` on these FKs (content
  survives, attribution becomes null) — not `Restrict` (would block ever
  deactivating former staff) and not `Cascade` (would wrongly delete live
  content because its last editor left).

---

## 6. Media architecture

**Context.** `docs/home-admin-contract.md` §5 already specifies the media
pipeline for Home's new models: `imageKey` (object-storage key) +
`StorageService` (`backend/src/infra/storage/storage.service.ts`, S3-API,
MinIO in dev) + a static-bridge public URL — exactly what `OrbitItem`
ships with today (`/orbit/{filename}`), chosen because MinIO is
loopback-only (CSF/Imunify360 default-deny per `docs/08-staging-deployment.md`)
and a presigned URL's expiry would break caching on pages every user loads.

**Options considered.**
- **A.** Confirm §5's pattern as the permanent, project-wide standard for
  all future admin-managed media, not just Home.
- **B.** Presigned URLs for admin-managed media specifically, since Admin
  (unlike the public customer page) is authenticated.
- **C.** Adopt a full DAM (Digital Asset Management) service.

**Decision: A.**

**Reasoning.** The constraint driving this pattern (MinIO not publicly
reachable, presigned URLs breaking cache on public pages) is infrastructure
-level, not Home-specific — it applies to every future admin-managed media
field regardless of which admin screen uploaded it. Option B sounds
appealing (Admin is authenticated, so why not presigned there) but would
mean the SAME `imageKey` column resolves two different ways depending on
which app asks — two code paths, double the surface for a caching/expiry
bug — for a marginal admin-side convenience that doesn't outweigh that
cost. Option C is real over-engineering at this project's actual media
scale (a few dozen images total across Orbit + Home) — a DAM earns its cost
at thousands of assets with real reuse/licensing/variant tracking needs,
none evidenced here.

**Consequences.**
- Admin's upload preview resolves through the same static-bridge URL a
  customer would eventually see — "looks right in admin" and "what ships"
  are the same code path, not two.
- Every new admin-managed media type needs one line added to whatever
  serves `/orbit/{filename}` and `/home/**` today — a small, repeatable
  step per new model, not a new architectural decision each time.
- Image REPLACE still requires `docs/11-orbit-asset-system.md` §3's
  filename-versioning discipline (bump `{version}`, never overwrite a key)
  — this ADR extends that existing convention project-wide, not just to
  Orbit.

---

## 7. Publishing workflow

**Context.** Every admin-adjacent model in this codebase — `OrbitItem` and
all of `docs/home-admin-contract.md` §4's new models — uses a single
`active: Boolean` flag. No draft concept exists anywhere. This engagement's
own evidence (every stage so far) shows a single-operator-driven workflow,
not a multi-editor approval process.

**Options considered.**
- **A.** Direct write — every save is immediately live, `active` toggle
  only (status quo).
- **B.** Draft/Published two-state model per row.
- **C.** Full workflow engine (draft → review → scheduled → published →
  archived, with approval steps).

**Decision: A.**

**Reasoning.** This isn't a shortcut — it's what `docs/home-admin-contract.md`
§4 already committed to for every one of its 6 models; introducing a
draft/published axis now would mean reopening that already-frozen contract
mid-ADR. Option C solves a problem with no evidence behind it here
(multiple editors whose changes need review before going live) — building
an approval pipeline for a small internal team is speculative process
overhead. The `active` toggle already gives the one control that matters
operationally — take a wrong live item down immediately — which for a
small team is faster and simpler than draft-then-approve, since mistakes
are caught by looking at the live result, not by a second reviewer's queue.
The two real needs a lightweight draft workflow would otherwise justify —
accountability and revert-ability — are already covered by §5
(`createdBy`/`updatedBy`) and §8 (audit log) without adding a second
content-state axis.

**Consequences.**
- Every admin save takes effect on the next customer page load (no
  server-side cache layer confirmed in this codebase today, so effectively
  immediate).
- No "preview before publish" screen is required for v1 — §6's image
  preview already resolves the real static-bridge URL, so what's previewed
  already matches what ships.
- If real editorial-mistake evidence emerges later, `status: draft` can be
  added additively on top of `active` (`active: false` keeps meaning "never
  show this"; `status` becomes an extra gate) — an extension, not a
  redesign, if and when actually needed.

---

## 8. Audit logging

**Context.** `request-logger.middleware.ts` (confirmed read this stage)
logs only `METHOD path status durationMs` per HTTP request — no
domain-level before/after state. No audit table exists anywhere in this
schema.

**Options considered.**
- **A.** No dedicated audit log — rely on `createdBy`/`updatedBy` (§5) +
  existing HTTP request logs.
- **B.** Dedicated `AdminAuditLog` table — one append-only row per admin
  mutation, with before/after state.
- **C.** External audit/SIEM service integration.

**Decision: B.**

**Reasoning.** Option A only ever tells you the CURRENT state's last
author — it cannot answer "what did this banner's kicker say before
Tuesday's edit" or "who deleted this category last month" (the row is just
gone), and `request-logger.middleware.ts` only confirms an HTTP call
happened, not what domain data it changed. Option C is real infrastructure
this project shows no evidence of running (no logging aggregation, no
compliance driver named anywhere in `docs/`) — the proportionate choice for
a regulated enterprise with a security team consuming that feed, not
demonstrated to be this project's situation, though revisit-worthy once
this system carries more Rial-denominated financial data through admin
surfaces than Home content does today. A dedicated in-database append-only
table is the minimum viable version that actually answers who/what/when/
before/after, on infrastructure (Postgres/Prisma) this codebase already
runs everywhere else — no new operational dependency.

**Consequences.**
- New `AdminAuditLog` model: `id, adminUserId, action, resourceType,
  resourceId, beforeJson, afterJson, createdAt` — append-only, no update/
  delete endpoints on this model ever.
- A shared interceptor (or base-service method) must write to it
  consistently across every `/admin/**` controller, including retrofitting
  `OrbitItemsAdminController` — real cross-cutting work, not a per-model
  afterthought.
- Storage grows unbounded by default — acceptable at this project's admin-
  mutation volume; retention/archival is a later operational concern, not a
  v1 blocker.
- `docs/home-admin-contract.md` §2's scope (Home content only) contains no
  sensitive/financial fields, so no redaction logic is required for what
  this ADR's parent contract covers; a future admin surface over
  Wallet/User data must revisit what's safe to store verbatim in
  `beforeJson`/`afterJson` at that time — flagged here, not solved here.

---

## 9. API boundaries

**Context.** `OrbitItemsService.toPublicShape()` already demonstrates this
codebase's existing instinct: a dedicated shaping method separate from the
raw Prisma row, rather than exposing the row directly. Public DTOs
(`apps/web/src/lib/home-api.ts`'s `CategoryDto` etc.) are deliberately
narrow, matching only what a customer page renders.

**Options considered.**
- **A.** Admin and public endpoints share the same DTOs/response shapes.
- **B.** Admin gets its own DTOs, separate from public DTOs, even for the
  same underlying model.
- **C.** One generic `/admin/resource/:model` CRUD endpoint instead of
  per-resource controllers.

**Decision: B.**

**Reasoning.** Admin needs the full row — `createdBy`/`updatedBy`,
`imageKey` alongside the resolved `imageUrl`, inactive rows, audit-relevant
fields — none of which belong in a public DTO. Reusing the public DTO (A)
means either bloating it with admin-only fields (leaking them to
customers) or Admin silently missing fields it needs. This ADR formalizes
`toPublicShape()`'s existing instinct into a stated rule rather than a
per-service ad hoc choice. Option C optimizes for the wrong thing: it
would minimize controller boilerplate at the cost of per-resource
`class-validator` validation (the exact pattern `CreateOrbitItemDto`/
`UpdateOrbitItemDto` already establish), per-resource role nuance (§4's
checks legitimately differ by resource type), and per-resource Swagger
documentation. This codebase has consistently chosen explicit, hand-written
code over generic/dynamic dispatch everywhere (every module/controller/
service is hand-written, not generated) — a generic admin endpoint would be
the one place breaking that convention to save boilerplate.

**Consequences.**
- Each admin-managed model needs its own `AdminXDto`/`CreateXDto`/
  `UpdateXDto` set, following `CreateOrbitItemDto`/`UpdateOrbitItemDto`'s
  exact shape — more files than a generic approach, the same accepted
  tradeoff this codebase already makes everywhere else.
- `apps/admin`'s API client (mirroring `apps/web/src/lib/home-api.ts`)
  stays fully typed end-to-end — no `any`/generic-record types in Admin UI
  code.

---

## 10. Migration strategy

**Context.** `deploy.sh` (`deploy/staging/deploy.sh`, confirmed run this
engagement) already executes `prisma migrate deploy && prisma db seed` as
step 4/6 of every deploy, against the one shared database with 3 existing
migrations. `docs/home-admin-contract.md` §8 already defines a per-model
sequencing pattern (schema change → seed/backfill → switch consumer →
delete old hardcoded source) for Home's own 6 models.

**Options considered.**
- **A.** Additive-only Prisma migrations in the existing `prisma/migrations`
  directory, applied by the existing `deploy.sh` step — no separate
  migration tooling for Admin.
- **B.** A separate migration pipeline/tool for Admin-only schema.

**Decision: A**, with a fixed ordering that this ADR sets explicitly:

1. `AdminUser` + `AdminRole` enum + the admin-auth module (§3).
2. `RolesGuard` + retrofit `OrbitItemsAdminController` with `@Roles()` (§4)
   — the existing admin surface is brought in line before any new one
   ships, not left as a second gap alongside new controllers.
3. `AdminAuditLog` + the shared mutation interceptor (§8).
4. `createdBy`/`updatedBy` columns added to `OrbitItem` and every model in
   `docs/home-admin-contract.md` §4 (§5).
5. `docs/home-admin-contract.md` §8's own per-model sequencing proceeds
   from here (its §3 prerequisite fixes, then §4.2's `MembershipPlan.imageKey`,
   then §4.3–§4.6 one model at a time).

**Reasoning.** There is no reason to invent a second migration mechanism
for a schema that lives in one Prisma schema file already — Admin's new
tables are just more entries in the directory this project already has.
The ordering matters and is not arbitrary: doing auth+RBAC+audit (steps
1–3) BEFORE any new content model ships means every subsequent admin
endpoint is built role-gated and audited from day one, instead of needing
the same retrofit `OrbitItemsAdminController` now requires. Retrofitting
Orbit (step 2) rather than leaving it as a permanent, separately-tracked
exception closes `docs/home-admin-contract.md` §7's flagged gap for real,
everywhere, not just for new code.

**Consequences.**
- A concrete build order is now fixed, not left to whichever model an
  implementer picks first.
- One seed script must create the first `SUPER_ADMIN` `AdminUser`
  (credentials from an environment variable at seed time, never hardcoded/
  committed) — without it, step 1 ships an auth system nobody can log
  into.

---

## 11. Environment strategy

**Context.** This project has exactly one non-local environment today
(staging — `docs/08-staging-deployment.md`'s own scope confirms production
isn't live yet), on a shared AlmaLinux host running LiteSpeed/WHM/cPanel
with per-vhost reverse-proxy config, deployed via `docker-compose.staging.yml`.
A `deploy-staging.yml` GitHub Actions workflow exists (confirmed present at
`.github/workflows/deploy-staging.yml`) but is not yet active — it requires
four repository secrets (`STAGING_SSH_HOST/PORT/USER/PRIVATE_KEY`) that
`docs/09-git-workflow.md` documents as not yet configured; deploys today
run by hand via SSH + `deploy.sh` (as this engagement's own Stage 5.14.1
work did).

**Options considered.**
- **A.** Admin shares the exact dev/staging(/production) topology already
  established, as one more container on the same host, same deploy
  mechanism, its own subdomain and its own env-secrets file.
- **B.** A separate environment tier or separate hosting arrangement for
  Admin specifically.

**Decision: A.**

**Reasoning.** Nothing about Admin's requirements differs from what web/
backend already solved — one more service on the same host, under the same
LiteSpeed vhost pattern `docs/10-release-process.md` already documents
step-by-step. Inventing a separate tier or host (B) would be solving a
scaling/isolation problem with no evidence behind it. A dedicated
`.env`-style secrets file for Admin (not reusing web's or backend's) is
still required: Admin's secrets (its own JWT signing secret per §3, any
email-sending credentials for password reset) are a genuinely different
trust boundary from customer-facing secrets, and mixing them into an
existing `.env.staging` would blur that boundary for no benefit.

**Consequences.**
- New `deploy/staging/Dockerfile.admin`, a new service block in
  `docker-compose.staging.yml`, a new LiteSpeed vhost + reverse-proxy
  include (repeats `docs/10-release-process.md`'s existing "one-time server
  setup" steps for a third app).
- `deploy.sh` gains a 4th container in its build/up steps (currently
  backend + web) — the same script extended, not a new script.
- Once activated, `deploy-staging.yml`'s CI→deploy path (already scaffolded,
  just not yet secret-configured per `docs/09-git-workflow.md`) covers
  `apps/admin` automatically the same way it will eventually cover web/
  backend — this ADR doesn't need to invent Admin-specific CI/CD.
- Local dev: `apps/admin` gets its own `pnpm dev` port (alongside web's
  3000, backend's 4000).

---

## 12. Security requirements

**Context.** Consolidating the concrete floor implied by §1–11 into an
explicit, non-negotiable list for v1 — not new considerations, but named
requirements each traceable to a decision already made above.

**Decision — the following are all required for v1, not optional
hardening:**

1. Admin JWT uses a signing secret **distinct** from `JWT_ACCESS_SECRET`
   (§3) — a leaked customer secret must never grant admin access, and vice
   versa.
2. Every `/admin/**` route requires both `AdminJwtAuthGuard` **and** an
   explicit `@Roles()` check (§4) — no route may rely on "authenticated"
   alone. This is what actually closes `docs/home-admin-contract.md` §7's
   flagged gap, not just documents it again.
3. Admin access tokens are shorter-lived than the customer default (900s,
   confirmed `JWT_ACCESS_TTL` default in `auth.service.ts`), with mandatory
   refresh-token rotation — a stolen admin session should have a smaller
   exploitation window than a stolen customer session, given the blast-
   radius difference §4 establishes between roles.
4. `/admin/**` is HTTPS-only — already true site-wide via LiteSpeed/AutoSSL
   per `docs/08-staging-deployment.md`; stated here as a carried-forward
   requirement, not new scope.
5. Rate-limiting / lockout on the admin login endpoint specifically,
   mirroring `PhoneVerification.attemptsRemaining`'s existing
   attempt-limiting pattern applied to password attempts instead — a
   smaller, higher-value target than customer OTP endpoints, warranting at
   least the same class of protection.
6. Passwords hashed with a modern adaptive algorithm (argon2id or bcrypt at
   a current cost factor) — never anything reversible; both are standard,
   already-available Node-ecosystem libraries, nothing to invent.
7. `apps/admin` holds no direct DB/storage credentials — it calls the
   backend's `/admin/**` API like any other client, exactly how `apps/web`
   never touches Postgres/MinIO directly today (§1/§2's boundary).
8. CORS on `/admin/**` restricted to the admin app's own origins only
   (`admin.biawin.ir`, its staging equivalent, `localhost:<admin-port>` in
   dev) — a separate allow-list from `CORS_ORIGINS`'s existing customer-web
   value (`https://staging.biawin.ir` today, per `docs/08-staging-deployment.md`),
   not an addition to it.

**Reasoning.** Each item traces directly to a decision above: distinct
audience (§3) → distinct signing secret; the RBAC decision (§4) → mandatory
role check, not just a guard; a small trusted population (§3) → password
over OTP, but still rate-limited because "small" isn't "unimportant"; the
separate-app boundary (§1) → its own CORS list and no direct infra
credentials. None of these are being weighed against alternatives — they
are the floor every decision above already implies.

**Consequences.** None of these require new libraries or infrastructure
this project doesn't already have access to (NestJS guards, standard
hashing libraries, existing LiteSpeed/AutoSSL, existing CORS middleware
pattern) — implementation cost is applying already-available primitives
consistently, not building new security infrastructure.

---

## Summary

| # | Decision area | Final decision |
|---|---|---|
| 1 | Admin app boundary | New `apps/admin` Next.js app, own domain (`admin.biawin.ir`), same monorepo |
| 2 | Backend architecture | Extend the existing NestJS backend, `OrbitItemsAdminController`-shaped modules |
| 3 | Authentication | Separate `AdminUser`, email+password, distinct JWT secret/audience |
| 4 | RBAC | Fixed `AdminRole` enum + `@Roles()`/`RolesGuard`, not flat and not a full permission matrix |
| 5 | Content ownership | `createdBy`/`updatedBy` FK on every admin-managed row |
| 6 | Media architecture | `imageKey` + `StorageService` + static-bridge URL, project-wide (Orbit's pattern, confirmed permanent) |
| 7 | Publishing workflow | Direct write, `active` toggle only — no draft/published, no approval pipeline |
| 8 | Audit logging | Dedicated append-only `AdminAuditLog` table via a shared interceptor |
| 9 | API boundaries | Admin-specific DTOs per resource, no shared public/admin shapes, no generic CRUD endpoint |
| 10 | Migration strategy | Existing `prisma migrate deploy` pipeline; fixed build order: auth → RBAC → audit → ownership → content models |
| 11 | Environment strategy | Same staging topology, one more container/vhost, dedicated env-secrets file |
| 12 | Security requirements | 8 concrete, traceable requirements — see §12 |

Every decision above is grounded in either an already-shipped precedent in
this codebase (`OrbitItem`/`OrbitItemsAdminController`, `StorageService`,
the existing `Category`/`MembershipPlan` schema, `deploy.sh`,
`deploy-staging.yml`) or `docs/home-admin-contract.md`'s already-frozen
content contract. No option was left open where the codebase already
supplies enough evidence to decide — the one genuinely deferred item
(SSO instead of password auth, §3) is deferred because it depends on an
external identity-provider decision this codebase has no evidence of
having made, not because this ADR avoided deciding.

---

# ADMIN ARCHITECTURE:
READY FOR IMPLEMENTATION
