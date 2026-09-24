"use client";

import { useState, type FormEvent } from "react";
import { homeNewsApi } from "../api/home-news-api";
import { performSave } from "../logic";
import { FormField } from "../components/FormField";
import { HomeFormShell } from "../components/HomeFormShell";
import { MediaPickerField } from "../components/MediaPickerField";
import { plainFieldStyles } from "../components/formStyles";
import { clearMedia, initMediaField, mediaPayloadValue, selectMedia } from "../mediaField";
import { HOME_LIMITS, summarizeErrors, validateNewsArticle, type NewsField } from "../validation";
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
  // Stage 5.17-B: an unavailable (soft-deleted) original reference is never re-submitted unless explicitly resolved - see mediaField.ts.
  const [media, setMedia] = useState(() => initMediaField(initial));
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NewsField, string>>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const mediaAssetId = mediaPayloadValue(media);
    const values = { category: category.trim(), kicker: kicker.trim(), title: title.trim(), lead: lead.trim(), bodySlug: bodySlug.trim() };
    const errors = validateNewsArticle({ ...values, mediaAssetId });
    setFieldErrors(errors);
    const summary = summarizeErrors(errors);
    if (summary) {
      setErrorMessage(summary);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const input: HomeNewsArticleInput = {
      category: values.category,
      mediaAssetId,
      kicker: values.kicker,
      title: values.title,
      lead: values.lead,
      bodySlug: values.bodySlug || null,
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
      <FormField label="دسته‌بندی خبر" required hint="برچسب تحریریه است — به کاتالوگ دسته‌بندی‌ها متصل نیست." error={fieldErrors.category}>
        <input value={category} onChange={(e) => setCategory(e.target.value)} required maxLength={HOME_LIMITS.news.category} className="biawin-plain-input" />
      </FormField>

      <FormField label="متن کوتاه (kicker)" required error={fieldErrors.kicker}>
        <input value={kicker} onChange={(e) => setKicker(e.target.value)} required maxLength={HOME_LIMITS.news.kicker} className="biawin-plain-input" />
      </FormField>

      <FormField label="عنوان" required error={fieldErrors.title}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={HOME_LIMITS.news.title} className="biawin-plain-input" />
      </FormField>

      <FormField label="متن مقدمه" required error={fieldErrors.lead}>
        <textarea value={lead} onChange={(e) => setLead(e.target.value)} required maxLength={HOME_LIMITS.news.lead} className="biawin-plain-textarea" />
      </FormField>

      <FormField label="شناسه لینک مقاله (bodySlug)" hint="اختیاری و یکتا؛ فقط حروف کوچک انگلیسی، عدد و خط تیره (مثال: spring-sale-2026). اکنون در سایت استفاده نمی‌شود." error={fieldErrors.bodySlug}>
        <input value={bodySlug} onChange={(e) => setBodySlug(e.target.value)} maxLength={HOME_LIMITS.news.bodySlug} className="biawin-plain-input" />
      </FormField>

      <MediaPickerField
        label="تصویر خبر"
        value={media.value}
        previewUrl={previewUrl}
        disabled={readOnly}
        unavailable={media.unavailable && !media.resolved}
        onChange={(id, url) => {
          setMedia(id ? selectMedia(id) : clearMedia());
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
