"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { ServiceBannerForm } from "../../../../features/home/service-banners/ServiceBannerForm";

export default function NewServiceBannerPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewServiceBannerContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewServiceBannerContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/home/service-banners");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return <ServiceBannerForm mode="create" backHref="/home/service-banners" onSaved={() => router.push("/home/service-banners")} />;
}
