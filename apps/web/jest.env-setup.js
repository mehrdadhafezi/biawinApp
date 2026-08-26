// `next/jest` transpiles the app the same way `next build`/`next dev` do,
// but does NOT replicate Next's runtime .env.local loading for the Jest
// process itself — set the one required NEXT_PUBLIC_* var directly so
// api-client.ts's fail-fast check doesn't trip during tests. Matches
// apps/web/.env.example's own default value (and apps/admin/jest.env-
// setup.js's identical pattern, Stage 5.17).
process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api/v1";
