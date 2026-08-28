#!/usr/bin/env bash
# Stage 5.22 — one-command authenticated staging QA runner.
#
#   ./deploy/staging/run-authenticated-qa.sh
#
# Runs TWO independent QA layers against the real deployed staging
# environment and writes both reports (plus screenshots) to a local,
# gitignored, non-repo path — nothing here is committed, nothing prints a
# secret:
#
#   1. API layer (backend/scripts/staging-qa/authenticated-qa-runner.ts,
#      compiled): Admin auth, RBAC (a real SUPPORT_VIEWER 403), Media
#      upload/reject/delete, Home CMS CRUD across all four resources,
#      the Category-UUID-not-display-name relationship proof, Admin ->
#      Customer propagation (text/active/reorder/image, each restored and
#      re-verified), audit log entries, and Customer STAGING_TEST_AUTH
#      login. Runs inside the real `backend` Docker image (proven runtime
#      packaging, direct Prisma/DB access for provisioning temporary
#      CONTENT_EDITOR/SUPPORT_VIEWER admin accounts — there is no REST
#      endpoint for that in this codebase, so this is the only mechanism
#      available; both accounts are deleted again before this script
#      exits, always, even on failure).
#
#   2. Browser/visual layer (deploy/staging/qa/browser/browser-qa.ts):
#      real Admin and Customer login through the actual UI (not an API
#      shortcut), screenshots at mobile+desktop widths, console/network
#      error capture, no-broken-images / no-horizontal-overflow checks,
#      and the Stage 5.20 Media Picker regression proof (uploading inside
#      the picker must not submit the outer Home form). Runs inside the
#      official Playwright image (see deploy/staging/qa/browser/Dockerfile
#      for why this can't reuse backend's Alpine-based image).
#
# BOTH layers are fail-closed: any required check failing, or any cleanup
# step failing, makes that layer exit non-zero and this script reports it
# clearly — it does not claim success after a real failure.
#
# Secret handling: ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are read from the
# real deploy/staging/.env.staging on this server (already gitignored,
# never committed) via each container's normal env_file/--env-file
# mechanism — this script never echoes them, never writes them to a log
# file, and neither runner script ever prints a raw token (JWTs are
# redacted before being written to any report).
#
# Does NOT redeploy the application. Does NOT rebuild backend/web/admin.
# It DOES rebuild the (throwaway, isolated) browser-qa image if this is
# the first run or browser-qa.ts changed — that's a QA-tool image, not an
# app image, and rebuilding it has zero effect on the running staging
# containers.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

REPORT_DIR="${QA_REPORT_DIR:-/tmp/biawin-staging-qa}"

log() { echo "[run-qa] $*"; }
fail() { echo "[run-qa][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found — this must be run on the staging server, from the repo checkout that has the real secrets file."

cd "$REPO_DIR"
mkdir -p "$REPORT_DIR"

log "1/3 rebuilding the backend image from the current checkout (fast if nothing changed — this does NOT redeploy or restart the running backend/web/admin containers, it only ensures the QA runner's compiled script is current)"
$COMPOSE build backend

log "2/3 running the API-layer QA runner inside the backend image"
# SERVICES-R1.2 real-staging finding: this container is started via
# `$COMPOSE run --rm backend`, i.e. it's a member of the compose network,
# NOT a general-internet host — and on this server it genuinely cannot
# reach the public HTTPS domain it defaulted to (`fetch failed`, no
# further detail before this was diagnosed; see apiCall()'s now-improved
# error surfacing in authenticated-qa-runner.ts). This was anticipated
# ("untested" — see prior revision of this comment) and is now confirmed:
# default the API-layer run to the internal Docker network origin, which
# this container is guaranteed to reach on the same compose network,
# rather than the public domain the browser-qa container (a separate,
# non-compose `docker run`, closer to a real client) correctly uses. An
# explicit QA_API_ORIGIN/QA_CUSTOMER_ORIGIN still overrides this default.
api_exit=0
$COMPOSE run --rm \
  -e QA_API_ORIGIN="${QA_API_ORIGIN:-http://backend:4000}" \
  -e QA_CUSTOMER_ORIGIN="${QA_CUSTOMER_ORIGIN:-http://web:3000}" \
  -e QA_ADMIN_ORIGIN="${QA_ADMIN_ORIGIN:-}" \
  -e QA_REPORT_DIR=/tmp/biawin-staging-qa \
  -v "$REPORT_DIR:/tmp/biawin-staging-qa" \
  backend sh -c "cd backend && node dist/scripts/staging-qa/authenticated-qa-runner.js" || api_exit=$?

if [ "$api_exit" -ne 0 ]; then
  log "API-layer QA reported failures (exit $api_exit) — see the report above and in $REPORT_DIR/. Continuing to the browser layer anyway so you get both results in one run; the FINAL exit code below reflects both."
fi

log "3/3 running the browser/visual QA layer (building the Playwright image if needed)"
browser_exit=0
docker build -f "$REPO_DIR/deploy/staging/qa/browser/Dockerfile" -t biawin-staging-browser-qa:latest "$REPO_DIR/deploy/staging/qa/browser" \
  || fail "failed to build the browser-qa image"

docker run --rm \
  -e QA_CUSTOMER_ORIGIN="${QA_CUSTOMER_ORIGIN:-https://staging.biawin.ir}" \
  -e QA_ADMIN_ORIGIN="${QA_ADMIN_ORIGIN:-https://admin-staging.biawin.ir}" \
  -e ADMIN_SEED_EMAIL="$(grep -E '^ADMIN_SEED_EMAIL=' "$ENV_FILE" | cut -d= -f2-)" \
  -e ADMIN_SEED_PASSWORD="$(grep -E '^ADMIN_SEED_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)" \
  -e QA_REPORT_DIR=/tmp/biawin-staging-qa \
  -v "$REPORT_DIR:/tmp/biawin-staging-qa" \
  biawin-staging-browser-qa:latest || browser_exit=$?

echo
log "===================================================================="
log "API-layer report:      $(ls -t "$REPORT_DIR"/authenticated-qa-report-*.txt 2>/dev/null | head -1 || echo '(none written)')"
log "Browser-layer report:  $(ls -t "$REPORT_DIR"/browser-qa-report-*.txt 2>/dev/null | head -1 || echo '(none written)')"
log "Screenshots:           $REPORT_DIR/screenshots/"
log "===================================================================="

if [ "$api_exit" -ne 0 ] || [ "$browser_exit" -ne 0 ]; then
  fail "QA run FAILED — api_exit=$api_exit browser_exit=$browser_exit — see the reports above before proceeding. Do not treat this as production-ready."
fi

log "QA run PASSED — both layers completed with no required-check failures and cleanup verified."
