import { color, font, spacing } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CategoryDto } from "../../lib/services-api";

export interface CategorySelectorProps {
  categories: CategoryDto[] | null;
  activeCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}

/**
 * Horizontal scrollable chip row for filtering by category — shared by
 * `/services` (activeCategoryId=null → "همه") and `/services/[categoryId]`
 * (activeCategoryId=the route param). No Chip primitive exists in
 * `packages/ui` yet (docs/services-ui-contract.md §9 flagged this as a
 * missing primitive with 0 other consumers today) — this stage's
 * instruction is to keep it module-local rather than add one, so this is
 * a plain styled `<button>`, not a new design-system component.
 */
export function CategorySelector({ categories, activeCategoryId, onSelect }: CategorySelectorProps) {
  if (categories === null) {
    return <SkeletonBlock height={40} />;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: spacing.sm,
        overflowX: "auto",
        paddingBottom: spacing.xs,
      }}
    >
      <Chip label="همه" active={activeCategoryId === null} onClick={() => onSelect(null)} />
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          active={activeCategoryId === category.id}
          onClick={() => onSelect(category.id)}
        />
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        fontFamily: font.family,
        fontSize: 13,
        fontWeight: 700,
        padding: "8px 16px",
        borderRadius: 999,
        border: `1px solid ${active ? color.primary : color.line}`,
        background: active ? color.primary : color.white,
        color: active ? color.white : color.ink,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
