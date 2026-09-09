import { apiClient } from "../../../lib/api-client";
import { createCatalogResourceApi } from "./catalog-resource-api";
import type { CardProductAdmin, CardProductInput, Paginated } from "../types";

const base = createCatalogResourceApi<CardProductAdmin, CardProductInput>("/admin/card-products");

/** `/admin/card-products/**` (backend/src/modules/cards/card-products-admin.controller.ts). */
export const cardProductsAdminApi = {
  ...base,
  list: (serviceId?: string, limit = 100) =>
    apiClient.get<Paginated<CardProductAdmin>>(
      `/admin/card-products?limit=${limit}${serviceId ? `&serviceId=${serviceId}` : ""}`,
    ),
};
