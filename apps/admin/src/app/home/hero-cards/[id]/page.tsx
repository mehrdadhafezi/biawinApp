"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { color } from "@biawin/ui";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { ApiError } from "../../../../lib/api-client";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { homeHeroApi } from "../../../../features/home/api/home-hero-api";
import { HeroCardForm } from "../../../../features/home/hero/HeroCardForm";
import type { HomeHeroCardAdmin } from "../../../../features/home/types";

export default function EditHeroCardPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <EditHeroCardContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

/**
 * `SUPPORT_VIEWER` reaching this route sees the saved values in a disabled
 * form (no submit control) rather than being bounced away — gives read-only
 * visibility into the actual content, matching Stage 5.20 §12's "read-only
 * access" (not "no access"). `AdminRolesGuard` still rejects the `PUT` if
 * this were ever bypassed client-side.
 */
function EditHeroCardContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [item, setItem] = useState<HomeHeroCardAdmin | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    homeHeroApi
      .get(id)
      .then((result) => {
        if (!cancelled) setItem(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof ApiError ? error.message : "دریافت اطلاعات کارت با خطا مواجه شد.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (errorMessage) {
    return (
      <p role="alert" style={{ fontSize: 13, fontWeight: 700, color: "#c0392b" }}>
        {errorMessage}
      </p>
    );
  }
  if (!item) {
    return <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>;
  }

  return (
    <HeroCardForm
      mode="edit"
      initial={item}
      readOnly={!canManage}
      backHref="/home/hero-cards"
      onSaved={() => router.push("/home/hero-cards")}
    />
  );
}
