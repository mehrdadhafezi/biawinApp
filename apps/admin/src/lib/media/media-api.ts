import type { MediaAsset } from "@biawin/types";
import { apiClient } from "../api-client";

interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

/** Thin wrapper over Stage 5.18's `/admin/media/**` endpoints. */
export const mediaApi = {
  list: () => apiClient.get<Paginated<MediaAsset>>("/admin/media?limit=50"),

  get: (id: string) => apiClient.get<MediaAsset>(`/admin/media/${id}`),

  upload: (file: File, altText?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (altText) formData.append("altText", altText);
    return apiClient.postFormData<MediaAsset>("/admin/media/upload", formData);
  },

  remove: (id: string) => apiClient.delete<{ id: string }>(`/admin/media/${id}`),
};
