# Stage 5.22 authenticated staging QA — browser/visual layer.
#
# Deliberately NOT based on backend's node:20-alpine image: Playwright's
# Chromium binary needs glibc, and does not run reliably on Alpine's musl
# libc. The official Playwright image is Debian/Ubuntu-based (glibc) and
# ships Chromium + every system dependency it needs already installed and
# version-matched — this is the standard, supported way to run Playwright
# in a container. The npm `playwright` version pinned in package.json
# (1.48.2) MUST match this image tag's version exactly, or the installed
# browser binary and the driver talking to it will disagree.
#
# Build context MUST be this directory (deploy/staging/qa/browser), not
# the repo root — this image is fully self-contained and isolated from
# backend/apps/*'s own package.json on purpose (a throwaway QA tool has no
# business in the application's own dependency tree):
#   docker build -f deploy/staging/qa/browser/Dockerfile deploy/staging/qa/browser

FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /qa

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY browser-qa.ts ./

CMD ["npm", "run", "qa"]
