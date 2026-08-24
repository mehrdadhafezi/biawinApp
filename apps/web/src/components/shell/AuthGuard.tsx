"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../../lib/auth/auth-context";

export interface AuthGuardProps {
  /** "require-auth": redirect away if signed out. "require-guest": redirect away if signed in. */
  mode: "require-auth" | "require-guest";
  redirectTo: string;
  children: ReactNode;
}

/**
 * Client-side route guard (docs/app-shell-contract.md §5) — built on the
 * existing `useAuth()` value, not Next.js middleware, because tokens live
 * in localStorage which middleware can't read. This is the same
 * redirect-and-render-null pattern Landing and Home each hand-rolled
 * independently; extracted here so every future authenticated page reuses
 * one implementation instead of a third/fourth copy. Auth logic itself
 * (`useAuth`, token storage, refresh) is untouched — this only wraps it.
 */
export function AuthGuard({ mode, redirectTo, children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const shouldRedirect = mode === "require-auth" ? isAuthenticated === false : isAuthenticated === true;

  useEffect(() => {
    if (shouldRedirect) router.replace(redirectTo);
  }, [shouldRedirect, redirectTo, router]);

  // isAuthenticated === null: initial client-side check hasn't run yet.
  // shouldRedirect: about to navigate away — avoid a content flash either way.
  if (isAuthenticated === null || shouldRedirect) return null;

  return <>{children}</>;
}
