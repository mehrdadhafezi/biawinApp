#!/usr/bin/env bash
# Biawin staging deploy — run ON THE SERVER from /srv/biawin-staging.
#
#   ./deploy/staging/deploy.sh
#
# Does: git pull -> build images -> bring up infra -> migrate+seed -> deploy
# backend/web -> health check. Exits non-zero and leaves the previous
# containers running if anything fails before the final cutover.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found. Copy deploy/staging/.env.staging.example and fill in real secrets first."

cd "$REPO_DIR"

log "1/6 git fetch + checkout main"
git fetch origin main
git checkout main
git reset --hard origin/main

log "2/6 building images (backend + web)"
$COMPOSE build backend web

log "3/6 starting infra (postgres, redis, minio) and waiting for health"
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

log "4/6 running prisma migrate deploy + db seed (one-off, against the just-built backend image)"
# `pnpm exec` (not a raw node_modules/.bin/prisma path) — `prisma db seed`
# internally spawns `ts-node` expecting it resolvable on $PATH, which only
# `pnpm exec` arranges for; a bare shell invocation leaves $PATH unmodified
# and fails with `spawn ts-node ENOENT`.
$COMPOSE run --rm backend sh -c "cd backend && pnpm exec prisma migrate deploy && pnpm exec prisma db seed"

log "5/6 deploying backend + web"
$COMPOSE up -d backend web

log "6/6 health check"
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

if ! curl -fsS http://127.0.0.1:3001/ >/dev/null 2>&1; then
  fail "web did not respond on 127.0.0.1:3001 after deploy"
fi

log "deploy successful: backend healthy on 127.0.0.1:4001, web responding on 127.0.0.1:3001"
