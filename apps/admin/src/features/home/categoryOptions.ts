import type { CategoryOption } from "./types";

export interface CategorySelectOption {
  id: string;
  label: string;
  /** The category is inactive (shown only because an existing row already references it). */
  inactive: boolean;
}

export const INACTIVE_CATEGORY_SUFFIX = " (غیرفعال)";

/**
 * Stage 5.17-B — dropdown options for a Home row's category.
 *
 * Active categories are always offered. If the row already references a
 * category that is NOT active (the backend keeps such Home rows public —
 * BD-1 — and a real staging banner does), that category stays visible and
 * selected, marked "(غیرفعال)", so the form never falls back to a placeholder
 * while still holding the real id. It is display only: the id is never
 * rewritten and the category is never activated by this form; the admin may
 * replace it with an active category.
 *
 * `currentLabel` (the row's own `categoryName`) is used when the selected id
 * is missing from the fetched list entirely (label unknown).
 */
export function buildCategoryOptions(
  all: CategoryOption[],
  selectedId: string,
  currentLabel?: string | null,
): CategorySelectOption[] {
  const options: CategorySelectOption[] = all
    .filter((category) => category.active)
    .map((category) => ({ id: category.id, label: category.name, inactive: false }));

  if (selectedId && !options.some((option) => option.id === selectedId)) {
    const known = all.find((category) => category.id === selectedId);
    const name = known?.name ?? currentLabel ?? "دسته‌بندی فعلی";
    options.unshift({ id: selectedId, label: `${name}${INACTIVE_CATEGORY_SUFFIX}`, inactive: true });
  }
  return options;
}
