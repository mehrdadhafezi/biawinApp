"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../rbac";
import { homeServiceMosaicApi } from "../api/home-service-mosaic-api";
import { performToggleActive, performReorder, performRemove, moveItem } from "../logic";
import { ResourceListPage } from "../components/ResourceListPage";
import type { HomeServiceMosaicTileAdmin, MosaicSlot, MosaicTheme } from "../types";

const SLOT_LABEL: Record<MosaicSlot, string> = { half: "نیمه", wide: "عریض" };
const THEME_LABEL: Record<MosaicTheme, string> = { beauty: "زیبایی", insurance: "بیمه", home: "خانه و زندگی", digital: "دیجیتال" };

export function ServiceMosaicListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [items, setItems] = useState<HomeServiceMosaicTileAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HomeServiceMosaicTileAdmin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await homeServiceMosaicApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست موزاییک با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: HomeServiceMosaicTileAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: homeServiceMosaicApi.update });
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
    const result = await performReorder(entries, { reorder: homeServiceMosaicApi.reorder, list: homeServiceMosaicApi.list });
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
    const result = await performRemove(deleteTarget.id, { remove: homeServiceMosaicApi.remove });
    if (result.success) {
      setItems((current) => current?.filter((entry) => entry.id !== deleteTarget.id) ?? null);
      setDeleteTarget(null);
    } else {
      setDeleteError(result.message);
    }
    setDeleteBusy(false);
  }

  return (
    <ResourceListPage<HomeServiceMosaicTileAdmin>
      title="موزاییک خدمات"
      description="کاشی‌های نیمه و عریض بخش موزاییک خدمات در صفحه خانه — یک جدول واحد که با «نوع جایگاه» تفکیک می‌شود."
      newHref="/home/service-mosaic/new"
      newLabel="+ کاشی جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      successMessage={null}
      getId={(item) => item.id}
      getActive={(item) => item.active}
      getThumbnail={(item) => item.image}
      getTitle={(item) => item.title ?? item.kicker}
      columns={[
        { header: "دسته‌بندی", render: (item) => item.categoryName },
        { header: "نوع جایگاه", render: (item) => <Badge tone={item.slotType === "wide" ? "info" : "neutral"}>{SLOT_LABEL[item.slotType]}</Badge> },
        { header: "تم", render: (item) => THEME_LABEL[item.theme] },
      ]}
      editHref={(item) => `/home/service-mosaic/${item.id}`}
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
      deleteDescriptionFor={(item) => `کاشی «${item.title ?? item.kicker}» (${item.categoryName}) برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`}
      emptyLabel="هنوز کاشی‌ای ثبت نشده است."
    />
  );
}
