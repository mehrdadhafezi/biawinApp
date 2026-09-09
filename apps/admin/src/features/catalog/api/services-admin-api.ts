import { apiClient } from "../../../lib/api-client";
import { createCatalogResourceApi } from "./catalog-resource-api";
import type { Paginated, ServiceAdmin, ServiceInput } from "../types";

const base = createCatalogResourceApi<ServiceAdmin, ServiceInput>("/admin/services");

/** `/admin/services/**` (backend/src/modules/services/services-admin.controller.ts). */
export const servicesAdminApi = {
  ...base,
  list: (categoryId?: string, limit = 100) =>
    apiClient.get<Paginated<ServiceAdmin>>(
      `/admin/services?limit=${limit}${categoryId ? `&categoryId=${categoryId}` : ""}`,
    ),
};
