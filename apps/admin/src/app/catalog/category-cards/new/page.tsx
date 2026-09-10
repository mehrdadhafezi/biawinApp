"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../../../../features/catalog/rbac";
import { CategoryCardForm } from "../../../../features/catalog/category-cards/CategoryCardForm";

export default function NewCategoryCardPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewCategoryCardContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewCategoryCardContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/catalog/category-cards");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return (
    <CategoryCardForm
      mode="create"
      backHref="/catalog/category-cards"
      onSaved={() => router.push("/catalog/category-cards")}
    />
  );
}
