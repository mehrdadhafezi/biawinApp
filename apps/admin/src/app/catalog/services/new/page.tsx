"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../../../../features/catalog/rbac";
import { ServiceForm } from "../../../../features/catalog/services/ServiceForm";

export default function NewServicePage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewServiceContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewServiceContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/catalog/services");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return <ServiceForm mode="create" backHref="/catalog/services" onSaved={() => router.push("/catalog/services")} />;
}
