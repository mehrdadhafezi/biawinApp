"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../rbac";
import { homeHeroApi } from "../api/home-hero-api";
import { performToggleActive, performReorder, performRemove, moveItem } from "../logic";
import { ResourceListPage } from "../components/ResourceListPage";
import type { HeroCardColor, HeroCardKey, HomeHeroCardAdmin } from "../types";

const CARD_KEY_LABEL: Record<HeroCardKey, string> = { earn: "درآمد", biawin: "اصلی", reward: "جایزه" };
const COLOR_LABEL: Record<HeroCardColor, string> = { blue: "آبی", sky: "آسمانی", white: "سفید" };

export function HeroCardsListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [items, setItems] = useState<HomeHeroCardAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HomeHeroCardAdmin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await homeHeroApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست کارت‌ها با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // Intentional client-side post-mount fetch — same pattern/justification as AdminMediaPage (Stage 5.18).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: HomeHeroCardAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: homeHeroApi.update });
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
    const result = await performReorder(entries, { reorder: homeHeroApi.reorder, list: homeHeroApi.list });
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
    const result = await performRemove(deleteTarget.id, { remove: homeHeroApi.remove });
    if (result.success) {
      setItems((current) => current?.filter((entry) => entry.id !== deleteTarget.id) ?? null);
      setDeleteTarget(null);
    } else {
      setDeleteError(result.message);
    }
    setDeleteBusy(false);
  }

  return (
    <ResourceListPage<HomeHeroCardAdmin>
      title="کارت‌های ابتدایی"
      description="کارت‌های شناور بالای صفحه خانه (بخش earn/biawin/reward). این مدل تصویر یا لینک ندارد — ظاهر آن با «پیش‌فرض رنگ» تعیین می‌شود."
      newHref="/home/hero-cards/new"
      newLabel="+ کارت جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      successMessage={null}
      getId={(item) => item.id}
      getActive={(item) => item.active}
      getThumbnail={() => null}
      getTitle={(item) => item.title}
      columns={[
        { header: "کلید", render: (item) => CARD_KEY_LABEL[item.cardKey] },
        { header: "رنگ", render: (item) => COLOR_LABEL[item.colorPreset] },
      ]}
      editHref={(item) => `/home/hero-cards/${item.id}`}
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
      deleteDescriptionFor={(item) => `کارت «${item.title}» برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`}
      emptyLabel="هنوز کارتی ثبت نشده است."
    />
  );
}
