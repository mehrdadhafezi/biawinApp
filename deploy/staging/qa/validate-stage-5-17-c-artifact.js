#!/usr/bin/env node
/**
 * Stage 5.17-G — refuses to accept an artifact that does not belong to the workflow run that is about
 * to upload it.
 *
 *   node validate-stage-5-17-c-artifact.js <artifactDir> --workflow-sha <sha> --workflow-run-id <id>
 *
 * Exit 0 = every file provably belongs to THIS execution; exit 1 = at least one reason printed as JSON.
 *
 * Plain CommonJS with no dependencies on purpose: the GitHub runner executes it directly with its own
 * Node, and backend/src/qa-contract/stage-5-17-g-artifact-isolation.spec.ts requires the very same file,
 * so the code that is tested is the code that runs in CI.
 *
 * Nothing here repairs, rewrites or regenerates anything. A mismatch is a failure, never a fix-up.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** The ONLY top-level entries an artifact may contain. Anything else is a leftover and fails validation. */
const ALLOWED = new Set([
  'artifact-manifest.json',
  'run-manifest.json',
  'setup-result.json',
  'stage-5-17-c-report.json',
  'stage-5-17-c-report.txt',
  'stage-5.17-c-before.txt',
  'stage-5.17-c-after.txt',
  'remaining-fixtures.json',
  'cleanup.json',
  'firewall-events.json',
  'browser-results.json',
  'wrapper-provenance.json',
  'provenance.json',
  'screenshots',
]);

const REQUIRED = [
  'artifact-manifest.json',
  'run-manifest.json',
  'setup-result.json',
  'stage-5-17-c-report.json',
  'stage-5-17-c-report.txt',
  'wrapper-provenance.json',
];

/** Mirrors `screenshotName()` in qa-orchestration.ts: runId `1790…_8d0d31` -> `1790…-8d0d31`. */
function screenshotPrefix(runId) {
  const safe = String(runId).replace(/[^A-Za-z0-9-]/g, '-').replace(/-{2,}/g, '-');
  return `stage517c-${safe}-`;
}

function readJson(dir, name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  } catch {
    return null;
  }
}

function validateArtifact(dir, expected) {
  const reasons = [];
  const fail = (msg) => reasons.push(msg);

  if (!expected || !expected.workflowSha) fail('no expected workflow SHA was supplied to the validator');
  if (!expected || !expected.workflowRunId) fail('no expected workflow run id was supplied to the validator');
  if (reasons.length > 0) return { ok: false, reasons, runId: null };

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { ok: false, reasons: [`artifact directory ${dir} does not exist — nothing from this execution was produced or fetched`], runId: null };
  }

  // ---- 1. exactly the files this pipeline produces, nothing else ---------------------------------
  const entries = fs.readdirSync(dir);
  for (const e of entries) if (!ALLOWED.has(e)) fail(`unexpected file in artifact: ${e} (not produced by this pipeline — a leftover?)`);
  for (const r of REQUIRED) if (!entries.includes(r)) fail(`required file missing: ${r}`);

  const manifest = readJson(dir, 'artifact-manifest.json');
  const runManifest = readJson(dir, 'run-manifest.json');
  const setup = readJson(dir, 'setup-result.json');
  const report = readJson(dir, 'stage-5-17-c-report.json');
  const wrapperProv = readJson(dir, 'wrapper-provenance.json');
  const verifierProv = readJson(dir, 'provenance.json');
  const browserPresent = entries.includes('browser-results.json');
  const browser = browserPresent ? readJson(dir, 'browser-results.json') : null;

  // ---- 2. the manifest must name THIS workflow execution ------------------------------------------
  let runId = null;
  if (manifest) {
    runId = manifest.runId || null;
    if (manifest.workflowRunId !== expected.workflowRunId) fail(`artifact-manifest workflowRunId is "${manifest.workflowRunId}", expected "${expected.workflowRunId}"`);
    if (manifest.workflowSha !== expected.workflowSha) fail(`artifact-manifest workflowSha is "${manifest.workflowSha}", expected "${expected.workflowSha}"`);
    if (manifest.serverSha !== expected.workflowSha) fail(`artifact-manifest serverSha is "${manifest.serverSha}", expected the workflow SHA "${expected.workflowSha}"`);
    if (!runId) fail('artifact-manifest carries no runtime runId (setup never generated one)');
    if (browserPresent && manifest.verifierCommitSha !== expected.workflowSha) fail(`verifier commit SHA is "${manifest.verifierCommitSha}", expected "${expected.workflowSha}"`);
  } else if (entries.includes('artifact-manifest.json')) fail('artifact-manifest.json is not valid JSON');

  if (runManifest) {
    if (runManifest.workflowRunId !== expected.workflowRunId) fail(`run-manifest workflowRunId is "${runManifest.workflowRunId}", expected "${expected.workflowRunId}"`);
    if (runManifest.workflowSha !== expected.workflowSha) fail(`run-manifest workflowSha is "${runManifest.workflowSha}", expected "${expected.workflowSha}"`);
    if (runManifest.serverSha !== expected.workflowSha) fail(`run-manifest serverSha is "${runManifest.serverSha}", expected "${expected.workflowSha}"`);
    if (manifest && manifest.startedAt !== runManifest.startedAt) fail('run-manifest and artifact-manifest disagree on startedAt');
  } else if (entries.includes('run-manifest.json')) fail('run-manifest.json is not valid JSON');

  // ---- 3. every per-run file carries the SAME runtime runId ------------------------------------
  if (runId) {
    if (!setup) fail('setup-result.json is missing or not valid JSON');
    else if (setup.runId !== runId) fail(`setup-result.json belongs to run "${setup.runId}", not "${runId}"`);

    if (!report) fail('stage-5-17-c-report.json is missing or not valid JSON');
    else {
      if (report.runId !== runId) fail(`stage-5-17-c-report.json belongs to run "${report.runId}", not "${runId}"`);
      if (report.commitSha !== expected.workflowSha) fail(`report commitSha is "${report.commitSha}", expected the workflow SHA "${expected.workflowSha}"`);
      // Identity of the provenance chain must be THIS workflow's. (Whether the chain was internally OK is a
      // property of the run and is already part of its verdict — a failed run still has a valid artifact.)
      const chain = report.provenance && report.provenance.chain;
      if (!chain) fail("the report carries no provenance chain");
      else {
        if (chain.workflowSha !== expected.workflowSha) fail(`report provenance chain workflowSha is "${chain.workflowSha}", expected "${expected.workflowSha}"`);
        if (chain.serverSha !== expected.workflowSha) fail(`report provenance chain serverSha is "${chain.serverSha}", expected "${expected.workflowSha}"`);
        if (chain.reportedSha !== expected.workflowSha) fail(`report provenance chain reportedSha is "${chain.reportedSha}", expected "${expected.workflowSha}"`);
        if (browserPresent && chain.verifierSha !== expected.workflowSha) fail(`report provenance chain verifierSha is "${chain.verifierSha}", expected "${expected.workflowSha}"`);
      }
      if (report.runIsolation && report.runIsolation.ok !== true) fail(`the report's own run-isolation check failed: ${JSON.stringify(report.runIsolation.reasons)}`);
    }

    if (browserPresent) {
      if (!browser) fail('browser-results.json is not valid JSON');
      else if (browser.runId !== runId) fail(`browser-results.json belongs to run "${browser.runId}", not "${runId}"`);
    } else if (setup && setup.status === 'READY') fail('setup reported READY but browser-results.json is missing');

    const txt = (() => {
      try {
        return fs.readFileSync(path.join(dir, 'stage-5-17-c-report.txt'), 'utf8');
      } catch {
        return '';
      }
    })();
    const head = txt.split('\n').slice(0, 6).join('\n');
    if (!head.includes(`Run: ${runId} `)) fail(`stage-5-17-c-report.txt does not start with this run ("Run: ${runId}")`);
    if (!head.includes(`commit: ${expected.workflowSha}`)) fail(`stage-5-17-c-report.txt does not name the workflow SHA ${expected.workflowSha}`);

    // ---- 4. screenshots ----------------------------------------------------------------------
    const shotsDir = path.join(dir, 'screenshots');
    if (fs.existsSync(shotsDir)) {
      const prefix = screenshotPrefix(runId);
      for (const f of fs.readdirSync(shotsDir)) {
        if (!f.startsWith(prefix) || !f.endsWith('.png')) fail(`screenshot ${f} does not belong to run ${runId} (expected prefix ${prefix})`);
      }
    }

    // ---- 5. freshness: this execution started AFTER the wrapper for this workflow run began ----
    if (runManifest && setup && setup.startedAt) {
      const runStart = Date.parse(runManifest.startedAt);
      const setupStart = Date.parse(setup.startedAt);
      if (Number.isNaN(runStart) || Number.isNaN(setupStart)) fail('run-manifest/setup-result startedAt is not a valid timestamp');
      else if (setupStart < runStart) fail(`setup-result startedAt (${setup.startedAt}) is BEFORE this wrapper execution started (${runManifest.startedAt}) — the file predates this run`);
    }
  }

  // ---- 6. provenance files agree with the workflow ----------------------------------------------
  if (wrapperProv) {
    if (wrapperProv.commitSha !== expected.workflowSha) fail(`wrapper-provenance commitSha is "${wrapperProv.commitSha}", expected "${expected.workflowSha}"`);
    if (wrapperProv.workflowSha !== expected.workflowSha) fail(`wrapper-provenance workflowSha is "${wrapperProv.workflowSha}", expected "${expected.workflowSha}"`);
  } else if (entries.includes('wrapper-provenance.json')) fail('wrapper-provenance.json is not valid JSON');
  if (browserPresent) {
    if (!verifierProv) fail('provenance.json (from the verifier container) is missing though the browser ran');
    else if (verifierProv.commitSha !== expected.workflowSha) fail(`verifier provenance commitSha is "${verifierProv.commitSha}", expected "${expected.workflowSha}"`);
  }

  return { ok: reasons.length === 0, reasons, runId };
}

function parseArgs(argv) {
  const out = { dir: null, workflowSha: '', workflowRunId: '' };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--workflow-sha') out.workflowSha = rest[++i] || '';
    else if (rest[i] === '--workflow-run-id') out.workflowRunId = rest[++i] || '';
    else if (!out.dir) out.dir = rest[i];
  }
  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  if (!args.dir) {
    console.error('usage: validate-stage-5-17-c-artifact.js <artifactDir> --workflow-sha <sha> --workflow-run-id <id>');
    process.exit(2);
  }
  const result = validateArtifact(args.dir, { workflowSha: args.workflowSha, workflowRunId: args.workflowRunId });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

module.exports = { validateArtifact, screenshotPrefix, ALLOWED, REQUIRED };
