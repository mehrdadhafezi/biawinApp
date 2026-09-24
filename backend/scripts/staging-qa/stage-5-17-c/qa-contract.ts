/**
 * Stage 5.17-C — pure, dependency-free QA contract helpers for the future
 * Home Admin Browser QA (docs/STAGE-5.17-C-HOME-ADMIN-BROWSER-QA-PLAN.md).
 *
 * Nothing here touches a browser, a database, the network or the file
 * system, so it is fully unit-testable
 * (`backend/src/qa-contract/stage-5-17-c-qa-contract.spec.ts`) and can be
 * shared by the fixture-control script (backend image, Prisma) and the
 * Playwright verifier (its own isolated image) — the latter receives the
 * values it needs through the fixture manifest, not by importing this file.
 *
 * It encodes the rules the plan makes non-negotiable:
 *  - one run tag for text fields, a SEPARATE slug prefix for bodySlug
 *    (underscores are never allowed in a bodySlug);
 *  - a fixture registry (register immediately, prove ownership before any
 *    mutation, know exactly what must be cleaned / what remains);
 *  - a dependency gate (a test never runs with an undefined/non-uuid id);
 *  - the mutation firewall decision (which non-GET requests the browser may
 *    send);
 *  - the protected-checksum and real-row baseline comparisons;
 *  - the machine-checkable final verdict / exit code.
 */

// ---------------------------------------------------------------------------
// Statuses, run identity, tag / slug conventions
// ---------------------------------------------------------------------------

export type QaStatus = 'PASS' | 'FAIL' | 'NOT_RUN' | 'BLOCKED';

export interface QaRun {
  runId: string;
  /** Text tag for names/titles/kickers/fileNames: `stage517c_qa_<runId>` (underscores allowed here ONLY). */
  tag: string;
  /** Slug prefix for every bodySlug: `stage517c-qa-<runId with underscores→hyphens>` (lowercase letters, digits, single hyphens). */
  slugPrefix: string;
}

export const BODY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BODY_SLUG_MAX = 100;
const RUN_ID_PATTERN = /^[0-9]+_[a-f0-9]{4,12}$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<epoch-ms>_<hex>` — e.g. `1790152949527_d02b48`. `hex` is supplied by the caller (crypto is not imported here). */
export function makeRunId(epochMs: number, hex: string): string {
  const id = `${Math.floor(epochMs)}_${hex.toLowerCase()}`;
  if (!RUN_ID_PATTERN.test(id))
    throw new Error(`makeRunId: "${id}" is not <digits>_<hex>`);
  return id;
}

export function makeQaRun(runId: string): QaRun {
  if (!RUN_ID_PATTERN.test(runId))
    throw new Error(`makeQaRun: invalid run id "${runId}"`);
  return {
    runId,
    tag: `stage517c_qa_${runId}`,
    slugPrefix: `stage517c-qa-${runId.replace(/_/g, '-')}`,
  };
}

/**
 * The ONE place a bodySlug is built — never derive a slug from `tag`.
 * `suffix` must be `[a-z0-9]+`; the result is validated against the backend
 * contract (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤100).
 */
export function makeQaBodySlug(run: QaRun, suffix: string): string {
  if (!/^[a-z0-9]+$/.test(suffix))
    throw new Error(`makeQaBodySlug: suffix "${suffix}" must be [a-z0-9]+`);
  const slug = `${run.slugPrefix}-${suffix}`;
  if (!BODY_SLUG_PATTERN.test(slug) || slug.length > BODY_SLUG_MAX) {
    throw new Error(`makeQaBodySlug: "${slug}" violates the bodySlug contract`);
  }
  return slug;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** A tagged file name for uploads made through the UI/API: `<tag>-<suffix>.png`. */
export function makeQaFileName(run: QaRun, suffix: string): string {
  return `${run.tag}-${suffix}.png`;
}

// ---------------------------------------------------------------------------
// Fixture registry + ownership proof
// ---------------------------------------------------------------------------

export type FixtureType =
  'news' | 'banner' | 'mosaic' | 'hero' | 'media' | 'storage' | 'admin-user';
export type CleanupState = 'PENDING' | 'OK' | 'FAILED';

export interface Fixture {
  name: string;
  type: FixtureType;
  id: string;
  /** Human-readable identification (tag / slug / fileName) — never a secret. */
  marker: string;
  cleanup: CleanupState;
  cleanupDetail: string;
}

export class FixtureRegistry {
  private readonly items: Fixture[] = [];

  /** Register IMMEDIATELY after creation. Refuses a non-uuid id (storage keys / admin ids excepted) so an undefined id can never be registered. */
  register(
    name: string,
    type: FixtureType,
    id: string,
    marker: string,
  ): Fixture {
    if (type !== 'storage' && !isUuid(id))
      throw new Error(
        `FixtureRegistry.register("${name}"): id "${String(id)}" is not a uuid`,
      );
    if (this.items.some((f) => f.type === type && f.id === id))
      return this.items.find((f) => f.type === type && f.id === id)!;
    const fixture: Fixture = {
      name,
      type,
      id,
      marker,
      cleanup: 'PENDING',
      cleanupDetail: '',
    };
    this.items.push(fixture);
    return fixture;
  }

  all(): readonly Fixture[] {
    return this.items;
  }

  ids(type?: FixtureType): string[] {
    return this.items.filter((f) => !type || f.type === type).map((f) => f.id);
  }

  has(type: FixtureType, id: string): boolean {
    return this.items.some((f) => f.type === type && f.id === id);
  }

  /** Reverse creation order: dependents (rows) before what they reference (media). */
  cleanupOrder(): Fixture[] {
    return [...this.items].reverse();
  }

  markCleanup(
    type: FixtureType,
    id: string,
    state: CleanupState,
    detail = '',
  ): void {
    const f = this.items.find((x) => x.type === type && x.id === id);
    if (f) {
      f.cleanup = state;
      f.cleanupDetail = detail;
    }
  }

  failedCleanups(): Fixture[] {
    return this.items.filter((f) => f.cleanup !== 'OK');
  }
}

export interface OwnableRow {
  id: string;
  /** news.bodySlug / news.category / banner.kicker / mosaic.kicker / media.fileName / hero.label — whichever the type carries. */
  markers: Array<string | null | undefined>;
}

/**
 * Ownership proof — a mutation/cleanup may only touch an object that is
 * (a) registered in THIS run's registry AND (b) carries this run's tag or
 * slug prefix. Either alone is not enough. Old-run fixtures (different
 * run id) and real rows both fail.
 */
export function isOwnedByRun(
  run: QaRun,
  registry: FixtureRegistry,
  type: FixtureType,
  row: OwnableRow,
): boolean {
  if (!registry.has(type, row.id)) return false;
  return row.markers.some(
    (m) =>
      typeof m === 'string' &&
      (m.includes(run.tag) || m.startsWith(run.slugPrefix)),
  );
}

export function assertOwnedByRun(
  run: QaRun,
  registry: FixtureRegistry,
  type: FixtureType,
  row: OwnableRow,
): void {
  if (!isOwnedByRun(run, registry, type, row)) {
    throw new Error(
      `refusing to touch ${type} ${row.id}: not proven to belong to QA run ${run.runId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Dependency gate — a fixture-dependent test never runs with undefined ids
// ---------------------------------------------------------------------------

export class FixtureBag {
  private readonly values = new Map<string, string>();

  set(name: string, id: string | undefined): void {
    if (isUuid(id)) this.values.set(name, id);
  }

  get(name: string): string {
    const v = this.values.get(name);
    if (!v) throw new Error(`fixture "${name}" is not available`);
    return v;
  }

  /** `{ ok: true }` only when EVERY named fixture exists; otherwise a reason naming the missing ones. */
  require(...names: string[]): { ok: true } | { ok: false; reason: string } {
    const missing = names.filter((n) => !this.values.has(n));
    return missing.length === 0
      ? { ok: true }
      : { ok: false, reason: `fixture(s) not created: ${missing.join(', ')}` };
  }
}

// ---------------------------------------------------------------------------
// Mutation firewall — decides whether the browser may send a non-GET request
// ---------------------------------------------------------------------------

export interface FirewallInput {
  method: string;
  /** Path only, e.g. `/api/v1/admin/home/news-articles/<uuid>`. */
  path: string;
  /** Parsed JSON body when there is one (string fields are used for the create-must-carry-the-tag rule). */
  body?: unknown;
  /** `STAGE517C_ALLOW_REORDER_METADATA_TOUCH === 'true'` — see the plan §12. */
  allowReorderMetadataTouch: boolean;
}

export interface FirewallDecision {
  allow: boolean;
  reason: string;
}

const HOME_RESOURCES = [
  'hero-cards',
  'service-banners',
  'service-mosaic-tiles',
  'news-articles',
];

/**
 * Only requests that provably target this run's fixtures pass. Everything
 * else — updates/deletes of real rows, any catalog endpoint, any unknown
 * route — is blocked (and the verifier records a FAIL if the UI tried).
 */
export function decideMutation(
  run: QaRun,
  registry: FixtureRegistry,
  input: FirewallInput,
): FirewallDecision {
  const method = input.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
    return { allow: true, reason: 'read-only' };

  const path = input.path.replace(/^\/api\/v1/, '').replace(/\/+$/, '');

  // Admin auth (login/refresh/logout) is not Home data.
  if (/^\/admin\/auth\/(login|refresh|logout)$/.test(path))
    return { allow: true, reason: 'admin auth' };

  // Media upload creates a NEW asset; the file name must carry the tag (checked by the verifier on the file it sends).
  if (method === 'POST' && path === '/admin/media/upload')
    return { allow: true, reason: 'media upload (creates a new tagged asset)' };

  const media = /^\/admin\/media\/([^/]+)$/.exec(path);
  if (media) {
    if (method !== 'DELETE')
      return { allow: false, reason: 'only DELETE is valid on a media asset' };
    return registry.has('media', media[1])
      ? { allow: true, reason: 'delete of a QA media asset' }
      : {
          allow: false,
          reason: `media ${media[1]} is not a QA fixture of this run`,
        };
  }

  const reorder = /^\/admin\/home\/([^/]+)\/reorder$/.exec(path);
  if (reorder && HOME_RESOURCES.includes(reorder[1])) {
    // The Admin UI always sends the WHOLE displayed list, so it touches real rows' updatedAt/updatedBy.
    return input.allowReorderMetadataTouch
      ? {
          allow: true,
          reason:
            'reorder explicitly approved (real rows keep id/order/active/media; only updatedAt/updatedBy may change)',
        }
      : {
          allow: false,
          reason:
            'reorder sends real rows too — blocked unless STAGE517C_ALLOW_REORDER_METADATA_TOUCH=true',
        };
  }

  const create = new RegExp(`^/admin/home/(${HOME_RESOURCES.join('|')})$`).exec(
    path,
  );
  if (create) {
    if (method !== 'POST')
      return {
        allow: false,
        reason: 'only POST is valid on a Home collection',
      };
    const body =
      input.body && typeof input.body === 'object'
        ? (input.body as Record<string, unknown>)
        : {};
    const carriesTag = Object.values(body).some(
      (v) =>
        typeof v === 'string' &&
        (v.includes(run.tag) || v.startsWith(run.slugPrefix)),
    );
    // Public exposure guard: a QA row is never created ACTIVE (the forms default to active=true, so a test must untick it).
    if (body.active === true) {
      return {
        allow: false,
        reason:
          'create with active=true would expose a QA row on the public Home',
      };
    }
    return carriesTag
      ? { allow: true, reason: 'create of a tagged QA row' }
      : {
          allow: false,
          reason: "create body does not carry this run's tag/slug prefix",
        };
  }

  const item = new RegExp(
    `^/admin/home/(${HOME_RESOURCES.join('|')})/([^/]+)$`,
  ).exec(path);
  if (item) {
    const type: FixtureType =
      item[1] === 'news-articles'
        ? 'news'
        : item[1] === 'service-banners'
          ? 'banner'
          : item[1] === 'service-mosaic-tiles'
            ? 'mosaic'
            : 'hero';
    if (method !== 'PUT' && method !== 'DELETE')
      return {
        allow: false,
        reason: `${method} is not a valid Home item mutation`,
      };
    return registry.has(type, item[2])
      ? { allow: true, reason: `${method} of a QA ${type} row` }
      : {
          allow: false,
          reason: `${type} ${item[2]} is not a QA fixture of this run (real row protected)`,
        };
  }

  return {
    allow: false,
    reason:
      'unknown or out-of-scope mutating endpoint (catalog and everything else is forbidden)',
  };
}

// ---------------------------------------------------------------------------
// Protected-artwork checksums and the real-row Home baseline
// ---------------------------------------------------------------------------

export const PROTECTED_TABLES = [
  'card_products',
  'category_cards',
  'categories',
  'services',
  'services.gallery',
] as const;

export interface TableChecksum {
  table: string;
  count: number;
  md5: string | null;
}

export interface ChecksumDiff {
  table: string;
  before: string;
  after: string;
  match: boolean;
}

/** All five protected tables must be present in BOTH snapshots and identical (count and md5). A missing table is a mismatch. */
export function compareChecksums(
  before: TableChecksum[],
  after: TableChecksum[],
): { ok: boolean; diffs: ChecksumDiff[] } {
  const diffs: ChecksumDiff[] = PROTECTED_TABLES.map((table) => {
    const b = before.find((x) => x.table === table);
    const a = after.find((x) => x.table === table);
    const match =
      !!a && !!b && a.md5 !== null && a.md5 === b.md5 && a.count === b.count;
    return {
      table,
      before: b ? `${b.count}|${b.md5}` : 'MISSING',
      after: a ? `${a.count}|${a.md5}` : 'MISSING',
      match,
    };
  });
  return { ok: diffs.every((d) => d.match), diffs };
}

export interface HomeRowSnapshot {
  resource: 'hero' | 'banner' | 'mosaic' | 'news';
  id: string;
  active: boolean;
  sortOrder: number;
  mediaAssetId: string | null;
  categoryId?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface BaselineDiff {
  ok: boolean;
  problems: string[];
}

/**
 * Compares the REAL rows (everything that is not a QA fixture of this run)
 * before and after. Identity, order, active state, sortOrder, media and
 * category references must be identical; `updatedAt`/`updatedBy` are compared
 * too unless `ignoreUpdateMetadata` (only when a reorder was explicitly
 * approved). A real row that appears/disappears is a failure.
 */
export function compareHomeBaseline(
  before: HomeRowSnapshot[],
  after: HomeRowSnapshot[],
  isQaRow: (row: HomeRowSnapshot) => boolean,
  options: { ignoreUpdateMetadata?: boolean } = {},
): BaselineDiff {
  const problems: string[] = [];
  const realBefore = before.filter((r) => !isQaRow(r));
  const realAfter = after.filter((r) => !isQaRow(r));

  for (const resource of ['hero', 'banner', 'mosaic', 'news'] as const) {
    const b = realBefore.filter((r) => r.resource === resource);
    const a = realAfter.filter((r) => r.resource === resource);
    const orderB = b.map((r) => r.id).join(',');
    const orderA = a.map((r) => r.id).join(',');
    if (orderB !== orderA)
      problems.push(
        `${resource}: real row set/order changed (${b.length} -> ${a.length})`,
      );
    for (const row of b) {
      const other = a.find((x) => x.id === row.id);
      if (!other) {
        problems.push(`${resource} ${row.id}: real row disappeared`);
        continue;
      }
      const fields: Array<keyof HomeRowSnapshot> = [
        'active',
        'sortOrder',
        'mediaAssetId',
        'categoryId',
      ];
      if (!options.ignoreUpdateMetadata) fields.push('updatedAt', 'updatedBy');
      for (const f of fields) {
        if (row[f] !== other[f])
          problems.push(
            `${resource} ${row.id}: ${f} changed (${String(row[f])} -> ${String(other[f])})`,
          );
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

export interface PublicCounts {
  hero: number;
  banners: number;
  mosaic: number;
  news: number;
}

export function publicCountsEqual(a: PublicCounts, b: PublicCounts): boolean {
  return (
    a.hero === b.hero &&
    a.banners === b.banners &&
    a.mosaic === b.mosaic &&
    a.news === b.news
  );
}

// ---------------------------------------------------------------------------
// Test matrix (the single source of truth the verifier and the plan share)
// ---------------------------------------------------------------------------

/**
 * R = real backend, QA-fixture rows only.
 * S = backend response stubbed in the browser (page.route fulfill) — no backend call, no data touched.
 * O = observation only on real data (read-only, nothing submitted).
 * P = payload capture: the UI request is intercepted and aborted; only its shape is asserted.
 */
export type TestClass = 'R' | 'S' | 'O' | 'P';
export type QaRole = 'SUPER_ADMIN' | 'CONTENT_EDITOR' | 'SUPPORT_VIEWER';

export interface QaTestSpec {
  id: string;
  area:
    | 'hero'
    | 'banner'
    | 'mosaic'
    | 'news'
    | 'media'
    | 'errors'
    | 'reorder'
    | 'rbac'
    | 'nav';
  title: string;
  klass: TestClass;
  role: QaRole;
  /** Fixture names (see the plan's fixture matrix) that must exist for this test to run. */
  fixtures: string[];
  /** Env flag / capability that must be granted, otherwise the test is BLOCKED (not skipped silently). */
  requires?:
    | 'REORDER_METADATA_TOUCH'
    | 'SUPPORT_VIEWER_ACCOUNT'
    | 'CONTENT_EDITOR_ACCOUNT';
}

export const QA_TESTS: readonly QaTestSpec[] = [
  // --- navigation / read-only
  {
    id: 'NAV-01',
    area: 'nav',
    title: 'Sign in; /home overview lists the 4 resources with counts',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'NAV-02',
    area: 'nav',
    title:
      'All 4 Home lists render (rows, thumbnails, empty/loading) without console errors',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },

  // --- hero (every real key is occupied: no mutation of a real row is ever sent)
  {
    id: 'HERO-01',
    area: 'hero',
    title:
      'Create form with all 3 keys occupied shows the "all keys used" state and a disabled submit',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'HERO-02',
    area: 'hero',
    title:
      'Edit form (real row, NOT saved): blank/over-long fields block submit with field errors and send ZERO requests',
    klass: 'P',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'HERO-03',
    area: 'hero',
    title:
      'Duplicate cardKey 409 renders the Persian "key already used" message (stubbed response)',
    klass: 'S',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },

  // --- banner
  {
    id: 'BAN-01',
    area: 'banner',
    title:
      'Create banner: required kicker/category, max 200 (client validation, no request)',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'BAN-02',
    area: 'banner',
    title:
      'Create valid QA banner (inactive) with an existing active category + picker-selected media B',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mediaB'],
  },
  {
    id: 'BAN-03',
    area: 'banner',
    title:
      'Edit QA banner referencing the existing INACTIVE category: it stays visible as "(غیرفعال)", id unchanged after save',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['bannerInactiveCat'],
  },
  {
    id: 'BAN-04',
    area: 'banner',
    title: 'Replace media / clear media on a QA banner; API state after save',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['bannerMediaA', 'mediaB'],
  },
  {
    id: 'BAN-05',
    area: 'banner',
    title:
      'Real inactive-category banner opened read-only (NOT saved): placeholder bug fixed, no request sent',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'BAN-06',
    area: 'banner',
    title:
      'Unknown category 422 renders "دسته‌بندی انتخاب‌شده معتبر نیست." (stubbed)',
    klass: 'S',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'BAN-07',
    area: 'banner',
    title:
      'Toggle payload {active:true} captured and aborted on a QA banner (never made public); then delete the QA banner (real)',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['bannerToggle'],
  },

  // --- mosaic
  {
    id: 'MOS-01',
    area: 'mosaic',
    title:
      'Create QA half tile (title/lead blank -> null) and QA wide tile (title/lead set)',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'MOS-02',
    area: 'mosaic',
    title:
      'Length limits: title 200, lead 500, kicker 200; required kicker/category',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'MOS-03',
    area: 'mosaic',
    title: 'Edit tile: media replace/clear, category, valid save; API state',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mosaicWide', 'mediaB'],
  },

  // --- news
  {
    id: 'NEWS-01',
    area: 'news',
    title:
      'Required fields and max lengths (100/200/300/1000) block submit client-side',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'NEWS-02',
    area: 'news',
    title:
      'Invalid bodySlug (space, UPPER, underscore, double hyphen, >100) blocked with a Persian message, no request',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'NEWS-03',
    area: 'news',
    title:
      'Valid bodySlug saves; the same slug on another QA row -> real 409 Persian message',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsSlugOwner'],
  },
  {
    id: 'NEWS-04',
    area: 'news',
    title: 'Create QA news via UI (inactive) with picker-uploaded media',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'NEWS-05',
    area: 'news',
    title: 'Edit QA news; replace/clear media; API state',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsMediaA', 'mediaB'],
  },
  {
    id: 'NEWS-06',
    area: 'news',
    title: 'Unknown media 422 renders "رسانه انتخاب‌شده معتبر نیست." (stubbed)',
    klass: 'S',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },

  // --- soft-deleted media (Stage 5.17-A M1)
  {
    id: 'SDM-01',
    area: 'news',
    title:
      'Legacy row (media C soft-deleted): warning "تصویر قبلی در دسترس نیست" + Replace + Clear shown, no silent substitute',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsLegacyReplace', 'mediaC'],
  },
  {
    id: 'SDM-02',
    area: 'news',
    title:
      'Resolve by Replace (media B) -> save -> API mediaAssetId === media B',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsLegacyReplace', 'mediaC', 'mediaB'],
  },
  {
    id: 'SDM-03',
    area: 'news',
    title: 'Resolve by Clear -> save -> API mediaAssetId === null',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsLegacyClear', 'mediaC'],
  },
  {
    id: 'SDM-04',
    area: 'news',
    title:
      'Edit another field WITHOUT resolving -> save succeeds (no 422) and mediaAssetId is still media C (never rewritten)',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsLegacyKeep', 'mediaC'],
  },
  {
    id: 'SDM-05',
    area: 'banner',
    title: 'Same warning/Replace path on a legacy QA banner',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['bannerLegacy', 'mediaC', 'mediaB'],
  },

  // --- media library
  {
    id: 'MED-01',
    area: 'media',
    title: 'Media page opens; total count shown; pager present when total > 50',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'MED-02',
    area: 'media',
    title:
      'Next/previous page load different assets; page/total consistent with the API total',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'MED-03',
    area: 'media',
    title:
      'Picker pages through the library; selecting an asset sends no write request',
    klass: 'P',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'MED-04',
    area: 'media',
    title: 'Delete shows a confirmation dialog; Cancel sends no request',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mediaD'],
  },
  {
    id: 'MED-05',
    area: 'media',
    title:
      'Confirm delete of an unreferenced QA asset succeeds and the list refreshes',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mediaD'],
  },
  {
    id: 'MED-06',
    area: 'media',
    title:
      'Delete of a referenced QA asset (media A) -> real 409, Persian in-use message with references, asset remains, reference intact',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mediaA', 'newsMediaA'],
  },
  {
    id: 'MED-07',
    area: 'media',
    title:
      'Delete of an asset removed elsewhere (media E) -> 404 message and the list reconciles',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mediaE'],
  },
  {
    id: 'MED-08',
    area: 'media',
    title:
      'No delete bypass: the UI sends exactly one DELETE, never a PUT/PATCH detaching a reference',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['mediaA', 'newsMediaA'],
  },

  // --- errors / stale
  {
    id: 'ERR-01',
    area: 'errors',
    title:
      'Row deleted elsewhere: toggle -> Persian 404 message and the list refetches',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsStale'],
  },
  {
    id: 'ERR-02',
    area: 'errors',
    title:
      'Row deleted elsewhere: delete -> dialog closes, message shown, list refetches',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsStale2'],
  },
  {
    id: 'ERR-03',
    area: 'errors',
    title:
      '500 shows only the generic Persian message (stubbed response containing internal text)',
    klass: 'S',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },
  {
    id: 'ERR-04',
    area: 'errors',
    title:
      'Malformed UUID edit route (/home/news/not-a-uuid) shows a Persian-prefixed 400 message, no crash',
    klass: 'O',
    role: 'SUPER_ADMIN',
    fixtures: [],
  },

  // --- reorder
  {
    id: 'REO-01',
    area: 'reorder',
    title:
      'Reorder payload captured and aborted: whole displayed list, unique uuids, positions 0..n-1, no empty/duplicate',
    klass: 'P',
    role: 'SUPER_ADMIN',
    fixtures: ['newsReorderA', 'newsReorderB'],
  },
  {
    id: 'REO-02',
    area: 'reorder',
    title: 'Valid reorder of two QA rows, list refreshes, order restored',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: ['newsReorderA', 'newsReorderB'],
    requires: 'REORDER_METADATA_TOUCH',
  },
  {
    id: 'REO-03',
    area: 'reorder',
    title:
      'Unknown-id reorder 422 (stubbed): Persian message with count, list refetched',
    klass: 'S',
    role: 'SUPER_ADMIN',
    fixtures: ['newsReorderA'],
  },
  {
    id: 'REO-04',
    area: 'reorder',
    title:
      'Reorder failure (stubbed 500): list keeps the server order after reconciliation',
    klass: 'S',
    role: 'SUPER_ADMIN',
    fixtures: ['newsReorderA'],
  },

  // --- RBAC
  {
    id: 'RBAC-01',
    area: 'rbac',
    title:
      'SUPPORT_VIEWER: lists show no create/reorder/delete controls; toggle disabled',
    klass: 'O',
    role: 'SUPPORT_VIEWER',
    fixtures: [],
    requires: 'SUPPORT_VIEWER_ACCOUNT',
  },
  {
    id: 'RBAC-02',
    area: 'rbac',
    title:
      'SUPPORT_VIEWER: edit page is read-only (no submit); /home/*/new redirects to the list',
    klass: 'O',
    role: 'SUPPORT_VIEWER',
    fixtures: [],
    requires: 'SUPPORT_VIEWER_ACCOUNT',
  },
  {
    id: 'RBAC-03',
    area: 'rbac',
    title: 'SUPPORT_VIEWER: Media page shows no delete control',
    klass: 'O',
    role: 'SUPPORT_VIEWER',
    fixtures: [],
    requires: 'SUPPORT_VIEWER_ACCOUNT',
  },
  {
    id: 'RBAC-04',
    area: 'rbac',
    title:
      'CONTENT_EDITOR: can create a QA news row and delete a QA media asset',
    klass: 'R',
    role: 'CONTENT_EDITOR',
    fixtures: ['mediaD2'],
    requires: 'CONTENT_EDITOR_ACCOUNT',
  },
];

// ---------------------------------------------------------------------------
// Fixture catalog (which fixture exists for which tests — see the plan §6)
// ---------------------------------------------------------------------------

export interface FixtureSpec {
  name: string;
  type: FixtureType;
  /** How it is created and its state. */
  description: string;
  /** Created inactive unless a test explicitly needs it public. */
  inactive: boolean;
}

export const FIXTURE_CATALOG: readonly FixtureSpec[] = [
  {
    name: 'mediaA',
    type: 'media',
    description:
      'active QA media, referenced by bannerMediaA and newsMediaA (delete must 409)',
    inactive: false,
  },
  {
    name: 'mediaB',
    type: 'media',
    description: 'active, unreferenced QA media — picker/replace target',
    inactive: false,
  },
  {
    name: 'mediaC',
    type: 'media',
    description:
      'QA media uploaded, then SOFT-DELETED through the API while unreferenced (legacy-reference source)',
    inactive: false,
  },
  {
    name: 'mediaD',
    type: 'media',
    description:
      'active, unreferenced QA media — UI delete-confirm / delete-success target',
    inactive: false,
  },
  {
    name: 'mediaD2',
    type: 'media',
    description: 'active, unreferenced QA media — CONTENT_EDITOR delete target',
    inactive: false,
  },
  {
    name: 'mediaE',
    type: 'media',
    description:
      'active QA media removed via the API AFTER the page loaded (delete-elsewhere / 404)',
    inactive: false,
  },
  {
    name: 'bannerMediaA',
    type: 'banner',
    description:
      'inactive QA banner on an EXISTING active category, referencing mediaA',
    inactive: true,
  },
  {
    name: 'bannerInactiveCat',
    type: 'banner',
    description:
      'inactive QA banner on the EXISTING inactive category (read-only reference, category row untouched)',
    inactive: true,
  },
  {
    name: 'bannerToggle',
    type: 'banner',
    description: 'inactive QA banner for toggle/delete',
    inactive: true,
  },
  {
    name: 'bannerLegacy',
    type: 'banner',
    description:
      'inactive QA banner whose mediaAssetId is repointed (direct Prisma, QA row -> QA media) to soft-deleted mediaC',
    inactive: true,
  },
  {
    name: 'mosaicWide',
    type: 'mosaic',
    description: 'inactive QA wide tile (title/lead set) for edit tests',
    inactive: true,
  },
  {
    name: 'newsSlugOwner',
    type: 'news',
    description:
      'inactive QA news that owns a valid bodySlug (duplicate-slug source)',
    inactive: true,
  },
  {
    name: 'newsMediaA',
    type: 'news',
    description: 'inactive QA news referencing mediaA',
    inactive: true,
  },
  {
    name: 'newsLegacyReplace',
    type: 'news',
    description:
      'legacy reference to soft-deleted mediaC — resolved by Replace',
    inactive: true,
  },
  {
    name: 'newsLegacyClear',
    type: 'news',
    description: 'legacy reference to soft-deleted mediaC — resolved by Clear',
    inactive: true,
  },
  {
    name: 'newsLegacyKeep',
    type: 'news',
    description:
      'legacy reference to soft-deleted mediaC — edited without resolving',
    inactive: true,
  },
  {
    name: 'newsStale',
    type: 'news',
    description:
      'QA news deleted through the API after the list loaded (toggle -> 404)',
    inactive: true,
  },
  {
    name: 'newsStale2',
    type: 'news',
    description:
      'QA news deleted through the API after the list loaded (delete -> 404)',
    inactive: true,
  },
  {
    name: 'newsReorderA',
    type: 'news',
    description: 'inactive QA news, sortOrder 99990 (reorder)',
    inactive: true,
  },
  {
    name: 'newsReorderB',
    type: 'news',
    description: 'inactive QA news, sortOrder 99991 (reorder)',
    inactive: true,
  },
];

// ---------------------------------------------------------------------------
// Outcome bookkeeping + the final verdict
// ---------------------------------------------------------------------------

export interface TestOutcome {
  id: string;
  status: QaStatus;
  detail: string;
}

/** A test whose fixtures are missing is NOT_RUN with an explicit reason — never executed with undefined ids. */
export function gateTest(
  spec: QaTestSpec,
  bag: FixtureBag,
  capabilities: ReadonlySet<string>,
): { run: true } | { run: false; outcome: TestOutcome } {
  if (spec.requires && !capabilities.has(spec.requires)) {
    return {
      run: false,
      outcome: {
        id: spec.id,
        status: 'BLOCKED',
        detail: `requires ${spec.requires}, which was not granted/available`,
      },
    };
  }
  const deps = bag.require(...spec.fixtures);
  if (!deps.ok)
    return {
      run: false,
      outcome: {
        id: spec.id,
        status: 'NOT_RUN',
        detail: `dependency not satisfied — ${deps.reason}`,
      },
    };
  return { run: true };
}

export interface VerdictInput {
  outcomes: TestOutcome[];
  cleanupFailures: number;
  remainingFixtures: number;
  checksumsOk: boolean;
  homeBaselineOk: boolean;
  publicCountsOk: boolean;
  /** Anything the verifier itself flagged (firewall violations, unexpected console errors on QA pages, ...). */
  firewallViolations: number;
}

export interface Verdict {
  status: 'PASS' | 'FAIL';
  exitCode: 0 | 1;
  reasons: string[];
}

/** Non-zero unless EVERY matrix test PASSed and every integrity gate holds. */
export function finalVerdict(
  input: VerdictInput,
  matrix: readonly QaTestSpec[] = QA_TESTS,
): Verdict {
  const reasons: string[] = [];
  for (const spec of matrix) {
    const outcome = input.outcomes.find((o) => o.id === spec.id);
    if (!outcome) reasons.push(`${spec.id}: no outcome recorded`);
    else if (outcome.status !== 'PASS')
      reasons.push(`${spec.id}: ${outcome.status} — ${outcome.detail}`);
  }
  if (input.cleanupFailures > 0)
    reasons.push(`cleanup failed for ${input.cleanupFailures} fixture(s)`);
  if (input.remainingFixtures !== 0)
    reasons.push(
      `${input.remainingFixtures} QA fixture(s) remain after cleanup`,
    );
  if (!input.checksumsOk)
    reasons.push('protected artwork checksums changed (BEFORE != AFTER)');
  if (!input.homeBaselineOk)
    reasons.push('Home real-row baseline not restored');
  if (!input.publicCountsOk) reasons.push('public Home counts not restored');
  if (input.firewallViolations > 0)
    reasons.push(
      `${input.firewallViolations} blocked mutation attempt(s) against non-QA data`,
    );
  return reasons.length === 0
    ? { status: 'PASS', exitCode: 0, reasons }
    : { status: 'FAIL', exitCode: 1, reasons };
}
