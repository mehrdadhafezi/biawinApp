#!/usr/bin/env bash
# Stage 5.17-D — Home Admin Browser QA (executable form of the Stage 5.17-C plan).
#
#   ./deploy/staging/run-stage-5-17-c-browser-qa.sh
#
# Run ONLY on the staging server, from /srv/biawin-staging (needs the real, never-
# committed deploy/staging/.env.staging). Normally started by the manual-only GitHub
# workflow .github/workflows/stage-5-17-c-home-admin-browser-qa.yml.
#
# Lifecycle (teardown + verification ALWAYS run, from an EXIT/INT/TERM trap, whatever
# happened earlier):
#   setup  (backend image)   BEFORE checksums + Home baseline, QA fixtures, optional temp roles
#   browser (Playwright img) the 46-test matrix behind the mutation firewall
#   teardown (backend image) reverse-order cleanup: rows -> media -> storage -> temp admins
#   verify (backend image)   leftover check, AFTER checksums/baseline, verdict + sanitized report
#
# Deliberately does NOT deploy, rebuild-and-restart, or touch the running backend/web/admin
# containers; does NOT invoke authenticated-qa-runner.ts or run-authenticated-qa.sh.
#
# Optional environment (literal `true` enables; anything else is off):
#   STAGE517C_ALLOW_REORDER_METADATA_TOUCH  let the UI reorder send the WHOLE list (touches real
#                                            rows' updatedAt/updatedBy — restored ids/order/active/media
#                                            are still verified). Off => REO-02 is BLOCKED.
#   STAGE517C_PROVISION_ROLES                create temporary SUPPORT_VIEWER + CONTENT_EDITOR admins
#                                            (deleted at teardown; audit rows remain). Off => RBAC-01..04 BLOCKED.
#
# Secrets: ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD reach the backend containers via the normal
# compose env_file and the browser container via a 0600 --env-file (never a CLI argument, never
# echoed, deleted on exit). Every report is redacted before it is written.
#
# Commit provenance (Stage 5.17-F): STAGE517C_WORKFLOW_SHA, when the caller (the GitHub workflow)
# sets it, is the commit the workflow dispatched against (`github.sha`). This script refuses to
# run — before touching anything — if the server checkout is not at that exact commit. It also
# hashes the 3 source files it is about to ship into the verifier image and writes that alongside
# the commit into wrapper-provenance.json; the verifier independently re-hashes its own copies of
# those files at startup (provenance.json) and refuses to run if they disagree. `control.js verify`
# cross-checks both files and prints all of workflow/server/verifier/reported SHA in the report.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
BROWSER_DIR="$REPO_DIR/deploy/staging/qa/browser"

# shellcheck source=lib/stage-5-17-c-run-dir.sh
. "$REPO_DIR/deploy/staging/lib/stage-5-17-c-run-dir.sh"

# Stage 5.17-G — EVERY execution gets its own, freshly created directory (never a shared, reused one).
# The token is the GitHub run id + attempt when dispatched by the workflow (which fetches exactly that
# path), otherwise a unique manual token. RUN_DIR stays empty until it has really been created, so
# `finalize` can never stage an artifact out of — or write inside — a directory this run does not own.
REPORT_BASE="${STAGE517C_REPORT_BASE:-/tmp/stage-5-17-c}"
WORKFLOW_RUN_ID="${STAGE517C_WORKFLOW_RUN_ID:-}"
RUN_TOKEN="$(default_run_token "$WORKFLOW_RUN_ID")"
RUN_DIR=""
ARTIFACT_DIR=""
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ALLOW_REORDER="${STAGE517C_ALLOW_REORDER_METADATA_TOUCH:-false}"
PROVISION_ROLES="${STAGE517C_PROVISION_ROLES:-false}"
ADMIN_ORIGIN="${STAGE517C_ADMIN_ORIGIN:-https://admin-staging.biawin.ir}"
PUBLIC_API_ORIGIN="${STAGE517C_PUBLIC_API_ORIGIN:-https://api-staging.biawin.ir}"
INTERNAL_API_ORIGIN="${STAGE517C_API_ORIGIN:-http://backend:4000}"

log() { echo "[stage-5.17-c] $*"; }
die() { echo "[stage-5.17-c][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found — this must be run on the staging server, from the repo checkout that has the real secrets file."

COMMIT_SHA="$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
WORKFLOW_SHA="${STAGE517C_WORKFLOW_SHA:-}"
TMP_CONTEXT=""
TMP_ENVFILE=""
SETUP_STARTED=0
FINALIZED=0
FINAL_EXIT=1

# Fail closed BEFORE any staging resource is touched: if the caller told us which commit the
# workflow dispatched against and the server checkout disagrees, this run's evidence would be
# worthless (exactly the confusion Stage 5.17-F was opened to investigate — an artifact reporting
# an older commit than the one that was meant to be tested).
if [ -n "$WORKFLOW_SHA" ] && [ "$WORKFLOW_SHA" != "$COMMIT_SHA" ]; then
  die "PROVENANCE MISMATCH: the workflow dispatched against $WORKFLOW_SHA but this server checkout (/srv/biawin-staging) is at $COMMIT_SHA. Refusing to run — nothing on staging was touched. Re-run the server checkout step (git fetch && git reset --hard origin/main) or re-trigger the workflow."
fi

control() { # $1 = setup|teardown|verify
  $COMPOSE run --rm \
    -e STAGE517C_RUN_DIR=/run/stage517c \
    -e STAGE517C_API_ORIGIN="$INTERNAL_API_ORIGIN" \
    -e STAGE517C_ADMIN_ORIGIN="$ADMIN_ORIGIN" \
    -e STAGE517C_PUBLIC_API_ORIGIN="$PUBLIC_API_ORIGIN" \
    -e STAGE517C_COMMIT_SHA="$COMMIT_SHA" \
    -e STAGE517C_ALLOW_REORDER_METADATA_TOUCH="$ALLOW_REORDER" \
    -e STAGE517C_PROVISION_ROLES="$PROVISION_ROLES" \
    -v "$RUN_DIR:/run/stage517c" \
    backend sh -c "cd backend && node dist/scripts/staging-qa/stage-5-17-c/control.js $1"
}

finalize() {
  [ "$FINALIZED" -eq 1 ] && return
  FINALIZED=1
  # Stage 5.17-E: once cleanup has begun, nothing may interrupt it — ignore further HUP/PIPE/INT/TERM.
  trap '' HUP PIPE INT TERM
  trap - EXIT
  [ -n "$TMP_ENVFILE" ] && rm -f "$TMP_ENVFILE"
  [ -n "$TMP_CONTEXT" ] && rm -rf "$TMP_CONTEXT"
  if [ "$SETUP_STARTED" -eq 1 ]; then
    log "cleanup: removing every QA fixture of this run (runs regardless of earlier failures)"
    control teardown || log "WARNING: teardown reported failures — verification below will list what remains"
    log "verification: leftovers, AFTER checksums, Home baseline, verdict"
    control verify
    FINAL_EXIT=$?
  else
    log "setup never started — nothing to clean up"
    FINAL_EXIT=1
  fi
  if [ -n "$RUN_DIR" ]; then
    # Sanitized artifact: reports, checksums, screenshots, results — copied ONLY from this run's own
    # directory into a directory created here (plain mkdir: it cannot already exist).
    # NEVER state.json / roles.json / before|after.json.
    mkdir "$ARTIFACT_DIR" || log "WARNING: could not create $ARTIFACT_DIR"
    for f in stage-5-17-c-report.txt stage-5-17-c-report.json stage-5.17-c-before.txt stage-5.17-c-after.txt \
             remaining-fixtures.json cleanup.json firewall-events.json browser-results.json setup-result.json \
             wrapper-provenance.json provenance.json run-manifest.json; do
      [ -f "$RUN_DIR/$f" ] && cp "$RUN_DIR/$f" "$ARTIFACT_DIR/$f"
    done
    [ -d "$RUN_DIR/screenshots" ] && cp -r "$RUN_DIR/screenshots" "$ARTIFACT_DIR/screenshots"
    rm -f "$RUN_DIR/roles.json"
    # The final manifest is written LAST and states, from this execution's own files, which run/commit
    # the artifact belongs to. The workflow refuses to upload an artifact that disagrees with its own
    # github.run_id / github.sha / this manifest (see qa/validate-stage-5-17-c-artifact.js).
    RUNTIME_RUN_ID="$(sed -n 's/.*"runId": *"\([^"]*\)".*/\1/p' "$RUN_DIR/setup-result.json" 2>/dev/null | head -1)"
    VERIFIER_COMMIT="$(sed -n 's/.*"commitSha": *"\([^"]*\)".*/\1/p' "$RUN_DIR/provenance.json" 2>/dev/null | head -1)"
    cat > "$ARTIFACT_DIR/artifact-manifest.json" <<JSON
{
  "workflowSha": "$WORKFLOW_SHA",
  "workflowRunId": "$WORKFLOW_RUN_ID",
  "serverSha": "$COMMIT_SHA",
  "verifierCommitSha": "${VERIFIER_COMMIT:-}",
  "runId": "${RUNTIME_RUN_ID:-}",
  "runToken": "$RUN_TOKEN",
  "startedAt": "$STARTED_AT",
  "finalizedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "finalExit": $FINAL_EXIT
}
JSON
    echo
    log "===================================================================="
    log "Run directory: $RUN_DIR"
    log "Report:        $ARTIFACT_DIR/stage-5-17-c-report.txt"
    log "Screenshots:   $ARTIFACT_DIR/screenshots/"
    log "===================================================================="
  fi
  if [ "$FINAL_EXIT" -eq 0 ]; then
    log "Home Admin Browser QA PASSED — every required test PASS, cleanup verified, 0 fixtures remain, checksums and Home baseline unchanged."
  else
    echo "[stage-5.17-c][ERROR] Home Admin Browser QA did NOT pass (exit $FINAL_EXIT) — see the report. Stage 5.17 is NOT closed by this run." >&2
  fi
  exit "$FINAL_EXIT"
}
trap finalize EXIT
trap 'FINAL_EXIT=130; exit 130' INT TERM
# A dropped/cancelled SSH session delivers HUP (or PIPE on the next write): both must still reach finalize.
trap 'FINAL_EXIT=129; exit 129' HUP
trap 'FINAL_EXIT=141; exit 141' PIPE

# Fresh, unique, never-reused (a plain `mkdir` that fails if the directory exists). The previous
# `find … rm -rf … 2>/dev/null` "clean" silently ignored failures on root-owned files and is gone.
RUN_DIR="$(fresh_run_dir "$REPORT_BASE" "$RUN_TOKEN")" || die "could not create a fresh run directory under $REPORT_BASE"
ARTIFACT_DIR="$RUN_DIR/artifact"
cat > "$RUN_DIR/run-manifest.json" <<JSON
{
  "workflowSha": "$WORKFLOW_SHA",
  "workflowRunId": "$WORKFLOW_RUN_ID",
  "serverSha": "$COMMIT_SHA",
  "runToken": "$RUN_TOKEN",
  "startedAt": "$STARTED_AT",
  "runDir": "$RUN_DIR"
}
JSON
log "run directory: $RUN_DIR (fresh; nothing from any previous run can be in it)"

cd "$REPO_DIR"

log "1/5 clearing throttler keys only (admin login is limited to 10/10min/IP; same isolated step as run-authenticated-qa.sh)"
redis_container="$($COMPOSE ps -q redis)"
if [ -n "$redis_container" ]; then
  cleared=$(docker exec "$redis_container" sh -c "redis-cli --scan --pattern '{*:default}*' | xargs -r redis-cli del" 2>&1) || true
  log "  cleared throttler keys: ${cleared:-0}"
else
  log "  WARNING: redis service not found — a stale 429 from an earlier run is possible"
fi

log "2/5 building the backend image (does NOT restart running containers) and the verifier image"
$COMPOSE build backend || die "backend image build failed"

TMP_CONTEXT="$(mktemp -d)"
mkdir -p "$TMP_CONTEXT/stage-5-17-c"
cp "$BROWSER_DIR/package.json" "$BROWSER_DIR/package-lock.json" "$BROWSER_DIR/tsconfig.stage-5-17-c.json" "$BROWSER_DIR/Dockerfile.stage-5-17-c" "$TMP_CONTEXT/"
cp "$BROWSER_DIR/stage-5-17-c/verifier.ts" "$TMP_CONTEXT/stage-5-17-c/verifier.ts"
# The REAL tested contract replaces the committed typecheck shims — one implementation, no duplicated safety logic.
cp "$REPO_DIR/backend/scripts/staging-qa/stage-5-17-c/qa-contract.ts" "$TMP_CONTEXT/stage-5-17-c/qa-contract.ts"
cp "$REPO_DIR/backend/scripts/staging-qa/stage-5-17-c/qa-orchestration.ts" "$TMP_CONTEXT/stage-5-17-c/qa-orchestration.ts"

# Stage 5.17-F — hash exactly the bytes just copied into the build context (not the source tree
# again, so this also catches a `cp` gone wrong), embed them + the commit into the image itself
# (provenance.json rides along with the existing `COPY stage-5-17-c ./stage-5-17-c`), and keep a
# copy on the shared run volume so `control.js verify` can read it without touching the image.
hash_file() { sha256sum "$1" | cut -d' ' -f1; }
VERIFIER_TS_HASH="$(hash_file "$TMP_CONTEXT/stage-5-17-c/verifier.ts")"
QA_CONTRACT_HASH="$(hash_file "$TMP_CONTEXT/stage-5-17-c/qa-contract.ts")"
QA_ORCH_HASH="$(hash_file "$TMP_CONTEXT/stage-5-17-c/qa-orchestration.ts")"
cat > "$TMP_CONTEXT/stage-5-17-c/provenance.json" <<JSON
{
  "commitSha": "$COMMIT_SHA",
  "workflowSha": "$WORKFLOW_SHA",
  "sourceHashes": {
    "verifier.ts": "$VERIFIER_TS_HASH",
    "qa-contract.ts": "$QA_CONTRACT_HASH",
    "qa-orchestration.ts": "$QA_ORCH_HASH"
  },
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
mkdir -p "$RUN_DIR"
cp "$TMP_CONTEXT/stage-5-17-c/provenance.json" "$RUN_DIR/wrapper-provenance.json"

docker build -f "$TMP_CONTEXT/Dockerfile.stage-5-17-c" -t biawin-stage-5-17-c-browser-qa:latest "$TMP_CONTEXT" \
  || die "failed to build the verifier image"

log "3/5 setup: BEFORE snapshot + QA fixtures (reorder metadata touch=$ALLOW_REORDER, temporary roles=$PROVISION_ROLES)"
SETUP_STARTED=1
control setup
setup_exit=$?

if [ "$setup_exit" -eq 0 ]; then
  log "4/5 browser tests (46-test matrix, mutation firewall active)"
  TMP_ENVFILE="$(mktemp)"
  chmod 600 "$TMP_ENVFILE"
  grep -E '^(ADMIN_SEED_EMAIL|ADMIN_SEED_PASSWORD)=' "$ENV_FILE" > "$TMP_ENVFILE"
  # No commit/workflow SHA is passed as an env var here on purpose: the verifier's ONLY source of
  # truth for its own provenance is provenance.json baked into the image at build time (above) —
  # an env var would be a second, independently-spoofable/driftable channel for the same fact.
  docker run --rm \
    --env-file "$TMP_ENVFILE" \
    -e STAGE517C_RUN_DIR=/run \
    -v "$RUN_DIR:/run" \
    biawin-stage-5-17-c-browser-qa:latest
  browser_exit=$?
  log "browser verifier exited with $browser_exit (the verdict below is derived from the recorded results, not from this code)"
else
  log "setup did not reach READY (exit $setup_exit) — the browser tests are BLOCKED/NOT_RUN and will be reported as such"
fi

log "5/5 cleanup + verification (via the exit trap)"
exit 0
