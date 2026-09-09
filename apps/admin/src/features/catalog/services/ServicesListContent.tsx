"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/api-client";
import { useAdminAuth } from "../../../lib/auth/admin-auth-context";
import { canManageCatalog } from "../rbac";
import { servicesAdminApi } from "../api/services-admin-api";
import { performToggleActive } from "../../home/logic";
import { ActiveToggle } from "../../home/components/ActiveToggle";
import { CatalogListTable } from "../components/CatalogListTable";
import type { ServiceAdmin } from "../types";

export function ServicesListContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageCatalog(profile?.role);

  const [items, setItems] = useState<ServiceAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await servicesAdminApi.list();
      setItems(result.items);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "دریافت فهرست خدمات با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleActive(item: ServiceAdmin) {
    setActionError(null);
    setTogglingId(item.id);
    const result = await performToggleActive(item.id, !item.active, { update: servicesAdminApi.update });
    if (result.success) {
      setItems((current) => current?.map((entry) => (entry.id === item.id ? result.item : entry)) ?? null);
    } else {
      setActionError(result.message);
    }
    setTogglingId(null);
  }

  return (
    <CatalogListTable<ServiceAdmin>
      title="خدمات"
      description="کاتالوگ خدمات — هر خدمت به یک دسته‌بندی واقعی متصل است و کارت‌های محصول زیر آن تعریف می‌شوند."
      newHref="/catalog/services/new"
      newLabel="+ خدمت جدید"
      canManage={canManage}
      items={items}
      loadError={loadError}
      actionError={actionError}
      getId={(item) => item.id}
      getTitle={(item) => item.title}
      columns={[
        { header: "دسته‌بندی", render: (item) => item.category?.name ?? item.categoryId },
        { header: "روش‌های خرید", render: (item) => item.availableMethods.join("، ") || "—" },
      ]}
      renderStatus={(item) => (
        <ActiveToggle
          active={item.active}
          disabled={!canManage}
          busy={togglingId === item.id}
          onToggle={() => void handleToggleActive(item)}
        />
      )}
      editHref={(item) => `/catalog/services/${item.id}`}
      emptyLabel="هنوز خدمتی ثبت نشده است."
    />
  );
}
