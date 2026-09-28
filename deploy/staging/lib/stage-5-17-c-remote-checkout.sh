#!/usr/bin/env bash
# Stage 5.17-H — REMOTE half of the workflow's "update server checkout" step.
#
# The workflow streams this file to the staging server over SSH (`ssh … bash -s -- <expected-sha> < this-file`),
# so the script that runs there is the one from the dispatched commit, not whatever the server tree holds.
#
#   bash stage-5-17-c-remote-checkout.sh <expected-40-hex-sha>
#
# Contract (fail closed, no data crosses back through stdout):
#   exit 0   the server checkout is at EXACTLY <expected-sha>
#   exit 42  the checkout succeeded but is at a different commit (provenance mismatch)
#   exit 2   bad arguments
#   other    a git command failed (set -e)
#
# Everything git prints (e.g. "From github.com/…", "Already on 'main'", "Your branch is behind …
# (use "git pull" to update your local branch)") is DIAGNOSTIC OUTPUT ONLY. It goes to the job log and is
# never captured into a variable, a step output or $GITHUB_OUTPUT — Stage 5.17-H exists because capturing
# it there made the workflow fail with "Unable to process file command 'output'" before the wrapper ran.
set -euo pipefail

expected="${1:-}"
if ! printf '%s' "$expected" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "remote-checkout: expected SHA must be 40 lowercase hex characters (got '${expected}')" >&2
  exit 2
fi

repo="${STAGE517C_SERVER_REPO:-/srv/biawin-staging}"
cd "$repo"

git fetch origin main
git checkout main
git reset --hard origin/main

actual="$(git rev-parse HEAD)" # a single value, consumed here, never echoed back as "output"
echo "server checkout is at: $actual"
echo "workflow dispatched:   $expected"
if [ "$actual" != "$expected" ]; then
  echo "PROVENANCE MISMATCH: the server checkout ($actual) is not the commit the workflow dispatched against ($expected) — refusing to run Browser QA." >&2
  exit 42
fi
