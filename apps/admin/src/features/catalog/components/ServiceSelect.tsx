"use client";

import { useEffect, useState } from "react";
import { color, font } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { servicesAdminApi } from "../api/services-admin-api";

export interface ServiceSelectProps {
  value: string;
  onChange: (serviceId: string) => void;
  disabled?: boolean;
  required?: boolean;
  /**
   * SERVICES-R5.21 — when set, options are restricted to Services under
   * this Category only (`servicesAdminApi.list` already supports this
   * filter server-side). Used by CategoryCardForm so a discovery card's
   * target Service can never be picked from outside its own Category —
   * the real ownership rule is still enforced server-side regardless
   * (CategoryCardsService.assertOwnership), this is only the UI-level
   * convenience of not offering an invalid choice in the first place.
   */
  categoryId?: string;
}

/**
 * The Service analog of features/home/components/CategorySelect.tsx —
 * displays `Service.title`, submits `Service.id`. Uses the admin listing
 * (not the public one) so a not-yet-activated Service can still be picked
 * for a CardProduct while it's being set up.
 */
export function ServiceSelect({ value, onChange, disabled, required, categoryId }: ServiceSelectProps) {
  // Keyed by the categoryId it was fetched for — so switching categoryId
  // never shows a stale (wrong-category) options list even for the one
  // render before the new fetch resolves; derived at render time instead
  // of an extra synchronous setState(null) inside the effect (which
  // triggers React's "no setState synchronously in an effect body" rule).
  const [fetched, setFetched] = useState<{ categoryId: string | undefined; options: { id: string; title: string }[] } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const options = fetched !== null && fetched.categoryId === categoryId ? fetched.options : null;

  useEffect(() => {
    let cancelled = false;
    servicesAdminApi
      .list(categoryId, 100)
      .then((result) => {
        if (!cancelled) setFetched({ categoryId, options: result.items.map((s) => ({ id: s.id, title: s.title })) });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : "دریافت خدمات با خطا مواجه شد.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  return (
    <div className="biawin-service-select">
      <select
        value={value}
        required={required}
        disabled={disabled || options === null}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {options === null ? "در حال بارگذاری…" : "یک خدمت انتخاب کنید"}
        </option>
        {options?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      {errorMessage && (
        <span role="alert" className="biawin-service-select-error">
          {errorMessage}
        </span>
      )}

      <style>{`
        .biawin-service-select{display:flex;flex-direction:column;gap:6px;font-family:${font.family}}
        .biawin-service-select select{
          height:46px;width:100%;border:1px solid ${color.line};background:${color.ice};
          border-radius:14px;padding:0 14px;font-family:${font.family};font-size:14px;color:${color.ink};
        }
        .biawin-service-select-error{font-size:11px;font-weight:700;color:#c0392b}
      `}</style>
    </div>
  );
}
