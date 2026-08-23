"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthModal } from "../components/auth/AuthModal";
import { OrbitLanding } from "../components/landing/OrbitLanding";
import { useAuth } from "../lib/auth/auth-context";

/**
 * Landing / auth entry (docs/prototype-to-production-mapping.md, screen §1).
 *
 * Stage 1 (v16_clean prototype baseline): renders the Orbit Landing —
 * the old 4-panel LandingPanels layout is no longer rendered here. See
 * apps/web/src/components/landing/LandingPanels.tsx for why that file is
 * left in place unused rather than deleted (its copy may be reused as
 * story-topic content in a later stage).
 */
export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/home");
  }, [isAuthenticated, router]);

  if (isAuthenticated) return null; // avoid a landing-page flash before redirect

  return (
    <>
      <OrbitLanding onLoginClick={() => setAuthOpen(true)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
