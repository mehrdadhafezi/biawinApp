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
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
BROWSER_DIR="$REPO_DIR/deploy/staging/qa/browser"

RUN_DIR="${STAGE517C_REPORT_DIR:-/tmp/stage-5-17-c}"
ARTIFACT_DIR="$RUN_DIR/artifact"
ALLOW_REORDER="${STAGE517C_ALLOW_REORDER_METADATA_TOUCH:-false}"
PROVISION_ROLES="${STAGE517C_PROVISION_ROLES:-false}"
ADMIN_ORIGIN="${STAGE517C_ADMIN_ORIGIN:-https://admin-staging.biawin.ir}"
PUBLIC_API_ORIGIN="${STAGE517C_PUBLIC_API_ORIGIN:-https://api-staging.biawin.ir}"
INTERNAL_API_ORIGIN="${STAGE517C_API_ORIGIN:-http://backend:4000}"

log() { echo "[stage-5.17-c] $*"; }
die() { echo "[stage-5.17-c][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found — this must be run on the staging server, from the repo checkout that has the real secrets file."

COMMIT_SHA="$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
TMP_CONTEXT=""
TMP_ENVFILE=""
SETUP_STARTED=0
FINALIZED=0
FINAL_EXIT=1

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
  # Sanitized artifact: reports, checksums, screenshots, results. NEVER state.json / roles.json / before|after.json.
  rm -rf "$ARTIFACT_DIR"
  mkdir -p "$ARTIFACT_DIR"
  for f in stage-5-17-c-report.txt stage-5-17-c-report.json stage-5.17-c-before.txt stage-5.17-c-after.txt \
           remaining-fixtures.json cleanup.json firewall-events.json browser-results.json setup-result.json; do
    [ -f "$RUN_DIR/$f" ] && cp "$RUN_DIR/$f" "$ARTIFACT_DIR/$f"
  done
  [ -d "$RUN_DIR/screenshots" ] && cp -r "$RUN_DIR/screenshots" "$ARTIFACT_DIR/screenshots"
  rm -f "$RUN_DIR/roles.json"
  echo
  log "===================================================================="
  log "Report:       $ARTIFACT_DIR/stage-5-17-c-report.txt"
  log "Screenshots:  $ARTIFACT_DIR/screenshots/"
  log "===================================================================="
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

mkdir -p "$RUN_DIR"
find "$RUN_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
chmod 777 "$RUN_DIR"   # the backend/playwright containers write here as their own users

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
