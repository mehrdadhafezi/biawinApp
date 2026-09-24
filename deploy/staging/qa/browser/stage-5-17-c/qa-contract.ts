/**
 * LOCAL TYPECHECK SHIM ONLY. `deploy/staging/run-stage-5-17-c-browser-qa.sh` overwrites this file
 * with the real backend/scripts/staging-qa/stage-5-17-c/qa-contract.ts inside a temporary Docker
 * build context, so the verifier and the tested contract are literally the same code (no copy is committed).
 */
export * from '../../../../../backend/scripts/staging-qa/stage-5-17-c/qa-contract';
