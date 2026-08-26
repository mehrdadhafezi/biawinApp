"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { HeroCardForm } from "../../../../features/home/hero/HeroCardForm";

export default function NewHeroCardPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewHeroCardContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

/** A create form has no value for a read-only `SUPPORT_VIEWER` — redirected back to the list rather than shown a disabled empty form. Backend `AdminRolesGuard` would reject the `POST` regardless. */
function NewHeroCardContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/home/hero-cards");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return <HeroCardForm mode="create" backHref="/home/hero-cards" onSaved={() => router.push("/home/hero-cards")} />;
}
