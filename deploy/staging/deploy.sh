#!/usr/bin/env bash
# Biawin staging deploy — run ON THE SERVER from /srv/biawin-staging.
#
#   ./deploy/staging/deploy.sh
#
# Does: git pull -> build images -> bring up infra -> migrate+seed -> Home
# CMS media migration -> deploy backend/web/admin -> health check. Exits
# non-zero and leaves the previous containers running if anything fails
# before the final cutover.
#
# admin (Stage 5.22) requires admin-staging.biawin.ir's DNS/vhost/SSL to
# already exist on this server (docs/10-release-process.md "One-time server
# setup, Stage 5.22 addendum") — the container itself will build and start
# regardless, but the public domain won't resolve until that manual,
# one-time step is done.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/staging/docker-compose.staging.yml"
ENV_FILE="$REPO_DIR/deploy/staging/.env.staging"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy][ERROR] $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found. Copy deploy/staging/.env.staging.example and fill in real secrets first."

cd "$REPO_DIR"

log "1/7 git fetch + checkout main"
git fetch origin main
git checkout main
git reset --hard origin/main

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
# `pnpm exec` (not a raw node_modules/.bin/prisma path) — `prisma db seed`
# internally spawns `ts-node` expecting it resolvable on $PATH, which only
# `pnpm exec` arranges for; a bare shell invocation leaves $PATH unmodified
# and fails with `spawn ts-node ENOENT`.
$COMPOSE run --rm backend sh -c "cd backend && pnpm exec prisma migrate deploy && pnpm exec prisma db seed"

log "5/7 running Home CMS static asset migration (Stage 5.21, idempotent — safe to re-run every deploy)"
$COMPOSE run --rm backend sh -c "cd backend && pnpm exec ts-node --compiler-options '{\"module\":\"commonjs\"}' prisma/seed-home-media.ts"

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
