/**
 * Stage 5.17-D — pure orchestration helpers shared by the fixture-control
 * script (`control.ts`, backend image) and the Playwright verifier
 * (`deploy/staging/qa/browser/stage-5-17-c/verifier.ts`).
 *
 * No I/O, no browser, no database: everything here is unit-tested
 * (`backend/src/qa-contract/stage-5-17-d-orchestration.spec.ts`). Safety
 * logic that already lives in `qa-contract.ts` (tag/slug, registry,
 * ownership, mutation firewall, checksum/baseline comparison, verdict) is
 * imported, never duplicated.
 */
import {
  BODY_SLUG_PATTERN,
  BODY_SLUG_MAX,
  QA_TESTS,
  isUuid,
  type FixtureType,
  type QaStatus,
  type QaTestSpec,
  type TestClass,
  type TestOutcome,
} from './qa-contract';

// ---------------------------------------------------------------------------
// Run-directory file names (single source of truth for control + verifier + wrapper)
// ---------------------------------------------------------------------------

export const RUN_FILES = {
  state: 'state.json', // fixture registry, persisted after EVERY registration (teardown reads it)
  manifest: 'manifest.json', // what the browser verifier needs — NEVER secrets
  setupResult: 'setup-result.json',
  before: 'before.json',
  after: 'after.json',
  cleanup: 'cleanup.json',
  remaining: 'remaining-fixtures.json',
  browserResults: 'browser-results.json',
  dynamicFixtures: 'dynamic-fixtures.ndjson', // fixtures created BY the UI during tests (registered by the verifier)
  firewallEvents: 'firewall-events.json',
  roles: 'roles.json', // temporary-role credentials: 0600, mounted read-only into the browser container, deleted at teardown
  reportTxt: 'stage-5-17-c-report.txt',
  reportJson: 'stage-5-17-c-report.json',
  checksumsBefore: 'stage-5.17-c-before.txt',
  checksumsAfter: 'stage-5.17-c-after.txt',
  screenshotsDir: 'screenshots',
} as const;

// ---------------------------------------------------------------------------
// Environment flags
// ---------------------------------------------------------------------------

/** Only the literal string `true` enables a flag — `1`, `yes`, `TRUE ` etc. do NOT (no reinterpretation). */
export function envFlag(value: string | undefined): boolean {
  return value === 'true';
}

export type Capability =
  | 'REORDER_METADATA_TOUCH'
  | 'SUPPORT_VIEWER_ACCOUNT'
  | 'CONTENT_EDITOR_ACCOUNT';

/**
 * Capabilities the run has actually been granted. RBAC capabilities exist
 * only when a temporary account was really provisioned; the reorder
 * capability exists only when the operator set the explicit flag.
 */
export function deriveCapabilities(input: {
  allowReorderMetadataTouch: boolean;
  availableRoles: readonly string[];
}): Set<Capability> {
  const caps = new Set<Capability>();
  if (input.allowReorderMetadataTouch) caps.add('REORDER_METADATA_TOUCH');
  if (input.availableRoles.includes('SUPPORT_VIEWER'))
    caps.add('SUPPORT_VIEWER_ACCOUNT');
  if (input.availableRoles.includes('CONTENT_EDITOR'))
    caps.add('CONTENT_EDITOR_ACCOUNT');
  return caps;
}

// ---------------------------------------------------------------------------
// Slug guard used before every News POST
// ---------------------------------------------------------------------------

export function assertValidBodySlug(slug: unknown): asserts slug is string {
  if (
    typeof slug !== 'string' ||
    !BODY_SLUG_PATTERN.test(slug) ||
    slug.length > BODY_SLUG_MAX
  ) {
    throw new Error(
      `bodySlug "${String(slug)}" does not satisfy ^[a-z0-9]+(-[a-z0-9]+)*$ (max ${BODY_SLUG_MAX})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Manifest (browser input) — ids/tags/slugs only
// ---------------------------------------------------------------------------

export interface ManifestFixture {
  name: string;
  type: FixtureType;
  id: string;
  /** Human-visible identification: news title / banner kicker / media fileName. */
  marker: string;
  /** news only */
  bodySlug?: string;
}

export interface Manifest {
  runId: string;
  tag: string;
  slugPrefix: string;
  adminOrigin: string;
  apiOrigin: string;
  commitSha: string;
  startedAt: string;
  fixtures: ManifestFixture[];
  /** Fixtures that could not be created: name -> reason (their dependents become NOT_RUN). */
  fixtureErrors: Record<string, string>;
  slugs: { valid: string; unknownMedia: string };
  categories: {
    activeId: string | null;
    activeName: string | null;
    inactiveId: string | null;
    inactiveName: string | null;
  };
  /** Roles with a REAL provisioned account (never fabricated). */
  availableRoles: string[];
  /** Why a role is unavailable, e.g. `SUPPORT_VIEWER: temporary-account provisioning not enabled`. */
  unavailableRoles: Record<string, string>;
  allowReorderMetadataTouch: boolean;
  activeMediaTotal: number | null;
}

// ---------------------------------------------------------------------------
// Redaction and screenshot naming
// ---------------------------------------------------------------------------

/** Removes JWT-shaped strings, Bearer tokens and every supplied secret from `text`. */
export function redact(
  text: string,
  secrets: readonly (string | undefined)[] = [],
): string {
  let out = text
    .replace(
      /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      '<redacted-jwt>',
    )
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer <redacted>')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '<redacted-db-url>');
  for (const secret of secrets) {
    if (secret && secret.length >= 4)
      out = out.split(secret).join('<redacted>');
  }
  return out;
}

/** `stage517c-<runId>-<TEST-ID>[-suffix].png` — runId's `_` becomes `-` so the file name is portable. */
export function screenshotName(
  runId: string,
  testId: string,
  suffix?: string,
): string {
  const safe = (v: string) =>
    v.replace(/[^A-Za-z0-9-]/g, '-').replace(/-{2,}/g, '-');
  return `stage517c-${safe(runId)}-${safe(testId)}${suffix ? `-${safe(suffix)}` : ''}.png`;
}

// ---------------------------------------------------------------------------
// Mutation-firewall events
// ---------------------------------------------------------------------------

export interface FirewallEvent {
  testId: string;
  method: string;
  /** Path only — query strings and bodies are NOT recorded. */
  path: string;
  allowed: boolean;
  reason: string;
}

export function countFirewallViolations(
  events: readonly FirewallEvent[],
): number {
  return events.filter((e) => !e.allowed).length;
}

/** Collapses ids so the report shows `/admin/home/news-articles/:id` rather than thousands of distinct paths. */
export function templatePath(path: string): string {
  return path
    .replace(/\/api\/v1/, '')
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    )
    .split('?')[0];
}

// ---------------------------------------------------------------------------
// Reorder payload analysis (REO-01)
// ---------------------------------------------------------------------------

export interface ReorderItem {
  id: unknown;
  sortOrder: unknown;
}

/** Empty list = the UI payload is valid and safe. `listedIds` = the ids currently shown in the list. */
export function analyzeReorderPayload(
  body: unknown,
  listedIds: readonly string[],
): string[] {
  const problems: string[] = [];
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return ['body.items is not an array'];
  if (items.length === 0) problems.push('items is empty');
  const ids = new Set<string>();
  const positions = new Set<number>();
  items.forEach((raw: ReorderItem, index) => {
    if (!isUuid(raw?.id)) problems.push(`item ${index}: id is not a uuid`);
    else {
      if (ids.has(raw.id)) problems.push(`item ${index}: duplicate id`);
      ids.add(raw.id);
      if (listedIds.length > 0 && !listedIds.includes(raw.id))
        problems.push(`item ${index}: id is not in the displayed list`);
    }
    const p = raw?.sortOrder;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 100000)
      problems.push(`item ${index}: sortOrder is not an integer in 0..100000`);
    else {
      if (positions.has(p))
        problems.push(`item ${index}: duplicate position ${p}`);
      positions.add(p);
    }
  });
  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length === items.length && sorted.some((p, i) => p !== i))
    problems.push('positions are not the canonical 0..n-1');
  return problems;
}

// ---------------------------------------------------------------------------
// Outcome merging + reporting
// ---------------------------------------------------------------------------

export interface BrowserOutcome extends TestOutcome {
  klass?: TestClass;
  screenshots?: string[];
  /** Sanitized observations: HTTP statuses, visible UI message, request counts. */
  evidence?: Record<string, unknown>;
}

/**
 * The final outcome list contains EXACTLY one entry per matrix test. A test
 * the browser verifier never reported (crash, setup blocked, browser not
 * started) is never silently dropped: it becomes BLOCKED when setup was
 * blocked, otherwise NOT_RUN, with the reason.
 */
export function mergeOutcomes(
  matrix: readonly QaTestSpec[],
  browser: readonly BrowserOutcome[],
  setupBlockedReason: string | null,
): BrowserOutcome[] {
  return matrix.map((spec) => {
    const found = browser.find((o) => o.id === spec.id);
    if (found) return { ...found, klass: found.klass ?? spec.klass };
    return {
      id: spec.id,
      klass: spec.klass,
      status: setupBlockedReason ? 'BLOCKED' : 'NOT_RUN',
      detail: setupBlockedReason
        ? `setup blocked — ${setupBlockedReason}`
        : 'the browser verifier produced no outcome for this test (it did not run or crashed before reaching it)',
    };
  });
}

/** Explicit Hero reporting: which Hero tests were real / stubbed / observed / captured / blocked. */
export function heroReport(
  outcomes: readonly BrowserOutcome[],
): Array<{ id: string; mode: string; status: QaStatus }> {
  const mode = (k?: TestClass) =>
    k === 'R'
      ? 'real backend (QA rows only)'
      : k === 'S'
        ? 'stubbed response'
        : k === 'P'
          ? 'payload captured, request aborted'
          : 'observation only (nothing submitted)';
  return outcomes
    .filter((o) => o.id.startsWith('HERO-'))
    .map((o) => ({ id: o.id, mode: mode(o.klass), status: o.status }));
}

export function tally(
  outcomes: readonly TestOutcome[],
): Record<QaStatus, number> {
  const t: Record<QaStatus, number> = {
    PASS: 0,
    FAIL: 0,
    NOT_RUN: 0,
    BLOCKED: 0,
  };
  for (const o of outcomes) t[o.status] += 1;
  return t;
}

export function requiredTestIds(): string[] {
  return QA_TESTS.map((t) => t.id);
}

// ---------------------------------------------------------------------------
// Stage 5.17-E — dependency + reorder pre-checks, audit-residue reporting
// ---------------------------------------------------------------------------

/** A test that needs an EXISTING catalog category is NOT_RUN (never FAIL) when there is none. `null` = satisfied. */
export function categoryDependency(
  categories: Manifest['categories'],
  kind: 'active' | 'inactive',
): string | null {
  const id = kind === 'active' ? categories.activeId : categories.inactiveId;
  return id
    ? null
    : `dependency not satisfied — no existing ${kind} category is available (categories are only read, never created)`;
}

/**
 * The Admin UI reorder always sends the WHOLE displayed list. Reorder is only
 * attempted when every listed id is a current-run QA row; otherwise the real
 * rows it would carry make the request unsafe and the test is BLOCKED
 * before any request is sent.
 */
export function reorderListIsQaOnly(
  listedIds: readonly string[],
  isQa: (id: string) => boolean,
): { ok: boolean; realIds: string[] } {
  const realIds = listedIds.filter((id) => !isQa(id));
  return { ok: listedIds.length > 0 && realIds.length === 0, realIds };
}

export interface AuditResidue {
  temporaryUsersCreated: number;
  temporaryUsersDeleted: number;
  /** Audit rows attributed to the temporary users, counted BEFORE the users were deleted (deletion nulls the actor, it does not delete the rows). */
  auditRowsCreatedByTemporaryUsers: number;
  /** Of those, how many still exist after cleanup (measured by row id, not inferred). */
  auditRowsRemaining: number;
}

/** Report lines. Remaining audit rows are stated as REMAINING — never as cleaned. */
export function formatAuditResidue(r: AuditResidue): string[] {
  return [
    `Temporary users created: ${r.temporaryUsersCreated}; deleted: ${r.temporaryUsersDeleted}`,
    `Audit rows created by temporary QA users: ${r.auditRowsCreatedByTemporaryUsers}; REMAINING after cleanup: ${r.auditRowsRemaining} (admin_audit_logs is append-only — these rows are NOT cleaned and their actor is now null)`,
    'Audit rows written by the seeded admin during fixture operations are not attributed or counted here and also remain.',
  ];
}
