#!/usr/bin/env bash
# Proves the real staging backend Docker image (deploy/staging/Dockerfile.backend)
# can actually execute, against a real (throwaway) Postgres/Redis/MinIO:
#
#   1. prisma migrate deploy
#   2. the seed script          ($SEED_CMD, sourced from deploy.sh below)
#   3. the Home media migration ($MEDIA_MIGRATION_CMD, sourced from deploy.sh below)
#
# without depending on any file absent from the runtime image (backend/src
# is deliberately NOT copied into it — see Dockerfile.backend). This exists
# because a normal `pnpm build`/typecheck/lint/test run is NOT sufficient to
# catch this class of bug: tsc compiling `backend/src` and `backend/prisma`
# successfully says nothing about which of those compiled files a specific
# Docker stage's COPY instructions actually include. The only way to prove
# the runtime image is deployable is to build it for real and run these
# exact commands inside it — which is what this script does.
#
# CRITICAL: this script does NOT hardcode its own copy of the seed/media-
# migration commands. It `source`s deploy.sh itself (with
# DEPLOY_SH_SOURCE_ONLY=1, so deploy.sh only defines its SEED_CMD /
# MEDIA_MIGRATION_CMD variables and returns, touching nothing else) and runs
# those exact strings. An earlier version hardcoded its own copy here, and
# it drifted from what deploy.sh actually ran without either script
# noticing — this run reported "ALL RUNTIME COMMANDS SUCCEEDED" on real
# staging while the real deploy failed on a different, unfixed command.
# Sourcing the same variables from the same file makes that class of drift
# structurally impossible, not just "checked for" — see deploy.sh's own
# comment on SEED_CMD for the fuller story.
#
# Run before every staging/production deploy that touches Dockerfile.backend,
# deploy.sh, prisma/seed.ts, prisma/seed-home-media.ts, or anything they import:
#
#   ./deploy/staging/verify-runtime-image.sh
#
# Safe to run anywhere, including on the staging server itself alongside a
# live deployment — see docker-compose.verify.yml's header for why (isolated
# project name, no published host ports, throwaway volumes).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SH="$REPO_DIR/deploy/staging/deploy.sh"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.verify.yml"
# An array, not a plain string — a plain "$COMPOSE build ..." word-splits on
# every space, which breaks silently (and non-obviously) the moment the repo
# lives under a path containing one (e.g. a Windows user's home directory).
COMPOSE=(docker compose -f "$COMPOSE_FILE")

log() { echo "[verify] $*"; }
fail() { echo "[verify][ERROR] $*" >&2; exit 1; }

cleanup() {
  log "tearing down the ephemeral verification stack"
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "$REPO_DIR"

log "0/5 static check: deploy.sh must not invoke prisma db seed / ts-node against prisma source"
# Cheap, fast, independent of the sourcing mechanism below — catches a
# `prisma db seed` (or ts-node-against-source) call added ANYWHERE in
# deploy.sh, not just inside SEED_CMD/MEDIA_MIGRATION_CMD, in case a future
# edit reintroduces it some other way. Full-line comments are stripped
# first — deploy.sh's own comments legitimately *mention* `prisma db seed`
# by name to explain why it's avoided, which isn't an invocation.
if grep -vE '^[[:space:]]*#' "$DEPLOY_SH" | grep -qE 'prisma[[:space:]]+db[[:space:]]+seed|ts-node.*prisma/(seed|seed-home-media)\.ts'; then
  fail "deploy.sh contains a banned pattern (prisma db seed / ts-node against prisma/*.ts source) in executable code — this is exactly the bug that broke real staging. Run: grep -vE '^[[:space:]]*#' $DEPLOY_SH | grep -nE 'prisma db seed|ts-node.*prisma/(seed|seed-home-media)\\.ts'"
fi

log "0/5 sourcing SEED_CMD / MEDIA_MIGRATION_CMD from deploy.sh itself (not a hand-copied duplicate)"
DEPLOY_SH_SOURCE_ONLY=1 source "$DEPLOY_SH"
[ -n "${SEED_CMD:-}" ] || fail "deploy.sh did not define \$SEED_CMD when sourced — did its variable name change without this script being updated?"
[ -n "${MEDIA_MIGRATION_CMD:-}" ] || fail "deploy.sh did not define \$MEDIA_MIGRATION_CMD when sourced — did its variable name change without this script being updated?"
log "  SEED_CMD=$SEED_CMD"
log "  MEDIA_MIGRATION_CMD=$MEDIA_MIGRATION_CMD"

log "1/5 tearing down any leftover verification stack from a previous run"
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true

log "2/5 building the real staging backend image (deploy/staging/Dockerfile.backend)"
"${COMPOSE[@]}" build backend

log "3/5 starting throwaway postgres/redis/minio and waiting for health"
"${COMPOSE[@]}" up -d postgres redis minio minio-init
for svc in postgres redis minio; do
  cid=$("${COMPOSE[@]}" ps -q "$svc")
  healthy=0
  for i in $(seq 1 30); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      healthy=1
      break
    fi
    sleep 2
  done
  [ "$healthy" -eq 1 ] || fail "$svc did not become healthy in time"
done

log "4/5 running \$SEED_CMD against the real image (this is deploy.sh's own step 4/7, verbatim)"
if ! "${COMPOSE[@]}" run --rm backend sh -c "$SEED_CMD"; then
  fail "SEED_CMD failed inside the real runtime image — this is exactly the class of bug this script exists to catch before it reaches staging. Check whether prisma/seed.ts (or anything it imports) references a file outside backend/dist that Dockerfile.backend doesn't copy."
fi

log "5/5 running \$MEDIA_MIGRATION_CMD against the real image (this is deploy.sh's own step 5/7, verbatim)"
if ! "${COMPOSE[@]}" run --rm backend sh -c "$MEDIA_MIGRATION_CMD"; then
  fail "MEDIA_MIGRATION_CMD failed inside the real runtime image — same class of bug as above, check its imports and any __dirname-relative path logic (it must resolve identically whether run via ts-node from prisma/ in local dev or as compiled dist/prisma/ output here)."
fi

log "ALL RUNTIME COMMANDS SUCCEEDED — and they are verified to be the SAME commands deploy.sh itself runs (sourced, not duplicated) — the backend image is safe to deploy."
