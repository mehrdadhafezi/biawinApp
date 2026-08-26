#!/usr/bin/env bash
# Proves the real staging backend Docker image (deploy/staging/Dockerfile.backend)
# can actually execute, against a real (throwaway) Postgres/Redis/MinIO:
#
#   1. prisma migrate deploy
#   2. the seed script          (dist/prisma/seed.js)
#   3. the Home media migration (dist/prisma/seed-home-media.js)
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
# Run before every staging/production deploy that touches Dockerfile.backend,
# prisma/seed.ts, prisma/seed-home-media.ts, or anything they import:
#
#   ./deploy/staging/verify-runtime-image.sh
#
# Safe to run anywhere, including on the staging server itself alongside a
# live deployment — see docker-compose.verify.yml's header for why (isolated
# project name, no published host ports, throwaway volumes).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

log "0/4 tearing down any leftover verification stack from a previous run"
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true

log "1/4 building the real staging backend image (deploy/staging/Dockerfile.backend)"
"${COMPOSE[@]}" build backend

log "2/4 starting throwaway postgres/redis/minio and waiting for health"
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

log "3/4 running prisma migrate deploy + seed.js against the real image"
if ! "${COMPOSE[@]}" run --rm backend sh -c "cd backend && pnpm exec prisma migrate deploy && node dist/prisma/seed.js"; then
  fail "migrate/seed failed inside the real runtime image — this is exactly the class of bug this script exists to catch before it reaches staging. Check whether prisma/seed.ts (or anything it imports) references a file outside backend/dist that Dockerfile.backend doesn't copy."
fi

log "4/4 running the Home CMS media migration (seed-home-media.js) against the real image"
if ! "${COMPOSE[@]}" run --rm backend sh -c "cd backend && node dist/prisma/seed-home-media.js"; then
  fail "seed-home-media.js failed inside the real runtime image — same class of bug as above, check its imports and any __dirname-relative path logic (it must resolve identically whether run via ts-node from prisma/ in local dev or as compiled dist/prisma/ output here)."
fi

log "ALL RUNTIME COMMANDS SUCCEEDED — the backend image is safe to deploy."
