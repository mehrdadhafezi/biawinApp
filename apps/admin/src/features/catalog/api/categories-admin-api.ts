import { createReorderableCatalogResourceApi } from "./catalog-resource-api";
import type { CategoryAdmin, CategoryInput } from "../types";

/** `/admin/categories/**` (backend/src/modules/categories/categories-admin.controller.ts). */
export const categoriesAdminApi = createReorderableCatalogResourceApi<CategoryAdmin, CategoryInput>(
  "/admin/categories",
);
