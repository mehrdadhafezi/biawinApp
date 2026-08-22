# 09 — Git Workflow

## Repository

- GitHub: [mehrdadhafezi/biawinApp](https://github.com/mehrdadhafezi/biawinApp)
- Main branch: `main` (protected in intent — all work should land here via a
  reviewed change, not force-pushed)

## What never gets committed

Enforced by `.gitignore` (root, plus `apps/web/.gitignore` / `apps/mobile/.gitignore`
for their own build artifacts):

- Any `.env*` file **except** `*.env.example` (`backend/.env`,
  `apps/web/.env.local`, `deploy/staging/.env.staging`, etc. are all ignored;
  their matching `.env.example` files are the only ones ever committed)
- `.claude/` (local assistant workspace)
- `node_modules/`, `.next/`, `dist/`, `build/`, `.expo/`, `.turbo/`, `coverage/`
- Anything matching `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials.json`, `secrets.*`

Before any commit that touches env-related files, re-run:

```bash
git status --short
git diff --cached --name-only | grep -E "(^|/)\.env$" # should print nothing
```

## Local development → first push (what already happened)

1. `git branch -m master main`
2. `git remote add origin https://github.com/mehrdadhafezi/biawinApp.git`
3. `git add -A` then a manual review of `git status`/`git diff --cached
   --name-only` to confirm no secrets are staged
4. `git commit -m "chore: initialize Biawin production foundation"`
5. `git push -u origin main`

## Adding the staging deploy secrets (needed for `deploy-staging.yml`)

The manual-dispatch deploy workflow (`.github/workflows/deploy-staging.yml`)
needs four repository secrets before it can run. In GitHub: **Settings →
Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `STAGING_SSH_HOST` | `62.204.61.18` |
| `STAGING_SSH_PORT` | `2490` |
| `STAGING_SSH_USER` | `root` |
| `STAGING_SSH_PRIVATE_KEY` | private half of a **dedicated** deploy keypair (see below) — never a personal key |

Generate a dedicated keypair (don't reuse any existing personal/other-project
key):

```bash
ssh-keygen -t ed25519 -f biawin_staging_deploy_ed25519 -N "" -C "biawin-staging-deploy"
```

Add the **public** half to the server's `root` user
`~/.ssh/authorized_keys`, and paste the **private** half as the
`STAGING_SSH_PRIVATE_KEY` GitHub secret. Until these four secrets exist, the
workflow's guard step fails fast with a clear error instead of doing
anything — see [10-release-process.md](10-release-process.md).

## Day-to-day flow (target end state)

```
local commit → git push origin main → CI (lint/typecheck/test/build)
                                     → (manual, for now) Deploy Staging workflow
```

No one should need to run more than `git push` locally; everything else is
either automatic (CI) or a single manual trigger (staging deploy) once the
secrets above are in place.
