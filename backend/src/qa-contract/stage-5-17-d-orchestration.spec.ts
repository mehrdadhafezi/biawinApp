import {
  QA_TESTS,
  makeQaRun,
  makeQaBodySlug,
} from '../../scripts/staging-qa/stage-5-17-c/qa-contract';
import {
  analyzeReorderPayload,
  assertValidBodySlug,
  countFirewallViolations,
  deriveCapabilities,
  envFlag,
  heroReport,
  mergeOutcomes,
  redact,
  requiredTestIds,
  screenshotName,
  tally,
  templatePath,
} from '../../scripts/staging-qa/stage-5-17-c/qa-orchestration';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

describe('Stage 5.17-D orchestration helpers', () => {
  describe('envFlag', () => {
    it('is true only for the literal string "true"', () => {
      expect(envFlag('true')).toBe(true);
      for (const v of [undefined, '', 'false', '1', 'yes', 'TRUE', ' true'])
        expect(envFlag(v)).toBe(false);
    });
  });

  describe('deriveCapabilities', () => {
    it('grants nothing by default', () => {
      expect(
        deriveCapabilities({
          allowReorderMetadataTouch: false,
          availableRoles: [],
        }).size,
      ).toBe(0);
    });
    it('grants reorder touch only with the flag, and role capabilities only for provisioned roles', () => {
      const caps = deriveCapabilities({
        allowReorderMetadataTouch: true,
        availableRoles: ['SUPPORT_VIEWER'],
      });
      expect(caps.has('REORDER_METADATA_TOUCH')).toBe(true);
      expect(caps.has('SUPPORT_VIEWER_ACCOUNT')).toBe(true);
      expect(caps.has('CONTENT_EDITOR_ACCOUNT')).toBe(false);
    });
  });

  describe('assertValidBodySlug', () => {
    it('accepts helper-generated slugs', () => {
      const run = makeQaRun('1790152949527_abc123');
      expect(() =>
        assertValidBodySlug(makeQaBodySlug(run, 'newsMediaA'.toLowerCase())),
      ).not.toThrow();
    });
    it('rejects underscores, uppercase, empties and non-strings', () => {
      for (const bad of [
        'stage517c_qa_x',
        'Abc',
        '',
        'a--b',
        '-a',
        undefined,
        5,
      ])
        expect(() => assertValidBodySlug(bad)).toThrow();
    });
  });

  describe('redact', () => {
    it('removes JWTs, bearer tokens, db urls and listed secrets', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9abcdefgh.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';
      const out = redact(
        `t=${jwt} Authorization: Bearer abc.def-ghi postgresql://u:p@h/db pw=Sup3rSecret!`,
        ['Sup3rSecret!'],
      );
      expect(out).not.toContain(jwt);
      expect(out).not.toContain('abc.def-ghi');
      expect(out).not.toContain('u:p@h');
      expect(out).not.toContain('Sup3rSecret!');
    });
    it('ignores empty/short secrets rather than mangling text', () => {
      expect(redact('hello', ['', undefined, 'ab'])).toBe('hello');
    });
  });

  it('screenshotName carries stage517c, run id and test id and stays portable', () => {
    const n = screenshotName('1790152949527_abc123', 'NEWS-01', 'after save');
    expect(n).toBe('stage517c-1790152949527-abc123-NEWS-01-after-save.png');
    expect(n).toMatch(/^stage517c-.*NEWS-01.*\.png$/);
  });

  describe('firewall helpers', () => {
    it('counts only blocked events', () => {
      expect(
        countFirewallViolations([
          {
            testId: 'A',
            method: 'GET',
            path: '/x',
            allowed: true,
            reason: 'ok',
          },
          {
            testId: 'A',
            method: 'PUT',
            path: '/y',
            allowed: false,
            reason: 'blocked',
          },
        ]),
      ).toBe(1);
    });
    it('templatePath collapses ids and drops the query string', () => {
      expect(templatePath(`/api/v1/admin/home/news-articles/${U1}?x=1`)).toBe(
        '/admin/home/news-articles/:id',
      );
    });
  });

  describe('analyzeReorderPayload', () => {
    it('accepts a canonical payload', () => {
      const body = {
        items: [
          { id: U1, sortOrder: 0 },
          { id: U2, sortOrder: 1 },
        ],
      };
      expect(analyzeReorderPayload(body, [U1, U2])).toEqual([]);
    });
    it('flags duplicates, non-canonical positions, unknown ids and bad shapes', () => {
      expect(
        analyzeReorderPayload(
          {
            items: [
              { id: U1, sortOrder: 0 },
              { id: U1, sortOrder: 0 },
            ],
          },
          [U1],
        ).length,
      ).toBeGreaterThan(0);
      expect(
        analyzeReorderPayload(
          {
            items: [
              { id: U1, sortOrder: 0 },
              { id: U2, sortOrder: 5 },
            ],
          },
          [U1, U2],
        ),
      ).toContain('positions are not the canonical 0..n-1');
      expect(
        analyzeReorderPayload({ items: [{ id: U2, sortOrder: 0 }] }, [U1]),
      ).toContain('item 0: id is not in the displayed list');
      expect(analyzeReorderPayload({ items: [] }, [])).toContain(
        'items is empty',
      );
      expect(analyzeReorderPayload(null, [])).toEqual([
        'body.items is not an array',
      ]);
      expect(
        analyzeReorderPayload({ items: [{ id: 'x', sortOrder: -1 }] }, [])
          .length,
      ).toBe(2);
    });
  });

  describe('mergeOutcomes', () => {
    it('always returns exactly one outcome per matrix test', () => {
      const merged = mergeOutcomes(
        QA_TESTS,
        [{ id: 'NAV-01', status: 'PASS', detail: 'ok' }],
        null,
      );
      expect(merged.map((o) => o.id)).toEqual(requiredTestIds());
      expect(merged.find((o) => o.id === 'NAV-01')?.status).toBe('PASS');
    });
    it('turns missing outcomes into NOT_RUN, or BLOCKED when setup was blocked', () => {
      expect(
        mergeOutcomes(QA_TESTS, [], null).every((o) => o.status === 'NOT_RUN'),
      ).toBe(true);
      const blocked = mergeOutcomes(QA_TESTS, [], 'no credentials');
      expect(blocked.every((o) => o.status === 'BLOCKED')).toBe(true);
      expect(blocked[0].detail).toContain('no credentials');
    });
    it('ignores browser outcomes for unknown test ids', () => {
      const merged = mergeOutcomes(
        QA_TESTS,
        [{ id: 'BOGUS-99', status: 'PASS', detail: '' }],
        null,
      );
      expect(merged).toHaveLength(QA_TESTS.length);
    });
  });

  it('tally counts every status', () => {
    const t = tally([
      { id: 'a', status: 'PASS', detail: '' },
      { id: 'b', status: 'FAIL', detail: '' },
      { id: 'c', status: 'NOT_RUN', detail: '' },
      { id: 'd', status: 'BLOCKED', detail: '' },
      { id: 'e', status: 'PASS', detail: '' },
    ]);
    expect(t).toEqual({ PASS: 2, FAIL: 1, NOT_RUN: 1, BLOCKED: 1 });
  });

  it('heroReport lists only Hero tests with an explicit mode', () => {
    const merged = mergeOutcomes(QA_TESTS, [], null);
    const report = heroReport(merged);
    expect(report.map((r) => r.id)).toEqual(['HERO-01', 'HERO-02', 'HERO-03']);
    expect(report.every((r) => r.mode.length > 0)).toBe(true);
  });
});
