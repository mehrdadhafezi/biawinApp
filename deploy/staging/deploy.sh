#!/usr/bin/env bash
# Biawin staging deploy — run ON THE SERVER from /srv/biawin-staging.
#
#   ./deploy/staging/deploy.sh
#
# Does: git pull -> re-exec itself from the just-updated file -> build images
# -> bring up infra -> migrate+seed -> Home CMS media migration -> deploy
# backend/web/admin -> health check. Exits non-zero and leaves the previous
# containers running if anything fails before the final cutover.
#
# admin (Stage 5.22) requires admin-staging.biawin.ir's DNS/vhost/SSL to
# already exist on this server (docs/10-release-process.md "One-time server
# setup, Stage 5.22 addendum") — the container itself will build and start
# regardless, but the public domain won't resolve until that manual,
# one-time step is done.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# --- Single source of truth for what actually runs inside the backend
# container for migrate+seed and the Home media migration — defined here,
# not inline in the steps below, so deploy/staging/verify-runtime-image.sh
# can `source` this exact file and verify these EXACT strings against the
# real runtime image. This is load-bearing, not cosmetic: a Stage 5.22
# staging attempt failed with the verification script reporting success
# while the real deploy ran a *different*, unfixed command — two
# hand-copied command strings had drifted apart. Sourcing the same
# variables from the same file makes that drift structurally impossible.
SEED_CMD='cd backend && pnpm exec prisma migrate deploy && node dist/prisma/seed.js'
MEDIA_MIGRATION_CMD='cd backend && node dist/prisma/seed-home-media.js'

# Lets verify-runtime-image.sh `source` this file to read the two variables
# above WITHOUT executing an actual deploy (no git operations, no docker
# build/up, no `set -euo pipefail` that would kill the sourcing shell on the
# first unset variable) — set DEPLOY_SH_SOURCE_ONLY=1 before sourcing.
if [ "${DEPLOY_SH_SOURCE_ONLY:-0}" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

set -euo pipefail

COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found. Copy deploy/staging/.env.staging.example and fill in real secrets first."

cd "$REPO_DIR"

if [ "${DEPLOY_SH_REEXECED:-0}" != "1" ]; then
  log "1/7 git fetch + checkout main"
  git fetch origin main
  git checkout main
  git reset --hard origin/main

  # CRITICAL: the line above just overwrote this very file on disk. A bash
  # process that has already started executing a script does NOT
  # automatically pick up that change for its own remaining lines — on
  # Linux, `git reset --hard` replaces changed files via unlink+recreate,
  # and a process that already has the old file open keeps reading the OLD
  # inode to completion via that existing file descriptor, unaffected by
  # the new file now sitting at the same path. This bit real staging once
  # already (Stage 5.22): a deploy.sh fix landed and was pushed, but a
  # deploy invoked from the OLD file kept running the OLD step 4/5 seed
  # commands even after "HEAD is now at <new commit>" printed from the `git
  # reset` above — the image was rebuilt from the new commit, but the
  # still-old, still-running script kept invoking the pre-fix `prisma db
  # seed` against it, failing the exact same way as before the fix existed.
  # `exec` replaces this process outright and re-opens the file fresh —
  # there is no version of this hazard that survives that.
  log "re-executing deploy.sh from the just-updated file on disk"
  DEPLOY_SH_REEXECED=1 exec bash "$REPO_DIR/deploy/staging/deploy.sh"
fi

log "2/7 building images (backend + web + admin)"
$COMPOSE build backend web admin

log "3/7 starting infra (postgres, redis, minio) and waiting for health"
$COMPOSE up -d postgres redis minio minio-init
for svc in postgres redis minio; do
  cid=$($COMPOSE ps -q "$svc")
  for i in $(seq 1 30); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "unknown")
    [ "$status" = "healthy" ] && break
    sleep 2
    [ "$i" -eq 30 ] && fail "$svc did not become healthy in time"
  done
done

log "4/7 running prisma migrate deploy + db seed (one-off, against the just-built backend image)"
# $SEED_CMD runs `node dist/prisma/seed.js` — the ALREADY-COMPILED output
# `nest build` emits (prisma/*.ts is in tsc's default compile scope, same as
# src/) — NOT `prisma db seed` / `pnpm exec ts-node ... prisma/seed.ts`.
# `prisma db seed` shells out to ts-node against the TypeScript *source*
# (per prisma.config.ts, kept that way deliberately for local dev's fast
# edit-loop), which imports `../src/modules/admin-auth/password-hash.util` —
# and this runtime image intentionally does NOT copy `backend/src` (see
# Dockerfile.backend), only `backend/dist`. Running the compiled script
# directly needs nothing beyond what's already in the image (same principle
# the running `backend` container itself already relies on: `CMD ["node",
# "backend/dist/src/main.js"]` is 100% compiled-output, zero TS source).
# Bypassing the `prisma db seed` CLI wrapper is safe: seeding isn't
# migration-tracked, so there's no Prisma-internal state that wrapper alone
# would have recorded. See SEED_CMD's own definition near the top of this
# file — that is the actual command, this comment is just an explanation.
$COMPOSE run --rm backend sh -c "$SEED_CMD"

log "5/7 running Home CMS static asset migration (Stage 5.21, idempotent — safe to re-run every deploy)"
# $MEDIA_MIGRATION_CMD — same reasoning as step 4, dist/prisma/seed-home-media.js,
# not ts-node against source (which needs backend/src/app.module.ts and
# everything it transitively pulls in — the entire NestJS module graph,
# absent here by design).
$COMPOSE run --rm backend sh -c "$MEDIA_MIGRATION_CMD"

log "6/7 deploying backend + web + admin"
$COMPOSE up -d backend web admin

log "7/7 health check"
ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4001/api/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  log "backend health check FAILED — rolling back to previous images is manual: check 'docker compose -f $COMPOSE_FILE logs backend'"
  fail "deploy did not pass health check"
fi

web_ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/ >/dev/null 2>&1; then
    web_ok=1
    break
  fi
  sleep 2
done
if [ "$web_ok" -ne 1 ]; then
  fail "web did not respond on 127.0.0.1:3001 after deploy"
fi

admin_ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3002/ >/dev/null 2>&1; then
    admin_ok=1
    break
  fi
  sleep 2
done
if [ "$admin_ok" -ne 1 ]; then
  fail "admin did not respond on 127.0.0.1:3002 after deploy"
fi

log "deploy successful: backend healthy on 127.0.0.1:4001, web responding on 127.0.0.1:3001, admin responding on 127.0.0.1:3002"
