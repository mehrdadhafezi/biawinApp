"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../rbac";
import { categoriesAdminApi } from "../api/categories-admin-api";
import { performToggleActive, performReorder, moveItem } from "../../home/logic";
import { ActiveToggle } from "../../home/components/ActiveToggle";
import { CatalogListTable } from "../components/CatalogListTable";
import type { CategoryAdmin } from "../types";

export function CategoriesListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  const [items, setItems] = useState<CategoryAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await categoriesAdminApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست دسته‌بندی‌ها با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: CategoryAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: categoriesAdminApi.update });
    if (result.success) {
      setItems((current) => current?.map((entry) => (entry.id === item.id ? result.item : entry)) ?? null);
    } else {
      setActionError(result.message);
    }
    setTogglingId(null);
  }

  async function handleMove(index: number, direction: "up" | "down") {
    if (!items) return;
    setActionError(null);
    setReorderBusy(true);
    const entries = moveItem(items, index, direction, (item) => item.id);
    const result = await performReorder(entries, { reorder: categoriesAdminApi.reorder, list: categoriesAdminApi.list });
    if (result.success) {
      setItems(result.items);
    } else {
      setActionError(result.message);
    }
    setReorderBusy(false);
  }

  return (
    <CatalogListTable<CategoryAdmin>
      title="دسته‌بندی‌ها"
      description="دسته‌بندی‌های کاتالوگ خدمات — پایه‌ای که خدمات و کارت‌های محصول زیر آن قرار می‌گیرند."
      newHref="/catalog/categories/new"
      newLabel="+ دسته‌بندی جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      getId={(item) => item.id}
      getTitle={(item) => item.name}
      columns={[{ header: "توضیحات", render: (item) => item.description }]}
      renderStatus={(item) => (
        <ActiveToggle
          active={item.active}
          disabled={!canManage}
          busy={togglingId === item.id}
          onToggle={() => void handleToggleActive(item)}
        />
      )}
      editHref={(item) => `/catalog/categories/${item.id}`}
      reorder={{
        onMoveUp: (index) => void handleMove(index, "up"),
        onMoveDown: (index) => void handleMove(index, "down"),
        busy: reorderBusy,
      }}
      emptyLabel="هنوز دسته‌بندی‌ای ثبت نشده است."
    />
  );
}
