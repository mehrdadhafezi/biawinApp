#!/usr/bin/env bash
# Stage 5.17-H — regression test for the workflow failure of run 36431345860:
#
#   Error: Unable to process file command 'output' successfully.
#   Error: Invalid format '  (use "git pull" to update your local branch)'
#
# Cause: the workflow captured the WHOLE stdout of a remote `git fetch && git checkout … && git rev-parse`
# into a shell variable and echoed it into $GITHUB_OUTPUT. git's own messages ("From github.com/…",
# "Already on 'main'", "(use "git pull" …)") made that value multi-line, i.e. an invalid output file.
#
#   bash deploy/staging/tests/stage-5-17-c-workflow-ssh-output.test.sh
#
# Needs only bash + coreutils. No network, no ssh, no docker, no real git (a fake `git` is used).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
REMOTE="$REPO/deploy/staging/lib/stage-5-17-c-remote-checkout.sh"
WORKFLOW="$REPO/.github/workflows/stage-5-17-c-home-admin-browser-qa.yml"

PASS=0
FAIL=0
ok()  { PASS=$((PASS + 1)); echo "  ok   - $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL - $1"; }
check()     { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
check_not() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then bad "$d"; else ok "$d"; fi; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Emulates the runner's rules for a $GITHUB_OUTPUT file: every line is `name=value`, or a
# `name<<DELIM … DELIM` block; anything else is "Invalid format '<line>'".
gh_output_valid() { # $1 = file; prints the offending line on failure
  local delim="" line
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -n "$delim" ]; then
      [ "$line" = "$delim" ] && delim=""
      continue
    fi
    [ -z "$line" ] && continue
    if [[ "$line" =~ ^[^=\<]+\<\<(.+)$ ]]; then delim="${BASH_REMATCH[1]}"; continue; fi
    if [[ "$line" =~ ^[^=]+= ]]; then continue; fi
    echo "Invalid format '$line'"
    return 1
  done < "$1"
  [ -z "$delim" ] || { echo "Matching delimiter not found '$delim'"; return 1; }
}

contains() { printf '%s' "$1" | grep -Eq -- "$2"; } # contains "<text>" "<ERE>"

mkdir -p "$TMP/bin" "$TMP/repo"
cat > "$TMP/bin/git" <<'GIT'
#!/usr/bin/env bash
# fake git that prints exactly the kind of chatter real git prints on stdout
[ "${FAKE_FAIL:-}" = "$1" ] && { echo "fatal: simulated failure of git $1" >&2; exit 1; }
case "$1" in
  fetch)     echo "From github.com/mehrdadhafezi/biawinApp"
             echo " * branch            main       -> FETCH_HEAD"
             echo "   458763f..251a8a8  main       -> origin/main" ;;
  checkout)  echo "Already on 'main'"
             echo "Your branch is behind 'origin/main' by 3 commits, and can be fast-forwarded."
             echo '  (use "git pull" to update your local branch)' ;;
  reset)     echo "HEAD is now at ${FAKE_SHA:0:7} some commit message" ;;
  rev-parse) echo "$FAKE_SHA" ;;
esac
GIT
chmod +x "$TMP/bin/git"

GOOD=251a8a8aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
OTHER=458763fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
NOISE='Already on .main.|use "git pull"|From github.com'

run_remote() { # run_remote <expected> [ENV=VAL ...]  — runs the remote script against the fake git
  local expected="$1"; shift
  ( cd "$TMP" && env PATH="$TMP/bin:$PATH" STAGE517C_SERVER_REPO="$TMP/repo" "$@" bash "$REMOTE" "$expected" 2>&1 )
}

echo "# 1. the failure mode itself (proves this test can detect it)"
OLD_OUT="$TMP/old-github-output"
: > "$OLD_OUT"
server_sha="$(PATH="$TMP/bin:$PATH" FAKE_SHA="$GOOD" bash -c 'git fetch && git checkout main && git reset --hard origin/main && git rev-parse HEAD')"
echo "sha=$server_sha" >> "$OLD_OUT" # <- the pre-fix workflow line
check_not "OLD pattern (remote stdout captured into \$GITHUB_OUTPUT) yields an INVALID output file" gh_output_valid "$OLD_OUT"
msg="$(gh_output_valid "$OLD_OUT" 2>&1)"
check "…reported as 'Invalid format', like the real run" contains "$msg" 'Invalid format'

echo "# 2. the fixed remote script, fed the same noisy git output"
GH_OUT="$TMP/new-github-output"
: > "$GH_OUT"
out="$(run_remote "$GOOD" FAKE_SHA="$GOOD" GITHUB_OUTPUT="$GH_OUT")"; code=$?
check "matching SHA: exit 0" test "$code" -eq 0
check "the noisy git lines are ordinary log output (they reach the job log)" contains "$out" "$NOISE"
check "\$GITHUB_OUTPUT was never written" test ! -s "$GH_OUT"
check "…and is a valid output file" gh_output_valid "$GH_OUT"
check "both SHAs are printed for the log" contains "$out" "server checkout is at: $GOOD"

out="$(run_remote "$GOOD" FAKE_SHA="$OTHER")"; code=$?
check "server at a different commit: exit 42 (fail closed)" test "$code" -eq 42
check "…with PROVENANCE MISMATCH in the log" contains "$out" 'PROVENANCE MISMATCH'

run_remote "$GOOD" FAKE_SHA="$GOOD" FAKE_FAIL=fetch >/dev/null; code=$?
check "a failing 'git fetch' fails the script (neither 0 nor 42)" test "$code" -ne 0 -a "$code" -ne 42
run_remote "$GOOD" FAKE_SHA="$GOOD" FAKE_FAIL=checkout >/dev/null; code=$?
check "a failing 'git checkout' fails the script" test "$code" -ne 0 -a "$code" -ne 42
run_remote "$GOOD" FAKE_SHA="$GOOD" FAKE_FAIL=reset >/dev/null; code=$?
check "a failing 'git reset' fails the script" test "$code" -ne 0 -a "$code" -ne 42

forty_g="$(printf 'G%.0s' $(seq 1 40))"
for bad_arg in "abc" "$forty_g" "$GOOD; rm -rf /" "${GOOD^^}" "${GOOD}0"; do
  run_remote "$bad_arg" FAKE_SHA="$GOOD" >/dev/null; code=$?
  check "malformed expected SHA '${bad_arg:0:14}' is rejected (exit 2)" test "$code" -eq 2
done
( cd "$TMP" && env PATH="$TMP/bin:$PATH" STAGE517C_SERVER_REPO="$TMP/repo" FAKE_SHA="$GOOD" bash "$REMOTE" ) >/dev/null 2>&1; code=$?
check "no argument at all is rejected (exit 2)" test "$code" -eq 2

echo "# 3. the workflow text (comment lines ignored)"
CODE="$TMP/workflow.code"
grep -v '^[[:space:]]*#' "$WORKFLOW" > "$CODE"
check_not "no step output / \$GITHUB_OUTPUT is used anywhere" grep -q 'GITHUB_OUTPUT' "$CODE"
check_not "no step consumes another step's outputs (steps.*)" grep -q 'steps\.' "$CODE"
check_not "no ssh output is captured with \$(ssh …) or backticks" grep -Eq '\$\( *ssh|`ssh' "$CODE"
check "the checkout step streams the remote script over ssh from the runner's checkout" grep -Fq 'bash -s -- $WORKFLOW_SHA" < deploy/staging/lib/stage-5-17-c-remote-checkout.sh' "$CODE"
check "the workflow checks out the dispatched commit (so the streamed script is that commit's)" grep -q 'actions/checkout@v4' "$CODE"
check "workflow_dispatch is the only trigger" grep -q '^  workflow_dispatch:' "$CODE"
check_not "no push / pull_request / schedule / workflow_run trigger" grep -Eq '^  (push|pull_request|pull_request_target|schedule|workflow_run):' "$CODE"
check "the wrapper still receives the workflow SHA and run id" grep -Fq 'STAGE517C_WORKFLOW_SHA=$WORKFLOW_SHA STAGE517C_WORKFLOW_RUN_ID=$RUN_TOKEN' "$CODE"
check "the wrapper is still started with bash" grep -q 'bash ./deploy/staging/run-stage-5-17-c-browser-qa.sh' "$CODE"
check_not "no fixed /tmp artifact directory" grep -q '/tmp/stage-5-17-c/artifact' "$CODE"
check "the per-run artifact path is fetched" grep -Fq 'run-${RUN_TOKEN}/artifact' "$CODE"
check "artifact validation still runs" grep -q 'validate-stage-5-17-c-artifact.js' "$CODE"
vline="$(grep -n 'validate-stage-5-17-c-artifact.js' "$CODE" | head -1 | cut -d: -f1)"
uline="$(grep -n 'actions/upload-artifact' "$CODE" | head -1 | cut -d: -f1)"
check "…and it runs before the upload" test -n "$vline" -a -n "$uline" -a "${vline:-0}" -lt "${uline:-0}"
check_not "no deploy / restart / authenticated-qa-runner in the workflow" grep -Eiq 'deploy\.sh|docker (compose )?(restart|up|down)|systemctl|authenticated-qa-runner|run-authenticated-qa' "$CODE"
check_not "the ssh checkout no longer inlines git commands in the workflow" grep -Eq 'git (fetch|checkout|reset)' "$CODE"

echo
echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]
