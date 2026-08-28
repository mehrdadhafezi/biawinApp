"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { color, radius, shadow, spacing } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CategoryDto } from "../../lib/services-api";
import { CATEGORY_GRID_ORDER, CATEGORY_GRID_DEFAULT_COUNT, CATEGORY_ICON, CATEGORY_ICON_FALLBACK } from "./serviceCategoryVisual";

export interface CategoryGridProps {
  categories: CategoryDto[] | null;
  onSelect: (category: CategoryDto) => void;
}

/**
 * Services List's category grid — pixel-matched to `#serviceGrid`/
 * `#extraServices` in `data-view="services"` (round icon thumb + label,
 * 2-column-and-up responsive grid, a "بیشتر"/"کمتر" toggle revealing the
 * rest). Replaces the horizontal chip-row `CategorySelector` used to show
 * here (Stage 9.1) — the prototype's Services List and Category View are
 * genuinely different layouts (icon grid vs. a hero+filter+product-grid
 * page), which the prior shared-component approach didn't distinguish.
 * `CategorySelector`'s chip row remains in use on `/services/[categoryId]`
 * unchanged (see that page).
 *
 * Real `Category` rows drive this (SERVICES-R1 product decision #2 — the
 * prototype's static 12+8 label list is never rendered directly), ordered
 * by `CATEGORY_GRID_ORDER` (the prototype's own grid order) rather than
 * API response order, since every real category currently has
 * `sortOrder:0` (unordered) and the prototype's ordering is itself part of
 * its approved visual hierarchy.
 */
export function CategoryGrid({ categories, onSelect }: CategoryGridProps) {
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(() => {
    if (!categories) return null;
    const byName = new Map(categories.map((c) => [c.name, c]));
    const inPrototypeOrder = CATEGORY_GRID_ORDER.map((name) => byName.get(name)).filter(
      (c): c is CategoryDto => c !== undefined,
    );
    const matchedNames = new Set(inPrototypeOrder.map((c) => c.name));
    const unmatched = categories.filter((c) => !matchedNames.has(c.name)).sort((a, b) => a.name.localeCompare(b.name, "fa"));
    return [...inPrototypeOrder, ...unmatched];
  }, [categories]);

  if (ordered === null) {
    return (
      <div style={gridStyle}>
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonBlock key={i} height={138} />
        ))}
      </div>
    );
  }

  const visible = expanded ? ordered : ordered.slice(0, CATEGORY_GRID_DEFAULT_COUNT);
  const hasMore = ordered.length > CATEGORY_GRID_DEFAULT_COUNT;

  return (
    <div style={gridStyle}>
      {visible.map((category) => (
        <CategoryTile key={category.id} category={category} onSelect={onSelect} />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ ...tileStyle, cursor: "pointer", background: color.white }}
          aria-expanded={expanded}
        >
          <MoreThumb expanded={expanded} />
          <span style={labelStyle}>{expanded ? "کمتر" : "بیشتر"}</span>
        </button>
      )}
    </div>
  );
}

function CategoryTile({ category, onSelect }: { category: CategoryDto; onSelect: (category: CategoryDto) => void }) {
  const iconSrc = CATEGORY_ICON[category.name] ?? CATEGORY_ICON_FALLBACK;
  return (
    <button type="button" onClick={() => onSelect(category)} style={{ ...tileStyle, cursor: "pointer" }}>
      <span style={thumbStyle}>
        {/* Real, migrated prototype WEBP assets (docs/services-r1-fidelity-report.md) — a plain <img>, not next/image, to match every other Services image today (no imageUrl resolver exists yet for backend-hosted images; these are static public/ files, not fetched from an API). */}
        <img src={iconSrc} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </span>
      <span style={labelStyle}>{category.name}</span>
    </button>
  );
}

function MoreThumb({ expanded }: { expanded: boolean }) {
  return (
    <span style={{ ...thumbStyle, background: color.ice, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke={color.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {expanded ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </span>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
  gap: spacing.sm,
};

const tileStyle: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  background: color.white,
  border: `1px solid ${color.line}`,
  borderRadius: radius.xl,
  minHeight: 138,
  padding: "12px 8px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  textAlign: "center",
  boxShadow: shadow.sm,
  gap: spacing.sm,
};

const thumbStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  overflow: "hidden",
  border: `4px solid ${color.ice}`,
  boxShadow: "0 8px 20px rgba(8,121,220,.13)",
  background: color.white,
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.65,
  color: color.ink,
};
