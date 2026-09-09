import { apiClient } from "../../../lib/api-client";
import type { Paginated, ReorderEntry } from "../types";

/**
 * Same thin HTTP-wrapper shape as features/home/api/home-resource-api.ts —
 * NOT a generic-CRUD backend abstraction (each catalog resource still has
 * its own dedicated NestJS controller/service/DTOs). Kept as its own copy
 * rather than importing Home's version, matching this codebase's existing
 * per-feature module-boundary convention.
 */
export function createCatalogResourceApi<TAdmin, TInput>(basePath: string) {
  return {
    list: (limit = 100) => apiClient.get<Paginated<TAdmin>>(`${basePath}?limit=${limit}`),
    get: (id: string) => apiClient.get<TAdmin>(`${basePath}/${id}`),
    create: (input: TInput) => apiClient.post<TAdmin>(basePath, input),
    update: (id: string, input: Partial<TInput>) => apiClient.put<TAdmin>(`${basePath}/${id}`, input),
  };
}

export function createReorderableCatalogResourceApi<TAdmin, TInput>(basePath: string) {
  return {
    ...createCatalogResourceApi<TAdmin, TInput>(basePath),
    reorder: (items: ReorderEntry[]) => apiClient.patch<unknown>(`${basePath}/reorder`, { items }),
  };
}
