// eslint-disable-next-line @typescript-eslint/no-require-imports -- next/jest's documented usage is CommonJS; jest.config.js itself isn't part of the Next.js app build.
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/**
 * `testEnvironment` intentionally left at Jest's default ("node"), not
 * `jest-environment-jsdom` — this app's tests deliberately avoid needing a
 * real DOM (see each test file's own comment for why: the npm registry was
 * unreachable for `jest-environment-jsdom`/`@testing-library/*` for the
 * entire implementation window, confirmed independent of any one package,
 * same class of constraint as Stage 5.16's bcrypt→scrypt substitution).
 * Testable logic is exported as plain functions and unit-tested directly;
 * one rendering smoke test per component uses `react-dom/server`'s
 * `renderToStaticMarkup`, which needs no DOM at all.
 *
 * @type {import('jest').Config}
 */
const config = {
  setupFiles: ["<rootDir>/jest.env-setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Map straight to source rather than through pnpm's node_modules
    // symlinks — avoids next/jest's default transformIgnorePatterns
    // excluding these workspace packages' untranspiled TS.
    "^@biawin/ui$": "<rootDir>/../../packages/ui/src/index.ts",
    "^@biawin/types$": "<rootDir>/../../packages/types/src/index.ts",
  },
};

module.exports = createJestConfig(config);
