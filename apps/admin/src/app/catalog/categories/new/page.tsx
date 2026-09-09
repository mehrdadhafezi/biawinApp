"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../../../../features/catalog/rbac";
import { CategoryForm } from "../../../../features/catalog/categories/CategoryForm";

export default function NewCategoryPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewCategoryContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewCategoryContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/catalog/categories");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return <CategoryForm mode="create" backHref="/catalog/categories" onSaved={() => router.push("/catalog/categories")} />;
}
