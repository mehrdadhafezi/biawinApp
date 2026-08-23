import type { NextConfig } from "next";

// NOTE: `output: "standalone"` was tried and reverted — Next.js 16's file
// tracer fails to resolve `@swc/helpers` inside pnpm's isolated `.pnpm` store
// for this monorepo (a known class of Next+pnpm standalone bug), and adding
// `@swc/helpers` as an explicit dependency didn't fix it either since the
// unresolved path is inside `next`'s own peer-hashed virtual-store copy, not
// a path @biawin/web's package.json can influence. deploy/staging/Dockerfile.web
// runs a full `next build` + `next start` with the complete node_modules
// copied into the image instead — proven reliable, same pattern as the
// backend image.
const nextConfig: NextConfig = {
  // Dev-only: lets the local preview tooling's proxy (which forwards
  // requests to 127.0.0.1 with a Host header Next's dev server otherwise
  // flags as cross-origin) load HMR chunks. No effect on `next build`.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
