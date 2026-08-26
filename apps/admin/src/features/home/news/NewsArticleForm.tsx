"use client";

import { useState, type FormEvent } from "react";
import { homeNewsApi } from "../api/home-news-api";
import { performSave } from "../logic";
import { FormField } from "../components/FormField";
import { HomeFormShell } from "../components/HomeFormShell";
import { MediaPickerField } from "../components/MediaPickerField";
import { plainFieldStyles } from "../components/formStyles";
import type { HomeNewsArticleAdmin, HomeNewsArticleInput } from "../types";

export interface NewsArticleFormProps {
  mode: "create" | "edit";
  initial?: HomeNewsArticleAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

/**
 * Manages only the Home news-carousel resource (`HomeNewsArticle`) — the
 * real Stage 5.19 model has no publish-date/author/tag fields beyond what's
 * exposed here, so this is not expanded into a general News CMS.
 * `bodySlug` is the model's one link-shaped field, explicitly documented on
 * the backend DTO as "reserved for when 'مشاهده مقاله' becomes a real
 * link — unused today" — exposed here as an optional field for the same
 * reason, not as a working link yet.
 */
export function NewsArticleForm({ mode, initial, readOnly, backHref, onSaved }: NewsArticleFormProps) {
  const [category, setCategory] = useState(initial?.category ?? "");
  const [kicker, setKicker] = useState(initial?.kicker ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lead, setLead] = useState(initial?.lead ?? "");
  const [bodySlug, setBodySlug] = useState(initial?.bodySlug ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(initial?.mediaAssetId ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const input: HomeNewsArticleInput = {
      category,
      mediaAssetId,
      kicker,
      title,
      lead,
      bodySlug: bodySlug || null,
      active,
    };
    const result = await performSave<HomeNewsArticleInput, HomeNewsArticleAdmin>(mode, initial?.id ?? null, input, {
      create: homeNewsApi.create,
      update: homeNewsApi.update,
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
      title={mode === "create" ? "خبر جدید" : "ویرایش خبر"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="دسته‌بندی خبر" required hint="برچسب تحریریه است — به کاتالوگ دسته‌بندی‌ها متصل نیست.">
        <input value={category} onChange={(e) => setCategory(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="متن کوتاه (kicker)" required>
        <input value={kicker} onChange={(e) => setKicker(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="عنوان" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="متن مقدمه" required>
        <textarea value={lead} onChange={(e) => setLead(e.target.value)} required className="biawin-plain-textarea" />
      </FormField>

      <FormField label="شناسه لینک مقاله (bodySlug)" hint="اکنون استفاده نمی‌شود — برای زمانی که «مشاهده مقاله» به لینک واقعی تبدیل شود.">
        <input value={bodySlug} onChange={(e) => setBodySlug(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <MediaPickerField
        label="تصویر خبر"
        value={mediaAssetId}
        previewUrl={previewUrl}
        disabled={readOnly}
        onChange={(id, url) => {
          setMediaAssetId(id);
          setPreviewUrl(url);
        }}
      />

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>فعال</span>
      </label>

      <style>{plainFieldStyles}</style>
    </HomeFormShell>
  );
}
