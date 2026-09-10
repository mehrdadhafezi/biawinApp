"use client";

import { useState, type FormEvent } from "react";
import { categoryCardsAdminApi } from "../api/category-cards-admin-api";
import { performSave } from "../../home/logic";
import { FormField } from "../../home/components/FormField";
import { HomeFormShell } from "../../home/components/HomeFormShell";
import { CategorySelect } from "../../home/components/CategorySelect";
import { MediaPickerField } from "../../home/components/MediaPickerField";
import { plainFieldStyles } from "../../home/components/formStyles";
import { ServiceSelect } from "../components/ServiceSelect";
import type { CategoryCardAdmin, CategoryCardInput } from "../types";

export interface CategoryCardFormProps {
  mode: "create" | "edit";
  initial?: CategoryCardAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

const MAX_HIGHLIGHTS = 2;

/**
 * SERVICES-R5.21 — mirrors ServiceBannerForm.tsx's exact shape (the only
 * existing catalog-adjacent form already wired to a real MediaPickerField).
 * `targetServiceId` uses the category-scoped `ServiceSelect` (only offers
 * Services under the currently-selected Category) — a UI-level
 * convenience only; the real ownership rule is enforced server-side
 * regardless (CategoryCardsService.assertOwnership), so picking a Service
 * from the wrong Category is never actually possible to save, even if this
 * client-side narrowing were somehow bypassed.
 *
 * Deliberately contains no pricing/CardProduct-shaped field — a Content
 * Editor manages exactly the discovery/marketing fields the task
 * specifies (title, subtitle, badge, image, highlights, display order,
 * active status, target service), nothing else.
 */
export function CategoryCardForm({ mode, initial, readOnly, backHref, onSaved }: CategoryCardFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [targetServiceId, setTargetServiceId] = useState(initial?.targetServiceId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(initial?.mediaAssetId ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image ?? null);
  const [highlight1, setHighlight1] = useState(initial?.highlights?.[0] ?? "");
  const [highlight2, setHighlight2] = useState(initial?.highlights?.[1] ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder?.toString() ?? "0");
  const [active, setActive] = useState(initial?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    // A Service picked under the PREVIOUS category is no longer a valid
    // choice once the category changes — cleared rather than silently
    // kept, so the form never submits a stale, now-invalid combination.
    setTargetServiceId("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId) {
      setErrorMessage("انتخاب دسته‌بندی الزامی است.");
      return;
    }
    if (!targetServiceId) {
      setErrorMessage("انتخاب خدمت هدف الزامی است.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const input: CategoryCardInput = {
      categoryId,
      targetServiceId,
      title,
      subtitle: subtitle || null,
      badge: badge || null,
      mediaAssetId,
      highlights: [highlight1, highlight2].map((h) => h.trim()).filter(Boolean),
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      active,
    };
    const result = await performSave<CategoryCardInput, CategoryCardAdmin>(mode, initial?.id ?? null, input, {
      create: categoryCardsAdminApi.create,
      update: categoryCardsAdminApi.update,
    });

    if (!result.success) {
      setErrorMessage(result.message);
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  return (
    <HomeFormShell
      title={mode === "create" ? "کارت دسته‌بندی جدید" : "ویرایش کارت دسته‌بندی"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="دسته‌بندی" required>
        <CategorySelect value={categoryId} onChange={handleCategoryChange} required disabled={readOnly} />
      </FormField>

      <FormField label="خدمت هدف" required hint="با کلیک روی این کارت، مشتری به صفحه همین خدمت هدایت می‌شود — نه به کارت محصول یا خرید.">
        <ServiceSelect
          value={targetServiceId}
          onChange={setTargetServiceId}
          categoryId={categoryId || undefined}
          required
          disabled={readOnly || !categoryId}
        />
      </FormField>

      <FormField label="عنوان" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="زیرعنوان">
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="نشان (badge)">
        <input value={badge} onChange={(e) => setBadge(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <MediaPickerField
        label="تصویر کارت"
        value={mediaAssetId}
        previewUrl={previewUrl}
        disabled={readOnly}
        onChange={(id, url) => {
          setMediaAssetId(id);
          setPreviewUrl(url);
        }}
      />

      <FormField label="ویژگی برجسته ۱" hint={`حداکثر ${MAX_HIGHLIGHTS} مورد — مثال: «خدمات متنوع پوشاک»`}>
        <input value={highlight1} onChange={(e) => setHighlight1(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="ویژگی برجسته ۲" hint="مثال: «طرح‌های خرید و پشتیبانی»">
        <input value={highlight2} onChange={(e) => setHighlight2(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="ترتیب نمایش">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="biawin-plain-input"
        />
      </FormField>

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>فعال</span>
      </label>

      <style>{plainFieldStyles}</style>
    </HomeFormShell>
  );
}
