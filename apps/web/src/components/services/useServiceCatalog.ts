import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { servicesApi, type CategoryDto, type ServiceDto } from "../../lib/services-api";

export interface ServiceCatalog {
  categories: CategoryDto[] | null;
  services: ServiceDto[] | null;
  error: string | null;
}

/**
 * Fetched once, shared by /services and /services/[categoryId] — both
 * routes browse the same catalog, just pre-filtered differently (see
 * docs/services-v1-implementation-report.md). Same "fetch once, filter
 * client-side" shape Home's `useCategories` already established.
 */
export function useServiceCatalog(): ServiceCatalog {
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [services, setServices] = useState<ServiceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([servicesApi.listCategories(), servicesApi.listAllServices()])
      .then(([categoriesResult, allServices]) => {
        if (cancelled) return;
        setCategories(categoriesResult.items.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder));
        setServices(allServices.filter((s) => s.active));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "خطا در دریافت خدمات.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, services, error };
}
