import { apiClient } from "../../../lib/api-client";
import type { CategoryOption, Paginated } from "../types";

/**
 * Reads categories through the existing public `GET /categories`
 * (backend/src/modules/categories/categories.controller.ts, `@Public()`,
 * unauthenticated), which also returns inactive categories. Home only needs
 * to READ the catalog, so it does not use the authenticated
 * `/admin/categories` CRUD controller (`categories-admin.controller.ts`,
 * which exists and is owned by the Catalog screens) — Home never writes a
 * Category. Category selectors submit `id`, never `name` (see
 * `HomeServiceBannersService`'s own doc comment on why a name-matched
 * category was the Stage 5.14.1 bug class).
 */
export const categoriesApi = {
  /** Every category (active and inactive) — lets an edit form keep showing an inactive category a row already references. */
  listAll: async (): Promise<CategoryOption[]> => {
    const result = await apiClient.get<Paginated<CategoryOption>>("/categories?limit=100", { public: true });
    return result.items;
  },
  listActive: async (): Promise<CategoryOption[]> => {
    const result = await apiClient.get<Paginated<CategoryOption>>("/categories?limit=100", { public: true });
    return result.items.filter((category) => category.active);
  },
};
