"use client";

import { useEffect, useState } from "react";
import { color, font } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { categoriesApi } from "../api/categories-api";
import type { CategoryOption } from "../types";

export interface CategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Displays `Category.name`, submits `Category.id` — never the reverse. This
 * is the exact distinction Stage 5.19's backend report calls out as fixing
 * the Stage 5.14.1 bug class (a banner rendered against the wrong category
 * because it matched on display name). Only active categories are offered;
 * an inactive category already assigned to existing content (via a
 * `categoryId` that no longer appears here) is preserved as-is by simply
 * not being touched unless the admin explicitly changes the selection.
 */
export function CategorySelect({ value, onChange, disabled, required }: CategorySelectProps) {
  const [options, setOptions] = useState<CategoryOption[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    categoriesApi
      .listActive()
      .then((items) => {
        if (!cancelled) setOptions(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : "دریافت دسته‌بندی‌ها با خطا مواجه شد.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="biawin-category-select">
      <select
        value={value}
        required={required}
        disabled={disabled || options === null}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {options === null ? "در حال بارگذاری…" : "یک دسته‌بندی انتخاب کنید"}
        </option>
        {options?.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {errorMessage && (
        <span role="alert" className="biawin-category-select-error">
          {errorMessage}
        </span>
      )}

      <style>{`
        .biawin-category-select{display:flex;flex-direction:column;gap:6px}
        .biawin-category-select select{
          height:46px;width:100%;border:1px solid ${color.line};background:${color.ice};
          border-radius:14px;padding:0 14px;font-family:${font.family};font-size:14px;color:${color.ink};
        }
        .biawin-category-select-error{font-size:11px;font-weight:700;color:#c0392b}
      `}</style>
    </div>
  );
}
