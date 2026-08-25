"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAdminAuth } from "../../lib/auth/admin-auth-context";

export interface AdminRouteGuardProps {
  /** "require-auth": redirect away if signed out. "require-guest": redirect away if signed in (e.g. /login once already authenticated). */
  mode: "require-auth" | "require-guest";
  redirectTo: string;
  children: ReactNode;
}

/**
 * The guard's actual decision, factored out as a plain function so
 * "protected route redirect" is directly unit-testable without rendering
 * anything (see AdminRouteGuard.test.ts). `null` (initial client-side
 * check not run yet) never triggers a redirect either way — avoids
 * bouncing a still-loading session straight to the sign-in page.
 */
export function shouldRedirectFromGuard(mode: AdminRouteGuardProps["mode"], isAuthenticated: boolean | null): boolean {
  return mode === "require-auth" ? isAuthenticated === false : isAuthenticated === true;
}

/**
 * Mirrors apps/web's `AuthGuard` (`components/shell/AuthGuard.tsx`)
 * exactly — client-side, built on `useAdminAuth()`, not Next.js middleware
 * (tokens live in localStorage, which middleware can't read). Its own
 * component (not the customer `AuthGuard`) because the two must never
 * share auth state — see docs/admin-architecture-decision-record.md §3.
 */
export function AdminRouteGuard({ mode, redirectTo, children }: AdminRouteGuardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAdminAuth();
  const shouldRedirect = shouldRedirectFromGuard(mode, isAuthenticated);

  useEffect(() => {
    if (shouldRedirect) router.replace(redirectTo);
  }, [shouldRedirect, redirectTo, router]);

  // isAuthenticated === null: initial client-side check hasn't run yet.
  // shouldRedirect: about to navigate away — avoid a content flash either way.
  if (isAuthenticated === null || shouldRedirect) return null;

  return <>{children}</>;
}
