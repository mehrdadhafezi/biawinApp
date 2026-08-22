// Replaces the deprecated `package.json#prisma` key (removed in this commit).
// See: https://pris.ly/prisma-config
//
// @prisma/config explicitly does NOT auto-load .env when reading this file
// (it disables dotenv while parsing prisma.config.ts itself), so schema.prisma's
// `env("DATABASE_URL")` would otherwise resolve to undefined. Loading dotenv here
// keeps the exact same behavior the old package.json#prisma config had.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node --compiler-options {"module":"commonjs"} prisma/seed.ts',
  },
});
