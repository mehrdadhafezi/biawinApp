"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { color } from "@biawin/ui";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { ApiError } from "../../../../lib/api-client";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../../../../features/catalog/rbac";
import { categoryCardsAdminApi } from "../../../../features/catalog/api/category-cards-admin-api";
import { CategoryCardForm } from "../../../../features/catalog/category-cards/CategoryCardForm";
import type { CategoryCardAdmin } from "../../../../features/catalog/types";

export default function EditCategoryCardPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <EditCategoryCardContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function EditCategoryCardContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  const [item, setItem] = useState<CategoryCardAdmin | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    categoryCardsAdminApi
      .get(id)
      .then((result) => {
        if (!cancelled) setItem(result);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setErrorMessage(error instanceof ApiError ? error.message : "دریافت اطلاعات کارت دسته‌بندی با خطا مواجه شد.");
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
    <CategoryCardForm
      mode="edit"
      initial={item}
      readOnly={!canManage}
      backHref="/catalog/category-cards"
      onSaved={() => router.push("/catalog/category-cards")}
    />
  );
}
