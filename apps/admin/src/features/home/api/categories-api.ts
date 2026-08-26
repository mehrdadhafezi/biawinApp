import { apiClient } from "../../../lib/api-client";
import type { CategoryOption, Paginated } from "../types";

/**
 * Reuses the existing public `GET /categories` (backend/src/modules/
 * categories/categories.controller.ts, `@Public()`, unauthenticated) —
 * there is no separate `/admin/categories` endpoint and none is added here;
 * the category catalog isn't owned by this stage. Category selectors submit
 * `id`, never `name` (see `HomeServiceBannersService`'s own doc comment on
 * why a name-matched category was the Stage 5.14.1 bug class).
 */
export const categoriesApi = {
  listActive: async (): Promise<CategoryOption[]> => {
    const result = await apiClient.get<Paginated<CategoryOption>>("/categories?limit=100", { public: true });
    return result.items.filter((category) => category.active);
  },
};
