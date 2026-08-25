// `next/jest` transpiles the app the same way `next build`/`next dev` do,
// but does NOT replicate Next's runtime .env.local loading for the Jest
// process itself — set the one required NEXT_PUBLIC_* var directly so
// api-client.ts's fail-fast check doesn't trip during tests. Matches
// apps/admin/.env.example's own default value.
process.env.NEXT_PUBLIC_ADMIN_API_URL ??= "http://localhost:4000/api/v1";
