#!/usr/bin/env bash
# Biawin production deploy — run ON THE SERVER from wherever this repo is
# checked out for production (path TBD — see docs/production-deployment-home-cms.md).
#
#   ./deploy/production/deploy.sh
#
# Structurally identical to deploy/staging/deploy.sh (every fix that script
# earned the hard way on real staging is carried over from day one — see
# docs/production-deployment-home-cms.md "Lessons carried over from
# staging"): git pull -> re-exec itself from the just-updated file -> build
# images -> bring up infra -> migrate+seed -> Home CMS media migration ->
# deploy backend/web/admin -> health check. Exits non-zero and leaves the
# previous containers running if anything fails before the final cutover.
#
# admin requires admin.biawin.ir's DNS/vhost/SSL to already exist on this
# server — the container itself will build and start regardless, but the
# public domain won't resolve until that manual, one-time step is done.
#
# customer (web) requires biawin.ir's DNS to point at THIS deployment before
# it is reachable publicly — see docs/production-deployment-home-cms.md for
# why that is a deliberate, separate, approved cutover step, not automatic.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# --- Single source of truth for what actually runs inside the backend
# container for migrate+seed and the Home media migration — mirrors
# deploy/staging/deploy.sh's identical mechanism (and the exact reason it
# exists: deploy/staging/run-authenticated-qa.sh / verify-runtime-image.sh
# `source` that file to read these same two variables, so the verified
# command and the deployed command can never drift apart). No production
# QA runner currently reads this — kept in the same shape anyway for
# consistency and in case one is added later.
SEED_CMD='cd backend && pnpm exec prisma migrate deploy && node dist/prisma/seed.js'
MEDIA_MIGRATION_CMD='cd backend && node dist/prisma/seed-home-media.js'

if [ "${DEPLOY_SH_SOURCE_ONLY:-0}" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

set -euo pipefail

COMPOSE_FILE="$REPO_DIR/deploy/production/docker-compose.production.yml"
ENV_FILE="$REPO_DIR/deploy/production/.env.production"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found. Copy deploy/production/.env.production.example and fill in real, freshly-generated secrets first — never copy staging's secrets here."

cd "$REPO_DIR"

if [ "${DEPLOY_SH_REEXECED:-0}" != "1" ]; then
  log "1/7 git fetch + checkout main"
  git fetch origin main
  git checkout main
  git reset --hard origin/main

  # See deploy/staging/deploy.sh's identical comment for the full incident
  # this prevents: a running bash process does not automatically pick up
  # changes to its own file from the `git reset --hard` above. `exec`
  # replaces this process outright and re-opens the file fresh.
  log "re-executing deploy.sh from the just-updated file on disk"
  DEPLOY_SH_REEXECED=1 exec bash "$REPO_DIR/deploy/production/deploy.sh"
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

log "4/7 running prisma migrate deploy + compiled seed (one-off, against the just-built backend image)"
# $SEED_CMD runs node dist/prisma/seed.js — the ALREADY-COMPILED output, NOT
# `prisma db seed` (which needs backend/src, not present in the runtime
# image — see docs/08-staging-deployment.md "Runtime image packaging" for
# the real staging failure this fix came from).
$COMPOSE run --rm backend sh -c "$SEED_CMD"

log "5/7 running Home CMS static asset migration (idempotent — safe to re-run every deploy)"
$COMPOSE run --rm backend sh -c "$MEDIA_MIGRATION_CMD"

log "6/7 deploying backend + web + admin"
$COMPOSE up -d backend web admin

log "7/7 health check"
ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4101/api/health >/dev/null 2>&1; then
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
  if curl -fsS http://127.0.0.1:3101/ >/dev/null 2>&1; then
    web_ok=1
    break
  fi
  sleep 2
done
if [ "$web_ok" -ne 1 ]; then
  fail "web did not respond on 127.0.0.1:3101 after deploy"
fi

admin_ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3102/ >/dev/null 2>&1; then
    admin_ok=1
    break
  fi
  sleep 2
done
if [ "$admin_ok" -ne 1 ]; then
  fail "admin did not respond on 127.0.0.1:3102 after deploy"
fi

log "deploy successful: backend healthy on 127.0.0.1:4101, web responding on 127.0.0.1:3101, admin responding on 127.0.0.1:3102"
log "public cutover (DNS/vhost) is a SEPARATE, deliberate step — see docs/production-deployment-home-cms.md. This script does not touch DNS, vhosts, or certificates."
