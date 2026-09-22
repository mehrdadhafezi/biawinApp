#!/usr/bin/env bash
# Stage 5.16-E — authenticated, API-only fixture verification.
#
#   ./deploy/staging/run-stage-5-16-e-verification.sh
#
# Run ONLY on the staging server, from /srv/biawin-staging (same
# precondition as run-authenticated-qa.sh — this script needs the real
# deploy/staging/.env.staging file, which is never committed). Closes the
# BLOCKED items from docs/STAGE-5.16-D-AUTHENTICATED-API-FIXTURE-
# VERIFICATION-RESULT.md by running backend/scripts/staging-qa/
# stage-5-16-e-home-fixture-verifier.ts — a dedicated, single-layer,
# API-only script — inside the real `backend` Docker image (same execution
# pattern as run-authenticated-qa.sh's API layer: direct Prisma/DB access
# for the one state the script's own header explains is otherwise
# unreachable through the API, and zero new npm dependencies).
#
# Deliberately does NOT invoke authenticated-qa-runner.ts and does NOT
# build or run the Playwright/browser-qa image — this script has exactly
# one layer, API only, by design (see this stage's own scope rules).
#
# Secret handling: identical to run-authenticated-qa.sh — ADMIN_SEED_EMAIL/
# ADMIN_SEED_PASSWORD reach the verifier only via the backend container's
# normal `env_file: .env.staging` (Compose), never echoed by this script,
# never passed as a CLI argument, never written to a log file. The verifier
# itself redacts anything JWT-shaped before it can reach its own report.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

REPORT_DIR="${STAGE516E_REPORT_DIR:-/tmp/stage-5-16-e}"

log() { echo "[stage-5.16-e] $*"; }
fail() { echo "[stage-5.16-e][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found — this must be run on the staging server, from the repo checkout that has the real secrets file."

cd "$REPO_DIR"
mkdir -p "$REPORT_DIR"

log "1/2 rebuilding the backend image from the current checkout (fast if nothing changed — does NOT redeploy or restart the running backend/web/admin containers)"
$COMPOSE build backend

log "2/2 running the Stage 5.16-E fixture verifier inside the backend image"
exit_code=0
$COMPOSE run --rm \
  -e STAGE516E_API_ORIGIN="${STAGE516E_API_ORIGIN:-http://backend:4000}" \
  -e STAGE516E_REPORT_DIR=/tmp/stage-5-16-e \
  -v "$REPORT_DIR:/tmp/stage-5-16-e" \
  backend sh -c "cd backend && node dist/scripts/staging-qa/stage-5-16-e-home-fixture-verifier.js" || exit_code=$?

echo
log "===================================================================="
log "Report:            $(ls -t "$REPORT_DIR"/stage-5-16-e-report-*.txt 2>/dev/null | head -1 || echo '(none written)')"
log "BEFORE checksums:  $REPORT_DIR/stage-5.16-e-before.txt"
log "AFTER checksums:   $REPORT_DIR/stage-5.16-e-after.txt"
log "===================================================================="

if [ "$exit_code" -ne 0 ]; then
  fail "Stage 5.16-E verification FAILED or was BLOCKED (exit $exit_code) — see the report above and in $REPORT_DIR/. Do not treat this as Stage 5.16 being closed."
fi

log "Stage 5.16-E verification PASSED — all required checks passed, cleanup verified, protected-table checksums unchanged."
