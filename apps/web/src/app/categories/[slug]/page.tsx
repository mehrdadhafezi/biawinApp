"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../components/common/SkeletonBlock";
import { CategoryHero } from "../../../components/services/CategoryHero";
import { CategoryCardGrid } from "../../../components/services/CategoryCardGrid";
import { ServicesErrorState } from "../../../components/services/ServicesStates";
import { servicesApi, categoryCardsApi, type CategoryDto, type CategoryCardDto } from "../../../lib/services-api";
import { categoryCardServiceDetailHref } from "../../../components/services/serviceValidation";
import { trackEvent } from "../../../lib/analytics";
import { ApiError } from "../../../lib/api-client";

/**
 * SERVICES-R5.21 — Category Landing: a new, focused entry point distinct
 * from `/services/[categoryId]` (browse-all-categories, search, method
 * filters, the full Service grid — completely unaffected by this route).
 * `[slug]` resolves via the dedicated `GET /categories/slug/:slug`
 * endpoint — a Category with no slug ever set by Admin correctly 404s
 * here (no fabricated slug exists for any real Category yet; see
 * docs/services-r5-21-category-landing-discovery-card-contract.md §2).
 *
 * Each async section owns its own loading/error state independently
 * (the Category fetch and the CategoryCard list fetch never block each
 * other) — the same discipline SERVICES-R3.1 established for the sibling
 * Service Detail page.
 *
 * Click behavior: CategoryCard -> Service Detail (`/services/[categoryId]/
 * [serviceId]`), the existing, already-built route — no new route is
 * invented for this destination.
 */
export default function CategoryLandingPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryCards, setCategoryCards] = useState<CategoryCardDto[] | null>(null);
  const [categoryCardsError, setCategoryCardsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    servicesApi
      .getCategoryBySlug(params.slug)
      .then((data) => {
        if (!cancelled) setCategory(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات دسته‌بندی.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  // SERVICES-R5.22 — fires once the real Category resolves (mirrors
  // `ServiceViewed`'s "only once real, validated data is known" rule).
  useEffect(() => {
    if (!category) return;
    trackEvent({ name: "CategoryViewed", categoryId: category.id });
  }, [category]);

  useEffect(() => {
    if (!category) return;
    let cancelled = false;

    categoryCardsApi
      .listByCategory(category.id)
      .then((result) => {
        if (!cancelled) setCategoryCards(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCategoryCardsError(err instanceof ApiError ? err.message : "خطا در دریافت کارت‌های این دسته‌بندی.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  function handleSelectCategoryCard(categoryCard: CategoryCardDto) {
    trackEvent({
      name: "CategoryCardClicked",
      categoryId: categoryCard.categoryId,
      categoryCardId: categoryCard.id,
      targetServiceId: categoryCard.targetServiceId,
      position: (categoryCards ?? []).findIndex((c) => c.id === categoryCard.id),
    });
    router.push(categoryCardServiceDetailHref(categoryCard));
  }

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {error && <ServicesErrorState message={error} />}

        {!error && notFound && <ServicesErrorState message="این دسته‌بندی یافت نشد." />}

        {!error && !notFound && !category && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={100} />
          </div>
        )}

        {!error && !notFound && category && (
          <>
            <CategoryHero category={category} serviceCount={categoryCards?.length ?? 0} />
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <CategoryCardGrid
                categoryCards={categoryCards}
                error={categoryCardsError}
                onSelect={handleSelectCategoryCard}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
