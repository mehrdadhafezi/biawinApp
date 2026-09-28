import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRunIdConsistency } from '../../scripts/staging-qa/stage-5-17-c/qa-orchestration';
import { screenshotName } from '../../scripts/staging-qa/stage-5-17-c/qa-orchestration';

/**
 * Stage 5.17-G — the artifact validator the workflow runs before upload. This spec requires the very
 * same plain-JS file CI executes (deploy/staging/qa/validate-stage-5-17-c-artifact.js).
 */
interface ValidationResult {
  ok: boolean;
  reasons: string[];
  runId: string | null;
}
interface Validator {
  validateArtifact: (
    dir: string,
    expected: { workflowSha: string; workflowRunId: string },
  ) => ValidationResult;
  screenshotPrefix: (runId: string) => string;
}

const validator =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../../deploy/staging/qa/validate-stage-5-17-c-artifact.js') as Validator;

const SHA = '458763f7d2e0000000000000000000000000abcd';
const OLD_SHA = '3422452117d4dff4bf7eeacd569602a08182bddc';
const WF_RUN = '555-1';
const RUN_ID = '1790999999999_aabbcc';
const OLD_RUN_ID = '1790434515250_8d0d31';
const STARTED = '2026-09-28T10:00:00Z';
const SETUP_STARTED = '2026-09-28T10:00:05.123Z';
const OLD_STARTED = '2026-09-26T14:55:15.250Z';

const expected = { workflowSha: SHA, workflowRunId: WF_RUN };

function put(dir: string, name: string, value: unknown): void {
  writeFileSync(
    join(dir, name),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
}

interface Overrides {
  sha?: string;
  runId?: string;
  workflowRunId?: string;
  startedAt?: string;
}

/** Builds an artifact exactly as the pipeline would for one execution. */
function buildArtifact(dir: string, o: Overrides = {}): void {
  const sha = o.sha ?? SHA;
  const runId = o.runId ?? RUN_ID;
  const wfRun = o.workflowRunId ?? WF_RUN;
  const startedAt = o.startedAt ?? SETUP_STARTED;
  mkdirSync(join(dir, 'screenshots'), { recursive: true });
  put(dir, 'artifact-manifest.json', {
    workflowSha: sha,
    workflowRunId: wfRun,
    serverSha: sha,
    verifierCommitSha: sha,
    runId,
    runToken: wfRun,
    startedAt: STARTED,
    finalizedAt: '2026-09-28T10:05:00Z',
    finalExit: 1,
  });
  put(dir, 'run-manifest.json', {
    workflowSha: sha,
    workflowRunId: wfRun,
    serverSha: sha,
    runToken: wfRun,
    startedAt: STARTED,
    runDir: `/tmp/stage-5-17-c/run-${wfRun}`,
  });
  put(dir, 'setup-result.json', { status: 'READY', runId, startedAt });
  put(dir, 'browser-results.json', { runId, outcomes: [] });
  put(dir, 'stage-5-17-c-report.json', {
    runId,
    commitSha: sha,
    provenance: {
      ok: true,
      reasons: [],
      chain: {
        workflowSha: sha,
        serverSha: sha,
        verifierSha: sha,
        reportedSha: sha,
      },
    },
    runIsolation: { ok: true, reasons: [] },
  });
  put(
    dir,
    'stage-5-17-c-report.txt',
    `Stage 5.17-C Home Admin Browser QA — x\nRun: ${runId} | tag: stage517c_qa_${runId} | commit: ${sha}\n`,
  );
  put(dir, 'wrapper-provenance.json', { commitSha: sha, workflowSha: sha });
  put(dir, 'provenance.json', { commitSha: sha, workflowSha: sha });
  put(dir, join('screenshots', screenshotName(runId, 'NAV-01')), 'png');
  put(dir, join('screenshots', screenshotName(runId, 'MED-01')), 'png');
}

describe('Stage 5.17-G artifact validator (run isolation)', () => {
  let root: string;
  let dir: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'stage517g-'));
    dir = join(root, 'artifact');
    mkdirSync(dir);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS: an artifact that belongs entirely to this execution', () => {
    buildArtifact(dir);
    const r = validator.validateArtifact(dir, expected);
    expect(r.reasons).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.runId).toBe(RUN_ID);
  });

  it('screenshot prefix matches the runtime helper that names the screenshots', () => {
    expect(
      screenshotName(RUN_ID, 'X-01').startsWith(
        validator.screenshotPrefix(RUN_ID),
      ),
    ).toBe(true);
  });

  it('FAIL: the exact stale artifact of run #1 (old run id, old commit, old timestamps) is rejected', () => {
    buildArtifact(dir, {
      sha: OLD_SHA,
      runId: OLD_RUN_ID,
      workflowRunId: '1-1',
      startedAt: OLD_STARTED,
    });
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    const all = r.reasons.join('\n');
    expect(all).toContain('workflowRunId');
    expect(all).toContain('workflowSha');
    expect(all).toContain('commitSha');
  });

  it('FAIL: a stale artifact with NO manifest at all (what the pre-fix pipeline uploaded)', () => {
    buildArtifact(dir);
    rmSync(join(dir, 'artifact-manifest.json'));
    rmSync(join(dir, 'run-manifest.json'));
    rmSync(join(dir, 'wrapper-provenance.json'));
    rmSync(join(dir, 'provenance.json'));
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes('artifact-manifest.json'))).toBe(
      true,
    );
    expect(r.reasons.some((x) => x.includes('wrapper-provenance.json'))).toBe(
      true,
    );
  });

  it('FAIL: a report whose commit is not the workflow SHA', () => {
    buildArtifact(dir);
    put(dir, 'stage-5-17-c-report.json', {
      runId: RUN_ID,
      commitSha: OLD_SHA,
      provenance: {
        chain: {
          workflowSha: SHA,
          serverSha: SHA,
          verifierSha: SHA,
          reportedSha: OLD_SHA,
        },
      },
    });
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes('report commitSha'))).toBe(true);
    expect(r.reasons.some((x) => x.includes('reportedSha'))).toBe(true);
  });

  it('FAIL: report / setup-result / browser-results from a DIFFERENT runId', () => {
    buildArtifact(dir);
    put(dir, 'setup-result.json', {
      status: 'READY',
      runId: OLD_RUN_ID,
      startedAt: SETUP_STARTED,
    });
    put(dir, 'browser-results.json', { runId: OLD_RUN_ID, outcomes: [] });
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(
      r.reasons.some((x) => x.includes('setup-result.json belongs to run')),
    ).toBe(true);
    expect(
      r.reasons.some((x) => x.includes('browser-results.json belongs to run')),
    ).toBe(true);
  });

  it('FAIL: a browser-results.json with no runId (old format) cannot pass as current', () => {
    buildArtifact(dir);
    put(dir, 'browser-results.json', { outcomes: [] });
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(
      r.reasons.some((x) => x.includes('browser-results.json belongs to run')),
    ).toBe(true);
  });

  it('FAIL: a screenshot from another run', () => {
    buildArtifact(dir);
    put(dir, join('screenshots', screenshotName(OLD_RUN_ID, 'NAV-01')), 'png');
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes('does not belong to run'))).toBe(
      true,
    );
  });

  it('FAIL: any file this pipeline does not produce (a leftover)', () => {
    buildArtifact(dir);
    put(dir, 'stage-5-17-c-report-OLD.txt', 'old');
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes('unexpected file'))).toBe(true);
  });

  it('FAIL: setup-result older than this wrapper execution (the file predates the run)', () => {
    buildArtifact(dir, { startedAt: OLD_STARTED });
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes('predates this run'))).toBe(true);
  });

  it('FAIL: report text of another run', () => {
    buildArtifact(dir);
    put(
      dir,
      'stage-5-17-c-report.txt',
      `x\nRun: ${OLD_RUN_ID} | tag: t | commit: ${OLD_SHA}\n`,
    );
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes('stage-5-17-c-report.txt'))).toBe(
      true,
    );
  });

  it('FAIL: verifier provenance of another commit', () => {
    buildArtifact(dir);
    put(dir, 'provenance.json', { commitSha: OLD_SHA });
    const r = validator.validateArtifact(dir, expected);
    expect(r.ok).toBe(false);
    expect(
      r.reasons.some((x) => x.includes('verifier provenance commitSha')),
    ).toBe(true);
  });

  it('FAIL: a missing directory or missing expectations are reported, never treated as fine', () => {
    expect(validator.validateArtifact(join(root, 'nope'), expected).ok).toBe(
      false,
    );
    expect(
      validator.validateArtifact(dir, {
        workflowSha: '',
        workflowRunId: WF_RUN,
      }).ok,
    ).toBe(false);
    expect(
      validator.validateArtifact(dir, { workflowSha: SHA, workflowRunId: '' })
        .ok,
    ).toBe(false);
  });

  it('PASS: a failed run is still a VALID artifact (a bad verdict is not contamination)', () => {
    buildArtifact(dir);
    put(dir, 'stage-5-17-c-report.json', {
      runId: RUN_ID,
      commitSha: SHA,
      verdict: { status: 'FAIL' },
      provenance: {
        ok: false,
        reasons: ['x'],
        chain: {
          workflowSha: SHA,
          serverSha: SHA,
          verifierSha: SHA,
          reportedSha: SHA,
        },
      },
    });
    expect(validator.validateArtifact(dir, expected).ok).toBe(true);
  });
});

describe('Stage 5.17-G checkRunIdConsistency (control.js verify)', () => {
  it('PASS when every present file carries the current run id; absent optional files are fine', () => {
    const r = checkRunIdConsistency('R1', [
      { file: 'setup-result.json', runId: 'R1' },
      { file: 'browser-results.json', runId: undefined, optional: true },
      { file: 'manifest.json', runId: 'R1', optional: true },
    ]);
    expect(r).toEqual({ ok: true, reasons: [] });
  });

  it('FAIL when a file belongs to another run (stale)', () => {
    const r = checkRunIdConsistency('R2', [
      { file: 'browser-results.json', runId: 'R1' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toContain('stale file from a previous execution');
  });

  it('FAIL when a PRESENT file carries no runId (null), even if optional — only an ABSENT file may be skipped', () => {
    const r = checkRunIdConsistency('R2', [
      { file: 'browser-results.json', runId: null, optional: true },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toContain('carries no runId');
  });

  it('FAIL when this execution has no runtime run id', () => {
    expect(checkRunIdConsistency(null, [{ file: 'a', runId: 'R1' }]).ok).toBe(
      false,
    );
  });
});
