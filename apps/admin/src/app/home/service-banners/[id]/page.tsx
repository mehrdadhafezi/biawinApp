"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { color } from "@biawin/ui";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { ApiError } from "../../../../lib/api-client";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { homeServiceBannerApi } from "../../../../features/home/api/home-service-banner-api";
import { ServiceBannerForm } from "../../../../features/home/service-banners/ServiceBannerForm";
import type { HomeServiceBannerAdmin } from "../../../../features/home/types";

export default function EditServiceBannerPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <EditServiceBannerContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function EditServiceBannerContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [item, setItem] = useState<HomeServiceBannerAdmin | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    homeServiceBannerApi
      .get(id)
      .then((result) => {
        if (!cancelled) setItem(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof ApiError ? error.message : "دریافت اطلاعات بنر با خطا مواجه شد.");
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
    <ServiceBannerForm
      mode="edit"
      initial={item}
      readOnly={!canManage}
      backHref="/home/service-banners"
      onSaved={() => router.push("/home/service-banners")}
    />
  );
}
