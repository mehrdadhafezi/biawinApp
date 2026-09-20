import type { CardType } from "../../lib/services-api";
import { CARD_TYPE_SHORT_LABEL } from "./cardProductPresentation";
import type { CardTypeFilter } from "./categoryLandingFilter";

export interface CategoryLandingToolsProps {
  categoryName: string;
  search: string;
  onSearchChange: (value: string) => void;
  /** Real card types present in this category — one chip each, after "همه". */
  cardTypes: CardType[];
  filter: CardTypeFilter;
  onFilterChange: (filter: CardTypeFilter) => void;
}

/**
 * The prototype's `.category-tools` — the search field (placeholder
 * "جستجو در کارت‌های {دسته}...") and the single-select filter chip row.
 * Both act only on this category's own cards (page-local state over the
 * server-scoped list). The chip row exists only once the category has
 * cards, and offers only the types that actually exist in it.
 */
export function CategoryLandingTools({ categoryName, search, onSearchChange, cardTypes, filter, onFilterChange }: CategoryLandingToolsProps) {
  const filters: { key: CardTypeFilter; label: string }[] = [
    { key: "all", label: "همه" },
    ...cardTypes.map((t) => ({ key: t as CardTypeFilter, label: CARD_TYPE_SHORT_LABEL[t] })),
  ];

  return (
    <section className="cl-tools">
      <label className="cl-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          type="search"
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`جستجو در کارت‌های ${categoryName}...`}
          aria-label={`جستجو در کارت‌های ${categoryName}`}
        />
      </label>
      {cardTypes.length > 0 && (
        <div className="cl-filter-row" role="group" aria-label="نوع کارت">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cl-filter${filter === f.key ? " active" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
