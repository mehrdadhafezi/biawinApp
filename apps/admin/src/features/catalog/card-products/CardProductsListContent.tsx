"use client";

import { useCallback, useEffect, useState } from "react";
import { color } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../rbac";
import { cardProductsAdminApi } from "../api/card-products-admin-api";
import { CatalogListTable } from "../components/CatalogListTable";
import type { CardProductAdmin, CardProductStatus } from "../types";

const STATUS_LABEL: Record<CardProductStatus, string> = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  EXPIRED: "منقضی",
};

export function CardProductsListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  const [items, setItems] = useState<CardProductAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await cardProductsAdminApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست کارت‌های محصول با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleStatusChange(item: CardProductAdmin, status: CardProductStatus) {
    setActionError(null);
    setUpdatingId(item.id);
    try {
      const updated = await cardProductsAdminApi.update(item.id, { status });
      setItems((current) => current?.map((entry) => (entry.id === item.id ? updated : entry)) ?? null);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "به‌روزرسانی وضعیت با خطا مواجه شد.");
    }
    setUpdatingId(null);
  }

  return (
    <CatalogListTable<CardProductAdmin>
      title="کارت‌های محصول"
      description="کارت‌های محصول تجاری — واحدی که کاربر واقعاً از یک خدمت خریداری/دریافت می‌کند."
      newHref="/catalog/card-products/new"
      newLabel="+ کارت محصول جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      getId={(item) => item.id}
      getTitle={(item) => item.title}
      columns={[
        { header: "خدمت", render: (item) => item.service?.title ?? item.serviceId },
        { header: "نوع", render: (item) => item.cardType },
        {
          header: "مبلغ (ریال)",
          render: (item) => (item.priceAmount !== null ? item.priceAmount.toLocaleString("fa-IR") : "—"),
        },
      ]}
      renderStatus={(item) => (
        <select
          value={item.status}
          disabled={!canManage || updatingId === item.id}
          onChange={(e) => void handleStatusChange(item, e.target.value as CardProductStatus)}
          style={{
            height: 32,
            borderRadius: 8,
            border: `1px solid ${color.line}`,
            background: color.white,
            fontSize: 11,
            fontWeight: 700,
            padding: "0 8px",
          }}
        >
          {(Object.keys(STATUS_LABEL) as CardProductStatus[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABEL[key]}
            </option>
          ))}
        </select>
      )}
      editHref={(item) => `/catalog/card-products/${item.id}`}
      emptyLabel="هنوز کارت محصولی ثبت نشده است."
    />
  );
}
