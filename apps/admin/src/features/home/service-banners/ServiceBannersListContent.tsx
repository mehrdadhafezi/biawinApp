"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../rbac";
import { homeServiceBannerApi } from "../api/home-service-banner-api";
import { performToggleActive, performReorder, performRemove, moveItem } from "../logic";
import { ResourceListPage } from "../components/ResourceListPage";
import type { BannerTheme, HomeServiceBannerAdmin } from "../types";

const THEME_LABEL: Record<BannerTheme, string> = {
  auto: "خودرو",
  home: "خانه و زندگی",
  fashion: "پوشاک",
  gold: "طلا و جواهر",
  travel: "سفر و گردشگری",
};

export function ServiceBannersListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [items, setItems] = useState<HomeServiceBannerAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HomeServiceBannerAdmin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await homeServiceBannerApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست بنرها با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: HomeServiceBannerAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: homeServiceBannerApi.update });
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
    const result = await performReorder(entries, { reorder: homeServiceBannerApi.reorder, list: homeServiceBannerApi.list });
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
    const result = await performRemove(deleteTarget.id, { remove: homeServiceBannerApi.remove });
    if (result.success) {
      setItems((current) => current?.filter((entry) => entry.id !== deleteTarget.id) ?? null);
      setDeleteTarget(null);
    } else {
      setDeleteError(result.message);
    }
    setDeleteBusy(false);
  }

  return (
    <ResourceListPage<HomeServiceBannerAdmin>
      title="بنرهای خدمات"
      description="بنرهای شبکه خدمات منتخب در صفحه خانه — هر بنر به یک دسته‌بندی واقعی (با شناسه) متصل است."
      newHref="/home/service-banners/new"
      newLabel="+ بنر جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      successMessage={null}
      getId={(item) => item.id}
      getActive={(item) => item.active}
      getThumbnail={(item) => item.image}
      getTitle={(item) => item.kicker}
      columns={[
        { header: "دسته‌بندی", render: (item) => item.categoryName },
        { header: "تم", render: (item) => THEME_LABEL[item.theme] },
        { header: "عریض", render: (item) => (item.wide ? <Badge tone="info">بله</Badge> : "خیر") },
      ]}
      editHref={(item) => `/home/service-banners/${item.id}`}
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
      deleteDescriptionFor={(item) => `بنر «${item.kicker}» (${item.categoryName}) برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`}
      emptyLabel="هنوز بنری ثبت نشده است."
    />
  );
}
