"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { ServiceMosaicForm } from "../../../../features/home/service-mosaic/ServiceMosaicForm";

export default function NewServiceMosaicPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewServiceMosaicContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewServiceMosaicContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/home/service-mosaic");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return <ServiceMosaicForm mode="create" backHref="/home/service-mosaic" onSaved={() => router.push("/home/service-mosaic")} />;
}
