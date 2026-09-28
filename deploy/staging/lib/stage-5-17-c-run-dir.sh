#!/usr/bin/env bash
# Stage 5.17-G — per-execution run directory for the Home Admin Browser QA.
#
# Sourced by run-stage-5-17-c-browser-qa.sh and by the shell tests. Never executed directly.
#
# Why this exists: the wrapper used ONE fixed directory (/tmp/stage-5-17-c) and ONE fixed artifact
# path (/tmp/stage-5-17-c/artifact) for every run, "cleaned" by `find … rm -rf … 2>/dev/null`
# (failures on root-owned files written by the containers were silently ignored). Any run that
# failed before reaching its own finalize step therefore left the PREVIOUS run's artifact at the
# path the workflow then fetched and uploaded. The fix is structural: every execution gets its
# OWN directory, created with a plain `mkdir` that FAILS if it already exists, so there is nothing
# to clean and nothing stale that could ever be picked up.

# Only characters that are safe in a path segment and in a JSON string.
sanitize_run_token() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-80
}

# fresh_run_dir <base> <token>  — prints the new directory on stdout; non-zero if it already exists.
fresh_run_dir() {
  local base="$1" token dir
  token="$(sanitize_run_token "$2")"
  [ -n "$token" ] || { echo "fresh_run_dir: empty run token" >&2; return 1; }
  dir="$base/run-$token"
  mkdir -p "$base" || return 1
  # NO -p: an existing directory is an error, never silently reused.
  mkdir "$dir" 2>/dev/null || { echo "fresh_run_dir: $dir already exists — refusing to reuse a previous run's directory" >&2; return 1; }
  chmod 777 "$dir" # the backend/playwright containers write here as their own users
  printf '%s\n' "$dir"
}

# Token for a run: the workflow's run id + attempt when dispatched by GitHub, otherwise a unique manual token.
default_run_token() {
  if [ -n "${1:-}" ]; then
    printf '%s' "$1"
  else
    printf 'manual-%s-%s' "$(date -u +%Y%m%dT%H%M%SZ)" "$$"
  fi
}
