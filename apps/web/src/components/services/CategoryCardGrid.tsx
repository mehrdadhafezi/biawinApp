"use client";

import { useEffect } from "react";
import { spacing } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CategoryCardDto } from "../../lib/services-api";
import { trackEvent } from "../../lib/analytics";
import { ServicesEmptyState, ServicesErrorState } from "./ServicesStates";
import { CategoryCard } from "./CategoryCard";

export interface CategoryCardGridProps {
  categoryCards: CategoryCardDto[] | null;
  error: string | null;
  onSelect: (categoryCard: CategoryCardDto) => void;
}

/**
 * SERVICES-R5.21 — the CategoryCard analog of `CardProductGrid`: same
 * loading (skeleton)/error/empty/populated states, same "trust the
 * server's `active: true`-only filtering, never re-filter client-side"
 * discipline (see `categoryCardsApi.listByCategory`'s own doc comment).
 *
 * Fires `CategoryCardViewed` once per card whenever a real, populated set
 * of cards first renders — see `lib/analytics.ts`'s own doc comment for
 * exactly what this signal does and does not mean.
 */
export function CategoryCardGrid({ categoryCards, error, onSelect }: CategoryCardGridProps) {
  useEffect(() => {
    if (!categoryCards || categoryCards.length === 0) return;
    categoryCards.forEach((card, position) => {
      trackEvent({
        name: "CategoryCardViewed",
        categoryId: card.categoryId,
        categoryCardId: card.id,
        targetServiceId: card.targetServiceId,
        position,
      });
    });
  }, [categoryCards]);

  if (error) {
    return <ServicesErrorState message={error} />;
  }

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: spacing.md };

  if (categoryCards === null) {
    return (
      <div style={gridStyle}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} height={220} />
        ))}
      </div>
    );
  }

  if (categoryCards.length === 0) {
    return <ServicesEmptyState message="در حال حاضر کارتی برای این دسته‌بندی ثبت نشده است." />;
  }

  return (
    <div style={gridStyle}>
      {categoryCards.map((categoryCard) => (
        <CategoryCard key={categoryCard.id} categoryCard={categoryCard} onSelect={onSelect} />
      ))}
    </div>
  );
}
