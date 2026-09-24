import {
  BODY_SLUG_PATTERN,
  FIXTURE_CATALOG,
  FixtureBag,
  FixtureRegistry,
  PROTECTED_TABLES,
  QA_TESTS,
  assertOwnedByRun,
  compareChecksums,
  compareHomeBaseline,
  decideMutation,
  finalVerdict,
  gateTest,
  isOwnedByRun,
  makeQaBodySlug,
  makeQaFileName,
  makeQaRun,
  makeRunId,
  publicCountsEqual,
  type HomeRowSnapshot,
  type QaTestSpec,
  type TableChecksum,
  type VerdictInput,
} from '../../scripts/staging-qa/stage-5-17-c/qa-contract';

/**
 * Stage 5.17-C helper tests. The real Browser QA has NOT been run; these
 * cover only the pure contract helpers (tag/slug, fixture registry,
 * ownership proof, dependency gate, mutation firewall, checksum / baseline
 * comparison, final verdict). Mirrors the location convention of
 * `home-image-integrity.spec.ts`: a QA-only spec under `src` so the existing
 * backend jest configuration (rootDir `src`) runs it; specs are excluded from
 * the production build.
 */

const U = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const run = makeQaRun('1790152949527_d02b48');

describe('run identity, tag and slug convention', () => {
  it('builds the documented tag and a SEPARATE hyphenated slug prefix', () => {
    expect(run.tag).toBe('stage517c_qa_1790152949527_d02b48');
    expect(run.slugPrefix).toBe('stage517c-qa-1790152949527-d02b48');
    expect(makeQaBodySlug(run, 'news1')).toBe(
      'stage517c-qa-1790152949527-d02b48-news1',
    );
  });

  it('every generated slug satisfies the backend slug contract and never contains an underscore', () => {
    for (const suffix of ['news1', 'news2', 'dup', 'unknownmedia', 'a1b2']) {
      const slug = makeQaBodySlug(run, suffix);
      expect(slug).not.toContain('_');
      expect(slug).toMatch(BODY_SLUG_PATTERN);
      expect(slug.length).toBeLessThanOrEqual(100);
    }
  });

  it('the tag itself is NOT slug-valid (proves slugs must not be derived from it)', () => {
    expect(BODY_SLUG_PATTERN.test(run.tag)).toBe(false);
    expect(BODY_SLUG_PATTERN.test(`${run.tag}-news1`)).toBe(false);
  });

  it('rejects an unsafe suffix (underscore, upper case, space, hyphen, empty)', () => {
    for (const bad of ['news_1', 'NEWS1', 'news 1', 'news-1', '']) {
      expect(() => makeQaBodySlug(run, bad)).toThrow();
    }
  });

  it('makeRunId / makeQaRun validate their input', () => {
    expect(makeRunId(1790152949527.9, 'D02B48')).toBe('1790152949527_d02b48');
    expect(() => makeRunId(1, 'zz')).toThrow();
    expect(() => makeQaRun('not a run id')).toThrow();
  });

  it('tags upload file names', () => {
    expect(makeQaFileName(run, 'a')).toBe(
      'stage517c_qa_1790152949527_d02b48-a.png',
    );
  });
});

describe('FixtureRegistry + ownership proof', () => {
  it('refuses to register an undefined / non-uuid id', () => {
    const reg = new FixtureRegistry();
    expect(() =>
      reg.register('x', 'news', undefined as unknown as string, 'm'),
    ).toThrow();
    expect(() => reg.register('x', 'news', 'not-a-uuid', 'm')).toThrow();
    expect(reg.all()).toHaveLength(0);
  });

  it('registers immediately, de-duplicates, and yields reverse creation order for cleanup (rows before the media they use)', () => {
    const reg = new FixtureRegistry();
    reg.register('mediaA', 'media', U(1), 'f');
    reg.register('newsMediaA', 'news', U(2), 's');
    reg.register('newsMediaA', 'news', U(2), 's');
    expect(reg.all()).toHaveLength(2);
    expect(reg.cleanupOrder().map((f) => f.name)).toEqual([
      'newsMediaA',
      'mediaA',
    ]);
    expect(reg.ids('news')).toEqual([U(2)]);
  });

  it('tracks cleanup state and reports failures', () => {
    const reg = new FixtureRegistry();
    reg.register('a', 'news', U(1), 's');
    reg.register('b', 'media', U(2), 'f');
    reg.markCleanup('news', U(1), 'OK');
    expect(reg.failedCleanups().map((f) => f.name)).toEqual(['b']);
    reg.markCleanup('media', U(2), 'FAILED', 'still referenced');
    expect(reg.failedCleanups()[0].cleanupDetail).toBe('still referenced');
  });

  it('ownership needs BOTH registry membership and this run’s tag/slug prefix', () => {
    const reg = new FixtureRegistry();
    reg.register('n', 'news', U(1), 's');
    const slug = makeQaBodySlug(run, 'news1');
    expect(isOwnedByRun(run, reg, 'news', { id: U(1), markers: [slug] })).toBe(
      true,
    );
    expect(
      isOwnedByRun(run, reg, 'news', { id: U(1), markers: [run.tag] }),
    ).toBe(true);
    // registered but no tag -> a real row that somehow got registered must still be refused
    expect(
      isOwnedByRun(run, reg, 'news', {
        id: U(1),
        markers: ['بیاوین چگونه', null],
      }),
    ).toBe(false);
    // tagged but NOT registered (e.g. an old run's fixture with another run id) -> refused
    const other = makeQaRun('1700000000000_aaaaaa');
    expect(
      isOwnedByRun(run, reg, 'news', { id: U(9), markers: [run.tag] }),
    ).toBe(false);
    reg.register('old', 'news', U(3), 's');
    expect(
      isOwnedByRun(run, reg, 'news', {
        id: U(3),
        markers: [other.tag, makeQaBodySlug(other, 'x')],
      }),
    ).toBe(false);
    expect(() =>
      assertOwnedByRun(run, reg, 'news', { id: U(9), markers: [run.tag] }),
    ).toThrow(/not proven to belong/);
  });
});

describe('FixtureBag + gateTest (no cascade, never undefined ids)', () => {
  const spec = (over: Partial<QaTestSpec>): QaTestSpec => ({
    id: 'T-1',
    area: 'news',
    title: 't',
    klass: 'R',
    role: 'SUPER_ADMIN',
    fixtures: [],
    ...over,
  });

  it('ignores an undefined/non-uuid id and get() throws for a missing fixture', () => {
    const bag = new FixtureBag();
    bag.set('news1', undefined);
    bag.set('news2', 'nope');
    bag.set('news3', U(3));
    expect(bag.require('news3')).toEqual({ ok: true });
    expect(bag.require('news1', 'news2')).toEqual({
      ok: false,
      reason: 'fixture(s) not created: news1, news2',
    });
    expect(() => bag.get('news1')).toThrow();
    expect(bag.get('news3')).toBe(U(3));
  });

  it('a test with a missing fixture is NOT_RUN with an explicit reason', () => {
    const gate = gateTest(
      spec({ fixtures: ['news1'] }),
      new FixtureBag(),
      new Set(),
    );
    expect(gate).toEqual({
      run: false,
      outcome: {
        id: 'T-1',
        status: 'NOT_RUN',
        detail: 'dependency not satisfied — fixture(s) not created: news1',
      },
    });
  });

  it('a test needing an ungranted capability is BLOCKED, not silently skipped', () => {
    const gate = gateTest(
      spec({ requires: 'REORDER_METADATA_TOUCH' }),
      new FixtureBag(),
      new Set(),
    );
    expect(gate).toMatchObject({ run: false, outcome: { status: 'BLOCKED' } });
    expect(
      gateTest(
        spec({ requires: 'REORDER_METADATA_TOUCH' }),
        new FixtureBag(),
        new Set(['REORDER_METADATA_TOUCH']),
      ),
    ).toEqual({ run: true });
  });

  it('one failed fixture only NOT_RUNs its own dependents', () => {
    const bag = new FixtureBag();
    bag.set('mediaB', U(2));
    const dependent = QA_TESTS.filter((t) => t.fixtures.includes('newsMediaA'));
    const independent = QA_TESTS.filter((t) => t.fixtures.length === 0);
    for (const t of dependent)
      expect(
        gateTest(
          t,
          bag,
          new Set([
            'REORDER_METADATA_TOUCH',
            'SUPPORT_VIEWER_ACCOUNT',
            'CONTENT_EDITOR_ACCOUNT',
          ]),
        ),
      ).toMatchObject({ run: false });
    for (const t of independent)
      expect(gateTest(t, bag, new Set(['SUPPORT_VIEWER_ACCOUNT']))).toEqual({
        run: true,
      });
  });
});

describe('mutation firewall (decideMutation)', () => {
  const reg = new FixtureRegistry();
  reg.register('newsQa', 'news', U(1), 's');
  reg.register('bannerQa', 'banner', U(2), 's');
  reg.register('mediaQa', 'media', U(3), 'f');
  const REAL = U(99);
  const d = (
    method: string,
    path: string,
    body?: unknown,
    allowReorderMetadataTouch = false,
  ) =>
    decideMutation(run, reg, {
      method,
      path: `/api/v1${path}`,
      body,
      allowReorderMetadataTouch,
    });

  it('always allows reads', () => {
    expect(d('GET', `/admin/home/news-articles/${REAL}`).allow).toBe(true);
    expect(d('GET', '/admin/media?page=2&limit=50'.split('?')[0]).allow).toBe(
      true,
    );
  });

  it('allows update/delete only of registered QA rows', () => {
    expect(d('PUT', `/admin/home/news-articles/${U(1)}`, {}).allow).toBe(true);
    expect(d('DELETE', `/admin/home/service-banners/${U(2)}`).allow).toBe(true);
    expect(d('PUT', `/admin/home/news-articles/${REAL}`, {}).allow).toBe(false);
    expect(d('DELETE', `/admin/home/news-articles/${REAL}`).allow).toBe(false);
    // right id, wrong resource type
    expect(d('DELETE', `/admin/home/service-banners/${U(1)}`).allow).toBe(
      false,
    );
  });

  it('always blocks mutations of Hero rows (all real keys are occupied)', () => {
    expect(
      d('PUT', `/admin/home/hero-cards/${REAL}`, { title: 'x' }).allow,
    ).toBe(false);
    expect(d('POST', '/admin/home/hero-cards', { label: run.tag }).allow).toBe(
      true,
    ); // only a tagged create could ever pass
    expect(d('POST', '/admin/home/hero-cards', { label: 'real' }).allow).toBe(
      false,
    );
  });

  it('create must carry this run’s tag or slug prefix', () => {
    expect(
      d('POST', '/admin/home/news-articles', {
        kicker: run.tag,
        bodySlug: null,
      }).allow,
    ).toBe(true);
    expect(
      d('POST', '/admin/home/news-articles', {
        bodySlug: makeQaBodySlug(run, 'x'),
      }).allow,
    ).toBe(true);
    expect(
      d('POST', '/admin/home/news-articles', { kicker: 'no tag' }).allow,
    ).toBe(false);
    expect(d('POST', '/admin/home/news-articles', undefined).allow).toBe(false);
    // never create a QA row ACTIVE (would be public)
    expect(
      d('POST', '/admin/home/news-articles', { kicker: run.tag, active: true })
        .allow,
    ).toBe(false);
    expect(
      d('POST', '/admin/home/news-articles', { kicker: run.tag, active: false })
        .allow,
    ).toBe(true);
    expect(
      d('POST', '/admin/home/news-articles', {
        kicker: makeQaRun('1700000000000_aaaaaa').tag,
      }).allow,
    ).toBe(false);
  });

  it('media: upload allowed; delete only of a QA asset; nothing else', () => {
    expect(d('POST', '/admin/media/upload').allow).toBe(true);
    expect(d('DELETE', `/admin/media/${U(3)}`).allow).toBe(true);
    expect(d('DELETE', `/admin/media/${REAL}`).allow).toBe(false);
    expect(d('PUT', `/admin/media/${U(3)}`).allow).toBe(false);
  });

  it('reorder is blocked unless explicitly approved (the UI sends real rows too)', () => {
    expect(
      d('PATCH', '/admin/home/news-articles/reorder', { items: [] }).allow,
    ).toBe(false);
    expect(
      d('PATCH', '/admin/home/news-articles/reorder', { items: [] }, true)
        .allow,
    ).toBe(true);
    expect(
      d('PATCH', '/admin/home/unknown-resource/reorder', {}, true).allow,
    ).toBe(false);
  });

  it('every catalog / unknown mutating endpoint is blocked', () => {
    for (const path of [
      '/admin/card-products/x',
      '/admin/category-cards/x',
      '/admin/categories',
      '/admin/categories/x',
      '/admin/services/x',
      '/admin/audit-logs',
      '/orders',
    ]) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
        expect(d(method, path, { kicker: run.tag }, true).allow).toBe(false);
    }
  });

  it('admin auth calls are allowed', () => {
    expect(d('POST', '/admin/auth/login', {}).allow).toBe(true);
    expect(d('POST', '/admin/auth/refresh', {}).allow).toBe(true);
  });
});

describe('protected artwork checksums', () => {
  const rows = (md5: string): TableChecksum[] =>
    PROTECTED_TABLES.map((table, i) => ({
      table,
      count: i + 1,
      md5: `${md5}${i}`,
    }));

  it('passes only when all 5 tables are identical', () => {
    expect(compareChecksums(rows('aa'), rows('aa'))).toMatchObject({
      ok: true,
    });
    expect(PROTECTED_TABLES).toEqual([
      'card_products',
      'category_cards',
      'categories',
      'services',
      'services.gallery',
    ]);
  });

  it('names the changed table on a md5 or count mismatch', () => {
    const after = rows('aa');
    after[2] = { ...after[2], md5: 'changed' };
    const result = compareChecksums(rows('aa'), after);
    expect(result.ok).toBe(false);
    expect(result.diffs.filter((x) => !x.match).map((x) => x.table)).toEqual([
      'categories',
    ]);
    const countChanged = rows('aa');
    countChanged[0] = { ...countChanged[0], count: 99 };
    expect(compareChecksums(rows('aa'), countChanged).ok).toBe(false);
  });

  it('a missing table (either side) or a null md5 is a mismatch, not a pass', () => {
    expect(compareChecksums(rows('aa'), rows('aa').slice(0, 4)).ok).toBe(false);
    expect(compareChecksums(rows('aa').slice(1), rows('aa')).ok).toBe(false);
    const nulls = rows('aa').map((r) => ({ ...r, md5: null }));
    expect(compareChecksums(nulls, nulls).ok).toBe(false);
  });
});

describe('Home real-row baseline', () => {
  const row = (
    over: Partial<HomeRowSnapshot> & { id: string },
  ): HomeRowSnapshot => ({
    resource: 'news',
    active: true,
    sortOrder: 0,
    mediaAssetId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'admin-1',
    ...over,
  });
  const isQa = (r: HomeRowSnapshot) => r.id.startsWith('qa-');
  const base = [
    row({ id: 'r1', sortOrder: 0 }),
    row({ id: 'r2', sortOrder: 1, mediaAssetId: 'm1' }),
  ];

  it('identical real rows pass even though QA rows appeared and were removed', () => {
    expect(
      compareHomeBaseline([...base], [...base, row({ id: 'qa-1' })], isQa),
    ).toEqual({ ok: true, problems: [] });
  });

  it('detects changed order, active, sortOrder, media and category', () => {
    expect(compareHomeBaseline(base, [base[1], base[0]], isQa).ok).toBe(false);
    expect(
      compareHomeBaseline(base, [{ ...base[0], active: false }, base[1]], isQa)
        .problems[0],
    ).toContain('active changed');
    expect(
      compareHomeBaseline(base, [{ ...base[0], sortOrder: 5 }, base[1]], isQa)
        .ok,
    ).toBe(false);
    expect(
      compareHomeBaseline(
        base,
        [base[0], { ...base[1], mediaAssetId: 'm2' }],
        isQa,
      ).problems.join(),
    ).toContain('mediaAssetId');
    expect(
      compareHomeBaseline(
        base,
        [{ ...base[0], categoryId: 'c9' }, base[1]],
        isQa,
      ).ok,
    ).toBe(false);
  });

  it('detects a disappeared or new REAL row', () => {
    expect(compareHomeBaseline(base, [base[0]], isQa).ok).toBe(false);
    expect(
      compareHomeBaseline(
        base,
        [...base, row({ id: 'r3', sortOrder: 2 })],
        isQa,
      ).ok,
    ).toBe(false);
  });

  it('detects updatedAt/updatedBy changes (proof no real row was touched) unless a reorder was explicitly approved', () => {
    const touched = [
      { ...base[0], updatedAt: '2026-02-02T00:00:00.000Z' },
      base[1],
    ];
    expect(compareHomeBaseline(base, touched, isQa).problems[0]).toContain(
      'updatedAt changed',
    );
    expect(
      compareHomeBaseline(base, touched, isQa, { ignoreUpdateMetadata: true })
        .ok,
    ).toBe(true);
    // ...but identity/order/media are still enforced when metadata is ignored
    expect(
      compareHomeBaseline(
        base,
        [{ ...touched[0], mediaAssetId: 'x' }, base[1]],
        isQa,
        { ignoreUpdateMetadata: true },
      ).ok,
    ).toBe(false);
  });

  it('public counts', () => {
    expect(
      publicCountsEqual(
        { hero: 3, banners: 5, mosaic: 4, news: 8 },
        { hero: 3, banners: 5, mosaic: 4, news: 8 },
      ),
    ).toBe(true);
    expect(
      publicCountsEqual(
        { hero: 3, banners: 5, mosaic: 4, news: 8 },
        { hero: 3, banners: 5, mosaic: 4, news: 9 },
      ),
    ).toBe(false);
  });
});

describe('test matrix integrity', () => {
  it('has unique ids and only references catalogued fixtures', () => {
    const ids = QA_TESTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const catalog = new Set(FIXTURE_CATALOG.map((f) => f.name));
    expect(catalog.size).toBe(FIXTURE_CATALOG.length);
    for (const t of QA_TESTS)
      for (const name of t.fixtures) expect(catalog.has(name)).toBe(true);
  });

  it('every catalogued fixture is used by at least one test', () => {
    const used = new Set(QA_TESTS.flatMap((t) => t.fixtures));
    for (const f of FIXTURE_CATALOG) expect(used.has(f.name)).toBe(true);
  });

  it('every row fixture is created inactive (QA rows are never public by default)', () => {
    for (const f of FIXTURE_CATALOG.filter((x) => x.type !== 'media'))
      expect(f.inactive).toBe(true);
  });

  it('covers every mandatory area of the task (soft-deleted media, media library, validation, errors, reorder, RBAC)', () => {
    const areas = new Set(QA_TESTS.map((t) => t.area));
    for (const a of [
      'hero',
      'banner',
      'mosaic',
      'news',
      'media',
      'errors',
      'reorder',
      'rbac',
    ])
      expect(areas.has(a as never)).toBe(true);
    expect(QA_TESTS.filter((t) => t.id.startsWith('SDM-'))).toHaveLength(5);
    expect(
      QA_TESTS.filter((t) => t.role === 'SUPPORT_VIEWER').every(
        (t) => t.requires === 'SUPPORT_VIEWER_ACCOUNT',
      ),
    ).toBe(true);
  });

  it('no Hero test ever mutates a real row: hero tests are observation, payload-capture or stubbed only', () => {
    for (const t of QA_TESTS.filter((x) => x.area === 'hero'))
      expect(['O', 'P', 'S']).toContain(t.klass);
  });
});

describe('finalVerdict', () => {
  const allPass = QA_TESTS.map((t) => ({
    id: t.id,
    status: 'PASS' as const,
    detail: '',
  }));
  const green: VerdictInput = {
    outcomes: allPass,
    cleanupFailures: 0,
    remainingFixtures: 0,
    checksumsOk: true,
    homeBaselineOk: true,
    publicCountsOk: true,
    firewallViolations: 0,
  };

  it('exits 0 only when everything is green', () => {
    expect(finalVerdict(green)).toEqual({
      status: 'PASS',
      exitCode: 0,
      reasons: [],
    });
  });

  it.each([
    [
      'a FAIL',
      {
        outcomes: allPass.map((o, i) =>
          i === 3 ? { ...o, status: 'FAIL' as const } : o,
        ),
      },
    ],
    [
      'a NOT_RUN required test',
      {
        outcomes: allPass.map((o, i) =>
          i === 3 ? { ...o, status: 'NOT_RUN' as const } : o,
        ),
      },
    ],
    [
      'a BLOCKED required test',
      {
        outcomes: allPass.map((o, i) =>
          i === 3 ? { ...o, status: 'BLOCKED' as const } : o,
        ),
      },
    ],
    ['a missing outcome', { outcomes: allPass.slice(1) }],
    ['a cleanup failure', { cleanupFailures: 1 }],
    ['remaining fixtures', { remainingFixtures: 2 }],
    ['a checksum mismatch', { checksumsOk: false }],
    ['a Home baseline mismatch', { homeBaselineOk: false }],
    ['public counts not restored', { publicCountsOk: false }],
    ['a blocked mutation attempt', { firewallViolations: 1 }],
  ] as Array<[string, Partial<VerdictInput>]>)(
    'exits non-zero on %s',
    (_label, patch) => {
      const verdict = finalVerdict({ ...green, ...patch });
      expect(verdict.exitCode).toBe(1);
      expect(verdict.status).toBe('FAIL');
      expect(verdict.reasons.length).toBeGreaterThan(0);
    },
  );
});
