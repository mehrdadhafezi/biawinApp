import { apiClient } from "../../../lib/api-client";
import type { Paginated, ReorderEntry } from "../types";

/**
 * A thin, shared HTTP-wrapper factory — NOT a generic-CRUD backend
 * abstraction (that anti-pattern is what `docs/admin-architecture-decision-
 * record.md` §9 rules out on the *server*; each Home resource still has its
 * own dedicated NestJS controller/service/DTOs). This only removes
 * boilerplate from calling those 4 already-distinct, already-typed REST
 * endpoints the same way `mediaApi` calls `/admin/media/**`.
 *
 * `reorder()`'s real backend response is the resource's *public* list
 * (`HomeXxxService.reorder()` returns `this.listPublic()`) — active-only,
 * without `active`/`mediaAssetId`/timestamps. Deliberately typed as
 * `unknown` and never relied on: callers always re-fetch the admin list
 * after a reorder instead of trusting this response's shape.
 */
export function createHomeResourceApi<TAdmin, TInput>(basePath: string) {
  return {
    list: (limit = 100) => apiClient.get<Paginated<TAdmin>>(`${basePath}?limit=${limit}`),
    get: (id: string) => apiClient.get<TAdmin>(`${basePath}/${id}`),
    create: (input: TInput) => apiClient.post<TAdmin>(basePath, input),
    update: (id: string, input: Partial<TInput>) => apiClient.put<TAdmin>(`${basePath}/${id}`, input),
    remove: (id: string) => apiClient.delete<{ id: string }>(`${basePath}/${id}`),
    reorder: (items: ReorderEntry[]) => apiClient.patch<unknown>(`${basePath}/reorder`, { items }),
  };
}
