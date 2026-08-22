"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Profile } from "@biawin/types";
import { Button, color, font } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../lib/auth/auth-context";
import { usersApi } from "../../lib/users-api";

/**
 * Minimal authenticated shell — proves the Auth Flow works end-to-end
 * (Sprint 0-A). The full dashboard (stories, card carousel, quick actions,
 * ...) is Sprint 0-B — see docs/prototype-to-production-mapping.md screen §2.
 */
export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) router.replace("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    usersApi
      .getCurrentProfile()
      .then(setProfile)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات کاربر."));
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        fontFamily: font.family,
      }}
    >
      <strong style={{ fontSize: 20, color: color.deep }}>
        {profile ? `خوش آمدید، ${profile.fullName}` : "در حال بارگذاری..."}
      </strong>
      {error && <span style={{ color: "#c0392b", fontSize: 12 }}>{error}</span>}
      <p style={{ margin: 0, fontSize: 12, color: color.muted, textAlign: "center" }}>
        ورود با موفقیت انجام شد. داشبورد کامل خانه در Sprint 0-B ساخته می‌شود.
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          void logout().then(() => router.replace("/"));
        }}
      >
        خروج از حساب کاربری
      </Button>
    </div>
  );
}
