import type { MediaAsset } from "@biawin/types";
import { apiClient } from "../api-client";
import { MEDIA_PAGE_SIZE } from "./mediaPagination";

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

/** Thin wrapper over Stage 5.18's `/admin/media/**` endpoints. */
export const mediaApi = {
  /** One page (1-based). Only `page`/`limit` are valid inputs — the backend derives `skip` and rejects it as a query param. */
  list: (page = 1, limit = MEDIA_PAGE_SIZE) =>
    apiClient.get<Paginated<MediaAsset>>(`/admin/media?page=${page}&limit=${limit}`),

  get: (id: string) => apiClient.get<MediaAsset>(`/admin/media/${id}`),

  upload: (file: File, altText?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (altText) formData.append("altText", altText);
    return apiClient.postFormData<MediaAsset>("/admin/media/upload", formData);
  },

  /** Soft delete. The backend answers 409 (with `details.references`) while any Home row, Category, CategoryCard, Service (incl. gallery) or CardProduct still references the asset — never bypass or detach. */
  remove: (id: string) => apiClient.delete<{ id: string }>(`/admin/media/${id}`),
};
