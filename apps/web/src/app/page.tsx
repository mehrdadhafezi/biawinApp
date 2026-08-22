"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, color, font } from "@biawin/ui";
import { AuthModal } from "../components/auth/AuthModal";
import { LandingPanels } from "../components/landing/LandingPanels";
import { useAuth } from "../lib/auth/auth-context";

/** Landing / auth entry (docs/prototype-to-production-mapping.md, screen §1). */
export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/home");
  }, [isAuthenticated, router]);

  if (isAuthenticated) return null; // avoid a landing-page flash before redirect

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        background: color.ice,
        fontFamily: font.family,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <strong style={{ fontSize: 26, fontWeight: 800, color: color.deep }}>بیاوین</strong>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: color.muted }}>باشگاه هوشمند تجربه‌های ارزشمند</p>
      </div>

      <LandingPanels />

      <Button onClick={() => setAuthOpen(true)} style={{ minWidth: 220 }}>
        ورود | ثبت‌نام
      </Button>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
