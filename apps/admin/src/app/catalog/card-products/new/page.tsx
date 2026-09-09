"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../../../../features/catalog/rbac";
import { CardProductForm } from "../../../../features/catalog/card-products/CardProductForm";

export default function NewCardProductPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewCardProductContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewCardProductContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/catalog/card-products");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return (
    <CardProductForm mode="create" backHref="/catalog/card-products" onSaved={() => router.push("/catalog/card-products")} />
  );
}
