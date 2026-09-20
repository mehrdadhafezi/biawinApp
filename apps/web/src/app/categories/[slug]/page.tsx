"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../components/common/SkeletonBlock";
import { CategoryLandingStyles } from "../../../components/services/CategoryLandingStyles";
import { ServicesPageHeader } from "../../../components/services/ServicesPageHeader";
import { CategoryLandingHero } from "../../../components/services/CategoryLandingHero";
import { CategoryLandingTools } from "../../../components/services/CategoryLandingTools";
import { CategoryLandingProducts, CategoryLandingInfoStrip } from "../../../components/services/CategoryLandingProducts";
import { availableCardTypes, filterCardProducts, type CardTypeFilter } from "../../../components/services/categoryLandingFilter";
import { ServicesErrorState } from "../../../components/services/ServicesStates";
import { getCategoryAccent } from "../../../components/services/serviceCategoryVisual";
import { cardProductDetailHref } from "../../../components/services/serviceValidation";
import { servicesApi, cardProductsApi, type CategoryDto, type CardProductDto } from "../../../lib/services-api";
import { trackEvent } from "../../../lib/analytics";
import { ApiError } from "../../../lib/api-client";

/**
 * Category Landing — `/categories/[slug]`, the SECOND of the Services
 * journey's three customer-facing levels:
 *
 *   Services Home  ->  Category Landing (this page)  ->  CardProduct Detail
 *
 * Follows the prototype's `page-service-category`: header, category hero,
 * tools (search + type filters), this category's CardProducts, info strip.
 * The list is the category's own real, ACTIVE CardProducts
 * (`GET /cards?categoryId=`, scoped server-side through each card's owning
 * Service), and choosing one navigates DIRECTLY to that CardProduct's detail
 * page — there is no Service page or second card-selection step in between.
 * Service/CategoryCard remain internal entities; they are not customer pages.
 *
 * `[slug]` resolves via `GET /categories/slug/:slug` — a Category with no
 * slug ever set by Admin correctly 404s here. Each async section owns its
 * own loading/error state (the Category fetch and the card list never block
 * each other), the discipline SERVICES-R3.1 established.
 */
export default function CategoryLandingPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardProducts, setCardProducts] = useState<CardProductDto[] | null>(null);
  const [cardProductsError, setCardProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CardTypeFilter>("all");

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

  // Fires once the real Category resolves (SERVICES-R5.22).
  useEffect(() => {
    if (!category) return;
    trackEvent({ name: "CategoryViewed", categoryId: category.id });
  }, [category]);

  useEffect(() => {
    if (!category) return;
    let cancelled = false;

    cardProductsApi
      .listByCategory(category.id)
      .then((result) => {
        if (!cancelled) setCardProducts(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCardProductsError(err instanceof ApiError ? err.message : "خطا در دریافت کارت‌های این دسته‌بندی.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  const cardTypes = useMemo(() => availableCardTypes(cardProducts ?? []), [cardProducts]);
  const visible = useMemo(() => filterCardProducts(cardProducts ?? [], filter, search), [cardProducts, filter, search]);

  function handleSelectCardProduct(cardProduct: CardProductDto) {
    // Straight to the final page. The Service id in the path is the card's own
    // owner (validated on arrival) — it is not a page the customer visits.
    if (category) router.push(cardProductDetailHref(category.id, cardProduct));
  }

  const theme = category ? getCategoryAccent(category.name) : null;

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <CategoryLandingStyles />

      {(error || notFound || !category) && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          {error && <ServicesErrorState message={error} />}

          {!error && notFound && <ServicesErrorState message="این دسته‌بندی یافت نشد." />}

          {!error && !notFound && !category && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <SkeletonBlock height={160} />
              <SkeletonBlock height={100} />
            </div>
          )}
        </div>
      )}

      {!error && !notFound && category && theme && (
        <div
          className="cl-page"
          style={{ "--category-accent": theme.accent, "--category-deep": theme.deep, "--category-soft": theme.soft } as CSSProperties}
        >
          <ServicesPageHeader
            variant="category"
            title={`کارت‌های ${category.name}`}
            shareTitle={`خدمات ${category.name} در بیاوین`}
            shareText={category.description}
            fallbackHref="/services"
          />
          <div className="cl-main">
            <CategoryLandingHero category={category} cardCount={cardProducts?.length ?? null} cardTypes={cardTypes} />
            <CategoryLandingTools
              categoryName={category.name}
              search={search}
              onSearchChange={setSearch}
              cardTypes={cardTypes}
              filter={filter}
              onFilterChange={setFilter}
            />
            <CategoryLandingProducts
              categoryName={category.name}
              cardProducts={cardProducts}
              visible={visible}
              error={cardProductsError}
              hasSearchOrFilter={search.trim() !== "" || filter !== "all"}
              onSelect={handleSelectCardProduct}
            />
            <CategoryLandingInfoStrip />
          </div>
        </div>
      )}
    </AppShell>
  );
}
