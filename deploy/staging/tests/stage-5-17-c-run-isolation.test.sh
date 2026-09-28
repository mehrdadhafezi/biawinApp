#!/usr/bin/env bash
# Stage 5.17-G — shell tests for per-execution run isolation.
#
#   bash deploy/staging/tests/stage-5-17-c-run-isolation.test.sh
#
# Needs only bash + git + coreutils. Never touches docker (a fake `docker` is put first on PATH),
# never touches staging, never reads .env.staging (a fake one lives in a throw-away tree).
#
# What is proven:
#   1. the run-directory library never reuses or cleans an existing directory, and cannot be steered
#      outside its base by a hostile token;
#   2. the REAL wrapper, run in a sandbox that already contains a previous run's artifact at the OLD
#      fixed path, (a) refuses to run on a workflow/server SHA mismatch without creating anything,
#      (b) when it fails early after creating its run directory, still produces an artifact that
#      contains ONLY this execution's files and identity — none of the stale files;
#   3. regression guards on the workflow/wrapper text (fixed path gone, `bash` invocation, validator
#      before upload) and on the wrapper's executable bit in git.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WRAPPER="$REPO/deploy/staging/run-stage-5-17-c-browser-qa.sh"
LIB="$REPO/deploy/staging/lib/stage-5-17-c-run-dir.sh"
WORKFLOW="$REPO/.github/workflows/stage-5-17-c-home-admin-browser-qa.yml"

PASS=0
FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  ok   - $1"; }
bad()  { FAIL=$((FAIL + 1)); echo "  FAIL - $1"; }
check() { # check "<description>" <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else bad "$desc"; fi
}
check_not() { # inverse
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then bad "$desc"; else ok "$desc"; fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "# 1. run-directory library"
# shellcheck source=../lib/stage-5-17-c-run-dir.sh
. "$LIB"

BASE="$TMP/base"
mkdir -p "$BASE/artifact" "$BASE/run-old"
echo stale > "$BASE/artifact/stage-5-17-c-report.txt"
echo stale > "$BASE/run-old/state.json"

d1="$(fresh_run_dir "$BASE" "123-1" 2>/dev/null)"
check "creates a new directory for a new token" test -d "$d1"
check "the new directory is EMPTY (nothing inherited)" test -z "$(ls -A "$d1")"
check "the new directory lives under run-<token>" test "$d1" = "$BASE/run-123-1"
check_not "refuses to reuse an existing run directory (same token)" fresh_run_dir "$BASE" "123-1"
d2="$(fresh_run_dir "$BASE" "123-2" 2>/dev/null)"
check "a different token gets a different directory" test "$d2" != "$d1" -a -d "$d2"
check "the previous run's directory was left untouched" test -f "$BASE/run-old/state.json"
check "the OLD fixed artifact path was left untouched and is not inside the new directory" test -f "$BASE/artifact/stage-5-17-c-report.txt" -a ! -e "$d1/artifact"
check_not "an empty token is rejected" fresh_run_dir "$BASE" ""
evil="$(fresh_run_dir "$BASE" "../../escape" 2>/dev/null)"
check "a hostile token cannot escape the base directory" test "${evil#"$BASE"/run-}" != "$evil" -a "$(dirname "$evil")" = "$BASE"
check "default_run_token keeps the workflow token" test "$(default_run_token "99-2")" = "99-2"
check "default_run_token makes a manual token when none is given" test "$(default_run_token "" | cut -c1-7)" = "manual-"

echo "# 2. the real wrapper in a sandbox"
mk_sandbox() { # $1 = dir
  local s="$1"
  mkdir -p "$s/deploy/staging/lib" "$s/bin"
  cp "$WRAPPER" "$s/deploy/staging/run-stage-5-17-c-browser-qa.sh"
  cp "$LIB" "$s/deploy/staging/lib/stage-5-17-c-run-dir.sh"
  echo "ADMIN_SEED_EMAIL=x@example.invalid" > "$s/deploy/staging/.env.staging"
  echo "ADMIN_SEED_PASSWORD=not-a-real-password" >> "$s/deploy/staging/.env.staging"
  : > "$s/deploy/staging/docker-compose.staging.yml"
  git -C "$s" init -q
  git -C "$s" -c user.name=t -c user.email=t@example.invalid add -A >/dev/null 2>&1
  git -C "$s" -c user.name=t -c user.email=t@example.invalid commit -q -m sandbox
  # A fake docker: records that it was called and always fails. The wrapper must never get past its build step.
  printf '#!/usr/bin/env bash\necho "$*" >> "%s/docker-calls.log"\nexit 1\n' "$s" > "$s/bin/docker"
  chmod +x "$s/bin/docker"
}

SB="$TMP/sandbox"
mk_sandbox "$SB"
SB_SHA="$(git -C "$SB" rev-parse HEAD)"
SB_BASE="$TMP/sandbox-reports"
mkdir -p "$SB_BASE/artifact"
echo "STALE run #1 report — must never appear anywhere" > "$SB_BASE/artifact/stage-5-17-c-report.txt"
echo '{"runId":"OLD_RUN"}' > "$SB_BASE/artifact/setup-result.json"

# 2a. workflow SHA != server SHA: refuse, create nothing.
out="$(PATH="$SB/bin:$PATH" STAGE517C_REPORT_BASE="$SB_BASE" STAGE517C_WORKFLOW_SHA="deadbeef" STAGE517C_WORKFLOW_RUN_ID="7-1" \
  bash "$SB/deploy/staging/run-stage-5-17-c-browser-qa.sh" 2>&1)"; code=$?
check "SHA mismatch: exits non-zero" test "$code" -ne 0
check "SHA mismatch: says PROVENANCE MISMATCH" bash -c "echo \"\$1\" | grep -q 'PROVENANCE MISMATCH'" _ "$out"
check_not "SHA mismatch: creates NO run directory" test -e "$SB_BASE/run-7-1"
check_not "SHA mismatch: never calls docker" test -e "$SB/docker-calls.log"
check "SHA mismatch: the stale artifact is untouched (and is not where this run would ever look)" test -f "$SB_BASE/artifact/stage-5-17-c-report.txt"

# 2b. matching SHA, but the run fails at the docker build: it must still finalize into ITS OWN directory only.
out="$(PATH="$SB/bin:$PATH" STAGE517C_REPORT_BASE="$SB_BASE" STAGE517C_WORKFLOW_SHA="$SB_SHA" STAGE517C_WORKFLOW_RUN_ID="8-1" \
  bash "$SB/deploy/staging/run-stage-5-17-c-browser-qa.sh" 2>&1)"; code=$?
RUN8="$SB_BASE/run-8-1"
check "early failure: exits non-zero" test "$code" -ne 0
check "early failure: created its own run directory" test -d "$RUN8"
check "early failure: wrote run-manifest.json with the workflow ids" bash -c "grep -q '\"workflowRunId\": \"8-1\"' \"\$1\" && grep -q \"\\\"workflowSha\\\": \\\"$SB_SHA\\\"\" \"\$1\"" _ "$RUN8/run-manifest.json"
check "early failure: staged an artifact-manifest.json for THIS run" bash -c "grep -q '\"workflowRunId\": \"8-1\"' \"\$1\"" _ "$RUN8/artifact/artifact-manifest.json"
check "early failure: artifact-manifest records finalExit 1" bash -c "grep -q '\"finalExit\": 1' \"\$1\"" _ "$RUN8/artifact/artifact-manifest.json"
check_not "early failure: NO stale report leaked into this run's artifact" test -e "$RUN8/artifact/stage-5-17-c-report.txt"
check_not "early failure: NO stale setup-result leaked into this run's artifact" test -e "$RUN8/artifact/setup-result.json"
check "early failure: the artifact holds only this run's manifests" test "$(ls "$RUN8/artifact" | sort | tr '\n' ' ')" = "artifact-manifest.json run-manifest.json "
check "the old fixed-path artifact is still exactly as it was (it is simply never read)" test "$(cat "$SB_BASE/artifact/setup-result.json")" = '{"runId":"OLD_RUN"}'

# 2c. the validator would refuse that early-failure artifact (it has no report/setup), so it can never be uploaded as a result.
node "$REPO/deploy/staging/qa/validate-stage-5-17-c-artifact.js" "$RUN8/artifact" --workflow-sha "$SB_SHA" --workflow-run-id "8-1" >/dev/null 2>&1
check "validator rejects an early-failure artifact that has no report" test "$?" -ne 0

# 2d. a second, distinct run does not see the first one's files.
PATH="$SB/bin:$PATH" STAGE517C_REPORT_BASE="$SB_BASE" STAGE517C_WORKFLOW_SHA="$SB_SHA" STAGE517C_WORKFLOW_RUN_ID="9-1" \
  bash "$SB/deploy/staging/run-stage-5-17-c-browser-qa.sh" >/dev/null 2>&1
check "run 9-1 has its own directory" test -d "$SB_BASE/run-9-1"
check_not "run 9-1 contains nothing from run 8-1 (its manifests never name 8-1)" grep -q '"workflowRunId": "8-1"' "$SB_BASE/run-9-1/run-manifest.json" "$SB_BASE/run-9-1/artifact/artifact-manifest.json"
check "run 9-1's manifest names run 9-1, not 8-1" bash -c "grep -q '\"workflowRunId\": \"9-1\"' \"\$1\"" _ "$SB_BASE/run-9-1/artifact/artifact-manifest.json"

# 2e. re-running the SAME workflow run id (e.g. a manual re-execution of an identical token) is refused, never merged.
out="$(PATH="$SB/bin:$PATH" STAGE517C_REPORT_BASE="$SB_BASE" STAGE517C_WORKFLOW_SHA="$SB_SHA" STAGE517C_WORKFLOW_RUN_ID="9-1" \
  bash "$SB/deploy/staging/run-stage-5-17-c-browser-qa.sh" 2>&1)"; code=$?
check "reusing an existing run token is refused" test "$code" -ne 0
check "reuse refusal explains why" bash -c "echo \"\$1\" | grep -q 'already exists'" _ "$out"

echo "# 3. regression guards on the committed text"
check_not "wrapper no longer 'cleans' a shared directory with find … rm -rf" grep -q 'find "\$RUN_DIR"' "$WRAPPER"
check_not "wrapper no longer hides deletion failures with 2>/dev/null on a clean-up" grep -Eq 'exec rm -rf .*2>/dev/null' "$WRAPPER"
check_not "wrapper does not name the old fixed artifact path" grep -q '/tmp/stage-5-17-c/artifact' "$WRAPPER"
check_not "workflow does not fetch the old fixed artifact path" grep -q '/tmp/stage-5-17-c/artifact' "$WORKFLOW"
check "workflow fetches the per-run directory" grep -q 'run-\${RUN_TOKEN}/artifact' "$WORKFLOW"
check "workflow starts the wrapper with bash (not the executable bit)" grep -q 'bash ./deploy/staging/run-stage-5-17-c-browser-qa.sh' "$WORKFLOW"
check_not "workflow does not execute the wrapper directly as ./deploy/…" grep -Eq '(^|[^h] )\./deploy/staging/run-stage-5-17-c-browser-qa.sh' "$WORKFLOW"
check "workflow passes the workflow run id to the wrapper" grep -q 'STAGE517C_WORKFLOW_RUN_ID=\$RUN_TOKEN' "$WORKFLOW"
validate_line="$(grep -n 'validate-stage-5-17-c-artifact.js' "$WORKFLOW" | head -1 | cut -d: -f1)"
upload_line="$(grep -n 'actions/upload-artifact' "$WORKFLOW" | head -1 | cut -d: -f1)"
check "workflow validates the artifact BEFORE uploading it" test -n "$validate_line" -a -n "$upload_line" -a "${validate_line:-0}" -lt "${upload_line:-0}"
check "workflow uploads only the validated directory" grep -q 'path: stage-5-17-c-artifacts/' "$WORKFLOW"

if git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  mode="$(git -C "$REPO" ls-files --stage -- deploy/staging/run-stage-5-17-c-browser-qa.sh | cut -c1-6)"
  check "wrapper is tracked as executable (100755), like the 5.16-E wrapper (was 100644)" test "$mode" = "100755"
fi

echo
echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]
