"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { color } from "@biawin/ui";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { ApiError } from "../../../../lib/api-client";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { homeServiceMosaicApi } from "../../../../features/home/api/home-service-mosaic-api";
import { ServiceMosaicForm } from "../../../../features/home/service-mosaic/ServiceMosaicForm";
import type { HomeServiceMosaicTileAdmin } from "../../../../features/home/types";

export default function EditServiceMosaicPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <EditServiceMosaicContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function EditServiceMosaicContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [item, setItem] = useState<HomeServiceMosaicTileAdmin | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    homeServiceMosaicApi
      .get(id)
      .then((result) => {
        if (!cancelled) setItem(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof ApiError ? error.message : "دریافت اطلاعات کاشی با خطا مواجه شد.");
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
    <ServiceMosaicForm
      mode="edit"
      initial={item}
      readOnly={!canManage}
      backHref="/home/service-mosaic"
      onSaved={() => router.push("/home/service-mosaic")}
    />
  );
}
