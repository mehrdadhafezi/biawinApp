import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { homeApi, type CategoryDto } from "../../lib/home-api";

export interface CategoriesSummary {
  categories: CategoryDto[] | null;
  error: string | null;
}

/** Shared by `ServiceTicker` and `FeaturedServiceBanner` — same catalog, fetched once. */
export function useCategories(): CategoriesSummary {
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    homeApi
      .listCategories()
      .then((result) => {
        if (cancelled) return;
        setCategories(result.items.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "خطا در دریافت دسته‌بندی‌ها.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, error };
}
