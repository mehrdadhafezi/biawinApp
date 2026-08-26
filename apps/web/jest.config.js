// eslint-disable-next-line @typescript-eslint/no-require-imports -- next/jest's documented usage is CommonJS; jest.config.js itself isn't part of the Next.js app build.
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/**
 * `testEnvironment` intentionally left at Jest's default ("node"), not
 * `jest-environment-jsdom` — mirrors `apps/admin/jest.config.js` exactly
 * (Stage 5.17), same underlying reason: the npm registry has been
 * unreachable for `jest-environment-jsdom`/`@testing-library/*` for this
 * entire engagement. Testable logic is exported as plain functions and
 * unit-tested directly; one rendering smoke test per component uses
 * `react-dom/server`'s `renderToStaticMarkup`, which needs no DOM at all.
 *
 * @type {import('jest').Config}
 */
const config = {
  setupFiles: ["<rootDir>/jest.env-setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@biawin/ui$": "<rootDir>/../../packages/ui/src/index.ts",
    "^@biawin/types$": "<rootDir>/../../packages/types/src/index.ts",
  },
};

module.exports = createJestConfig(config);
