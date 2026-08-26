"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../rbac";
import { homeNewsApi } from "../api/home-news-api";
import { performToggleActive, performReorder, performRemove, moveItem } from "../logic";
import { ResourceListPage } from "../components/ResourceListPage";
import type { HomeNewsArticleAdmin } from "../types";

export function NewsListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [items, setItems] = useState<HomeNewsArticleAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HomeNewsArticleAdmin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await homeNewsApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست اخبار با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: HomeNewsArticleAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: homeNewsApi.update });
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
    const result = await performReorder(entries, { reorder: homeNewsApi.reorder, list: homeNewsApi.list });
    if (result.success) {
      setItems(result.items);
    } else {
      setActionError(result.message);
    }
    setReorderBusy(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const result = await performRemove(deleteTarget.id, { remove: homeNewsApi.remove });
    if (result.success) {
      setItems((current) => current?.filter((entry) => entry.id !== deleteTarget.id) ?? null);
      setDeleteTarget(null);
    } else {
      setDeleteError(result.message);
    }
    setDeleteBusy(false);
  }

  return (
    <ResourceListPage<HomeNewsArticleAdmin>
      title="اخبار"
      description="کاروسل اخبار صفحه خانه — فقط همین منبع محتوا؛ یک سامانه خبری عمومی نیست."
      newHref="/home/news/new"
      newLabel="+ خبر جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      successMessage={null}
      getId={(item) => item.id}
      getActive={(item) => item.active}
      getThumbnail={(item) => item.image}
      getTitle={(item) => item.title}
      columns={[{ header: "دسته‌بندی", render: (item) => item.category }]}
      editHref={(item) => `/home/news/${item.id}`}
      onToggleActive={handleToggleActive}
      togglingId={togglingId}
      onMoveUp={(index) => void handleMove(index, "up")}
      onMoveDown={(index) => void handleMove(index, "down")}
      reorderBusy={reorderBusy}
      onDelete={setDeleteTarget}
      deleteTarget={deleteTarget}
      deleteBusy={deleteBusy}
      deleteError={deleteError}
      onConfirmDelete={() => void handleConfirmDelete()}
      onCancelDelete={() => {
        setDeleteTarget(null);
        setDeleteError(null);
      }}
      deleteDescriptionFor={(item) => `خبر «${item.title}» برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`}
      emptyLabel="هنوز خبری ثبت نشده است."
    />
  );
}
