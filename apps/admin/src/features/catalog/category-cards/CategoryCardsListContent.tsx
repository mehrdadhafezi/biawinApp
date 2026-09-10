"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../rbac";
import { categoryCardsAdminApi } from "../api/category-cards-admin-api";
import { performToggleActive, performReorder, moveItem } from "../../home/logic";
import { ActiveToggle } from "../../home/components/ActiveToggle";
import { CatalogListTable } from "../components/CatalogListTable";
import type { CategoryCardAdmin } from "../types";

/**
 * SERVICES-R5.21 — mirrors CategoriesListContent.tsx exactly (reorder +
 * boolean ActiveToggle), not CardProductsListContent's 4-state status
 * select — CategoryCard.active is boolean, same shape as Category.
 */
export function CategoryCardsListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  const [items, setItems] = useState<CategoryCardAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await categoryCardsAdminApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست کارت‌های دسته‌بندی با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: CategoryCardAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: categoryCardsAdminApi.update });
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
    const result = await performReorder(entries, {
      reorder: categoryCardsAdminApi.reorder,
      list: () => categoryCardsAdminApi.list(),
    });
    if (result.success) {
      setItems(result.items);
    } else {
      setActionError(result.message);
    }
    setReorderBusy(false);
  }

  return (
    <CatalogListTable<CategoryCardAdmin>
      title="کارت‌های دسته‌بندی"
      description="کارت‌های اکتشافی/تبلیغاتی صفحه فرود هر دسته‌بندی — هرکدام به یک خدمت مشخص در همان دسته‌بندی اشاره می‌کند، نه به کارت محصول یا قیمت."
      newHref="/catalog/category-cards/new"
      newLabel="+ کارت دسته‌بندی جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      getId={(item) => item.id}
      getTitle={(item) => item.title}
      columns={[
        { header: "دسته‌بندی", render: (item) => item.category?.name ?? item.categoryId },
        { header: "خدمت هدف", render: (item) => item.targetService?.title ?? item.targetServiceId },
      ]}
      renderStatus={(item) => (
        <ActiveToggle
          active={item.active}
          disabled={!canManage}
          busy={togglingId === item.id}
          onToggle={() => void handleToggleActive(item)}
        />
      )}
      editHref={(item) => `/catalog/category-cards/${item.id}`}
      reorder={{
        onMoveUp: (index) => void handleMove(index, "up"),
        onMoveDown: (index) => void handleMove(index, "down"),
        busy: reorderBusy,
      }}
      emptyLabel="هنوز کارت دسته‌بندی‌ای ثبت نشده است."
    />
  );
}
