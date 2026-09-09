"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { color } from "@biawin/ui";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { ApiError } from "../../../../lib/api-client";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../../../../features/catalog/rbac";
import { cardProductsAdminApi } from "../../../../features/catalog/api/card-products-admin-api";
import { CardProductForm } from "../../../../features/catalog/card-products/CardProductForm";
import type { CardProductAdmin } from "../../../../features/catalog/types";

export default function EditCardProductPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <EditCardProductContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function EditCardProductContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  const [item, setItem] = useState<CardProductAdmin | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cardProductsAdminApi
      .get(id)
      .then((result) => {
        if (!cancelled) setItem(result);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setErrorMessage(error instanceof ApiError ? error.message : "دریافت اطلاعات کارت محصول با خطا مواجه شد.");
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
    <CardProductForm
      mode="edit"
      initial={item}
      readOnly={!canManage}
      backHref="/catalog/card-products"
      onSaved={() => router.push("/catalog/card-products")}
    />
  );
}
