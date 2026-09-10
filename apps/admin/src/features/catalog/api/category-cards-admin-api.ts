import { apiClient } from "../../../lib/api-client";
import { createReorderableCatalogResourceApi } from "./catalog-resource-api";
import type { CategoryCardAdmin, CategoryCardInput, Paginated } from "../types";

const base = createReorderableCatalogResourceApi<CategoryCardAdmin, CategoryCardInput>("/admin/category-cards");

/** `/admin/category-cards/**` (backend/src/modules/category-cards/category-cards-admin.controller.ts). */
export const categoryCardsAdminApi = {
  ...base,
  list: (categoryId?: string, limit = 100) =>
    apiClient.get<Paginated<CategoryCardAdmin>>(
      `/admin/category-cards?limit=${limit}${categoryId ? `&categoryId=${categoryId}` : ""}`,
    ),
};
