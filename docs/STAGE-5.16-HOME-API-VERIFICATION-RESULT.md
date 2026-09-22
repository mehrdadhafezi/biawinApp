# STAGE 5.16-C — Home Backend API-Only Verification: RESULT

**Final status: PARTIAL PASS.** Every check reachable without admin credentials passes on real staging with no 5xx and no protected-data change. Every check that requires an authenticated admin session — all of §7–§12 of the task (400/409/422 validation, reorder, soft-deleted-media fixture, media-delete protection) — is **BLOCKED**: this environment has no `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` or any other admin token, and the task explicitly forbids requesting personal credentials from the user. Nothing was fabricated in their place.

## 1. Commit verified
`299a41a` (as stated in the task; not independently re-derived — I have no way to query the running container's version from this sandbox).

## 2. Deployment status
Reported by the task as: staging deploy PASS; backend healthy on `127.0.0.1:4001`, web on `127.0.0.1:3001`, admin on `127.0.0.1:3002` (these are the server's own loopback ports, not reachable from here). I verified the **public** side of that claim directly: `https://api-staging.biawin.ir` answered every request below with `200`/`401` as expected and no 5xx.

## 3. API base URL used
`https://api-staging.biawin.ir` (public internet, matches every prior stage's convention). No localhost/loopback URL was reachable or used.

## 4. GET endpoint verification — **PASS**
| Endpoint | HTTP | Envelope | Count | Order | Image |
|---|---|---|---|---|---|
| `GET /api/v1/home/hero-cards` | 200 | `{success:true,data:[...]}` | **3** | sortOrder 0,1,2 | n/a (no media field) |
| `GET /api/v1/home/service-banners` | 200 | same | **5** | sortOrder 0..4 | every `image` a resolved `https://api-staging.biawin.ir/api/v1/media/...` URL, none `null` |
| `GET /api/v1/home/service-mosaic-tiles` | 200 | same | **4** (2 half + 2 wide) | sortOrder 0..3 | every `image` resolved, none `null`; `title`/`lead` correctly `null` on `half` rows |
| `GET /api/v1/home/news-articles` | 200 | same | **8** | sortOrder 0..7 | every `image` resolved |
| same, with an unknown query param (`?x=1`) | 200 | unchanged | 3 | unchanged | — (confirms extra params are still ignored, no regression) |

Matches the known baseline (3/5/4/8) exactly. No malformed response, no unexpected field, no 5xx anywhere. Required fields present on every row (`id`, `sortOrder`, entity-specific fields per `docs/STAGE-5.15-HOME-ADMIN-CONTRACT-ANALYSIS.md` §4–§7).

## 5. Validation verification — **BLOCKED** (see §14)
Could not be exercised: every write/validation path lives under `/api/v1/admin/home/**`, gated by `AdminJwtAuthGuard` + `AdminRolesGuard` at the controller level (`backend/src/modules/home/home-*-admin.controller.ts`). No public route accepts a Home write.

## 6. 400 cases — **BLOCKED**, with one finding
- I confirmed empirically that on this codebase's pipeline, **Guards run before Pipes** (standard NestJS order — Middleware → Guards → Interceptors → Pipes → Handler). I sent `GET /api/v1/admin/home/hero-cards/not-a-uuid` with no `Authorization` header: response was `401 UNAUTHORIZED`, not `400`.
- **Consequence:** the malformed-UUID → 400 behavior added in Stage 5.16-B (`ParseUUIDPipe` on the four admin `:id` routes) **cannot be observed without a valid admin token** — an unauthenticated malformed-id request always short-circuits at 401 first. This is expected and correct (auth should fail closed before validation), not a defect; I note it because the task asked for this exact case and the honest result is that it needs a token to prove.
- Reorder's 400 cases (empty payload, malformed uuid, duplicate ids, duplicate positions) are on the same guarded routes → also BLOCKED for the same reason. I sent an empty-payload reorder request with no token and got `401`, confirming the same guard-first behavior.

## 7. 409 cases — **BLOCKED**
Duplicate `cardKey` and duplicate `bodySlug` both require an authenticated `POST`/`PUT` on `/admin/home/hero-cards` or `/admin/home/news-articles`. No admin token available.

## 8. 422 cases — **BLOCKED**
Unknown `categoryId` and unknown `mediaAssetId` both require an authenticated write on a banner/mosaic/news admin route. No admin token available.

## 9. Reorder verification — **BLOCKED**
All six sub-cases (empty, malformed uuid, duplicate ids, duplicate positions, unknown id, valid partial reorder) require `PATCH /admin/home/<resource>/reorder` with a valid admin token. Only the unauthenticated empty-payload probe was run, and it returned 401 (§6) — it does not exercise the DTO validation itself.

## 10. Soft-deleted media verification — **NOT RUN**
- Read-only observation: **no existing staging row currently references a soft-deleted MediaAsset** — every `image` field in §4's four responses resolved to a real URL. This matches the pre-flight's "soft-deleted media rows = 0" and means there is no live case to read.
- Creating one requires: (a) an admin-authenticated upload + soft-delete of a disposable media asset, or (b) attaching a Home row to one — both are authenticated admin mutations. No isolated fixture mechanism exists that does this without a token (the only such mechanism, `authenticated-qa-runner.ts`, is itself out of scope for this stage and also needs `ADMIN_SEED_*`).
- Per the task's fixture-safety order (A/B/C/D): options A and B don't exist without credentials, C (create-and-cleanup) can't be attempted without credentials either, so this falls to **D: NOT RUN**, not "assumed pass."

## 11. Media deletion protection — **NOT RUN**
Same reasoning as §10: `DELETE /admin/media/:id` is authenticated and mutating. No disposable fixture can be created without an admin token. Marked **NOT RUN — no safe isolated staging fixture available (requires admin authentication, which is not available in this environment).**

## 12. Image integrity checksums
| Table | Checksum given in the task (staging, after deploy) | Independently reproduced here? |
|---|---|---|
| card_products | `3820a5b2562c2f49e4022d8a2ef8d413` | No — matches the Stage 5.16-B BEFORE value exactly (see `docs/STAGE-5.16-HOME-BACKEND-HARDENING-RESULT.md` §3) |
| category_cards | `a1810c0e7e050f9b0000327c3c8b8b9d` | No — matches BEFORE |
| categories | `e7dd7c01de3c76c8fd0460a3116a27b6` | No — matches BEFORE |
| services | `5c75a0e357a7b4a0870ddb52cbed1d84` | No — matches BEFORE |
| services.gallery | `1426eb78c0855edcd8c633c881dcde12` | No — matches BEFORE |

I have no staging database access from this sandbox (no SSH, no DB credentials), so these five values are **recorded as supplied**, not recomputed by me — exactly as the Stage 5.16-B BEFORE baseline itself was recorded as supplied. What I can and did confirm independently: all four public `image` URLs on service banners and mosaic tiles (which are resolved from `MediaAsset.key`, itself downstream of the same rows these checksums cover) still load with `200` and correct `Content-Type`/`Cross-Origin-Resource-Policy` headers (spot-checked one, §13), consistent with the underlying media rows being unchanged.

Byte-for-byte comparison: the five values supplied for "after" are identical, character for character, to the five values recorded as "before" in the Stage 5.16-B result doc. **No difference → no FAIL trigger.**

## 13. Additional read-only checks performed
- Unauthenticated request to `GET /api/v1/admin/home/hero-cards` → `401 UNAUTHORIZED`, same Persian message as before Stage 5.16-B (`AdminJwtAuthGuard` unchanged).
- Unauthenticated `DELETE /api/v1/admin/media/00000000-0000-4000-8000-000000000000` → `401` (guard-first, confirms the media-delete route is still gated the same way; does not test the 409 logic itself).
- `HEAD`/`GET` on a live media URL (`.../media/5191ba0c-....webp`) → `200`, `Content-Type: image/webp`, `Cross-Origin-Resource-Policy: cross-origin` present (Stage 5.21/R5.26.2 CORP fix still intact, no regression).
- No 5xx observed on any request in this session.

## 14. Tests NOT RUN / BLOCKED and reasons
| Task item | Status | Reason |
|---|---|---|
| Malformed UUID → 400 | **BLOCKED** | Requires an authenticated request to reach the pipe; unauthenticated always returns 401 first (§6) |
| Duplicate cardKey → 409 | **BLOCKED** | Requires `POST/PUT /admin/home/hero-cards` with a valid admin token |
| Duplicate bodySlug → 409 | **BLOCKED** | Requires `POST/PUT /admin/home/news-articles` with a valid admin token |
| Unknown category → 422 | **BLOCKED** | Requires an authenticated banner/mosaic write |
| Unknown media → 422 | **BLOCKED** | Requires an authenticated write |
| Reorder: empty/malformed/dup-id/dup-position/unknown-id/valid-partial | **BLOCKED** | Requires `PATCH /admin/home/<resource>/reorder` with a valid admin token |
| Soft-deleted media → `image: null` | **NOT RUN** | No existing case on staging; creating one needs an authenticated fixture, none available |
| Media deletion protection → 409 | **NOT RUN** | Destructive + authenticated; no safe disposable fixture available without a token |
| Browser QA / Playwright / Puppeteer / `authenticated-qa-runner.ts` | **NOT RUN** | Explicitly out of scope for this stage, per instructions |

**Root cause for every BLOCKED/NOT RUN item:** this sandbox has no `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` (confirmed absent from the shell environment) and no other admin token source; `deploy/staging/.env.staging.example` contains only a placeholder (`REPLACE_WITH_RANDOM_SECRET`), not a real credential. The task explicitly prohibits requesting personal credentials from the user, printing secrets, or bypassing authentication, so these cases were left exactly as BLOCKED/NOT RUN rather than worked around.

## 15. What was actually proven where
| Claim | Proven by real staging HTTP in this session | Proven only by unit tests (Stage 5.16-B, mocked Prisma) |
|---|---|---|
| Public Home GET endpoints healthy, correct shape/count/order/images | ✅ | — |
| No 5xx anywhere reachable | ✅ | — |
| Extra query params still ignored | ✅ | — |
| Admin routes still gated by `AdminJwtAuthGuard` (401 without a token) | ✅ | — |
| Media serving route (CORP header, content-type) unaffected | ✅ | — |
| `ParseUUIDPipe` → 400 on malformed admin `:id` | ❌ not observable without a token | ✅ (`home-dto-validation.spec.ts`) |
| Duplicate `cardKey`/`bodySlug` → 409 | ❌ | ✅ (`home-hardening.service.spec.ts`, `home-write.util.spec.ts`) |
| Unknown category/media → 422 | ❌ | ✅ (same files) |
| Reorder validation (dup ids/positions, unknown id, partial semantics) | ❌ | ✅ (same files) |
| Soft-deleted media → `image: null` | ❌ (no live case exists to observe) | ✅ (`home-hardening.service.spec.ts`) |
| Media delete blocked when referenced | ❌ | ✅ (`media.service.spec.ts`) |
| No protected image reference is ever written by this code | Partial — checksums supplied unchanged (§12), not independently recomputed | ✅ (static guard, `home-image-integrity.spec.ts`) |

## 16. Final decision

**Not PASS. Not FAIL. PARTIAL** — per the task's own rule: *"If a destructive check cannot safely be performed because no isolated fixture exists, mark that check NOT RUN and explicitly state that the Stage 5.16 API verification is PARTIAL rather than claiming full PASS."*

Grounds:
- Every check that **could** be run without credentials passed: all GET endpoints healthy, no 5xx, admin routes still correctly gated, image checksums unchanged (as supplied), no business data touched, no Browser QA run.
- Every check requiring admin authentication (§5–§11, i.e. most of the task's numbered list) is BLOCKED or NOT RUN for a stated, non-workaround-able reason: no admin credentials in this environment, and the task forbids obtaining them from the user.
- **No code was changed in this stage.** No defect in `299a41a` was found by what could actually be tested; nothing here justifies a code change, and none was made.

To move any BLOCKED/NOT RUN item to PASS, an admin session is required — either `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` provided through the deployment's own secret store (not typed into chat), or someone with staging access running the same requests and reporting the results back.
