"use client";

import { useState, type FormEvent } from "react";
import { servicesAdminApi } from "../api/services-admin-api";
import { performSave } from "../../home/logic";
import { FormField } from "../../home/components/FormField";
import { HomeFormShell } from "../../home/components/HomeFormShell";
import { CategorySelect } from "../../home/components/CategorySelect";
import { MediaPickerField } from "../../home/components/MediaPickerField";
import { plainFieldStyles } from "../../home/components/formStyles";
import type { PurchaseMethod, ServiceAdmin, ServiceFaqItem, ServiceInput } from "../types";

const ALL_METHODS: { value: PurchaseMethod; label: string }[] = [
  { value: "cash", label: "پرداخت کامل" },
  { value: "credit", label: "اعتباری" },
  { value: "installment", label: "اقساطی" },
  { value: "free", label: "رایگان" },
];

interface GalleryItem {
  key: number;
  mediaAssetId: string | null;
  previewUrl: string | null;
}

let galleryKeySeq = 0;
function nextGalleryKey() {
  galleryKeySeq += 1;
  return galleryKeySeq;
}

function zipGallery(ids: string[], urls: string[]): GalleryItem[] {
  return ids.map((id, i) => ({ key: nextGalleryKey(), mediaAssetId: id, previewUrl: urls[i] ?? null }));
}

export interface ServiceFormProps {
  mode: "create" | "edit";
  initial?: ServiceAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

/**
 * No `journeyType` field — per SERVICES-R5.16's resolved decision, journey
 * type lives on CardProduct, not Service (a Service can offer several
 * journeys via several cards). See docs/services-r5-17-admin-catalog-cms.md.
 *
 * SERVICES-R5.22 adds: main image + optional gallery (both through the
 * Media Library, never a raw key — `imageKey` stays deprecated-in-place,
 * unedited here), full `description`, and the Benefits/Usage-Guide/Terms/
 * FAQ content blocks that `ServiceInfo.tsx`/the future Service Detail
 * sections render. Benefits/Tags/Usage-Guide/Terms follow this codebase's
 * existing comma-joined-list convention (CategoryForm's `keywords`,
 * CardProductForm's `benefits`) rather than inventing a new per-field
 * pattern; FAQ is genuinely structured (question/answer pairs) so it gets
 * its own repeatable-row UI instead.
 */
export function ServiceForm({ mode, initial, readOnly, backHref, onSaved }: ServiceFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [groupLabel, setGroupLabel] = useState(initial?.groupLabel ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  // Deprecated in place — no longer editable (SERVICES-R5.22, all image
  // management now goes through mediaAssetId/galleryMediaAssetIds below).
  const imageKey = initial?.imageKey ?? null;
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(initial?.mediaAssetId ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image ?? null);
  const [gallery, setGallery] = useState<GalleryItem[]>(
    zipGallery(initial?.galleryMediaAssetIds ?? [], initial?.gallery ?? []),
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceFrom, setPriceFrom] = useState(initial?.priceFrom?.toString() ?? "");
  const [priceLabel, setPriceLabel] = useState(initial?.priceLabel ?? "");
  const [availableMethods, setAvailableMethods] = useState<PurchaseMethod[]>(initial?.availableMethods ?? []);
  const [benefits, setBenefits] = useState((initial?.benefits ?? []).join("، "));
  const [tags, setTags] = useState((initial?.tags ?? []).join("، "));
  const [usageGuide, setUsageGuide] = useState((initial?.usageGuide ?? []).join("، "));
  const [terms, setTerms] = useState((initial?.terms ?? []).join("، "));
  const [faq, setFaq] = useState<ServiceFaqItem[]>(
    initial?.faq && initial.faq.length > 0 ? initial.faq : [{ question: "", answer: "" }],
  );
  const [active, setActive] = useState(initial?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleMethod(method: PurchaseMethod) {
    setAvailableMethods((current) =>
      current.includes(method) ? current.filter((m) => m !== method) : [...current, method],
    );
  }

  function addGallerySlot() {
    setGallery((current) => [...current, { key: nextGalleryKey(), mediaAssetId: null, previewUrl: null }]);
  }

  function removeGallerySlot(key: number) {
    setGallery((current) => current.filter((item) => item.key !== key));
  }

  function updateFaqRow(index: number, field: keyof ServiceFaqItem, value: string) {
    setFaq((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addFaqRow() {
    setFaq((current) => [...current, { question: "", answer: "" }]);
  }

  function removeFaqRow(index: number) {
    setFaq((current) => current.filter((_, i) => i !== index));
  }

  function splitCommaList(value: string): string[] {
    return value
      .split(/[،,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId) {
      setErrorMessage("انتخاب دسته‌بندی الزامی است.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const input: ServiceInput = {
      categoryId,
      title,
      groupLabel,
      subtitle,
      badge,
      icon: icon || null,
      imageKey,
      mediaAssetId,
      galleryMediaAssetIds: gallery.map((item) => item.mediaAssetId).filter((id): id is string => !!id),
      description: description || null,
      priceFrom: priceFrom ? Number(priceFrom) : null,
      priceLabel: priceLabel || null,
      availableMethods,
      benefits: splitCommaList(benefits),
      tags: splitCommaList(tags),
      usageGuide: splitCommaList(usageGuide),
      terms: splitCommaList(terms),
      faq: faq.filter((row) => row.question.trim() || row.answer.trim()),
      active,
    };
    const result = await performSave<ServiceInput, ServiceAdmin>(mode, initial?.id ?? null, input, {
      create: servicesAdminApi.create,
      update: servicesAdminApi.update,
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
      title={mode === "create" ? "خدمت جدید" : "ویرایش خدمت"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="دسته‌بندی" required>
        <CategorySelect value={categoryId} onChange={setCategoryId} required disabled={readOnly} />
      </FormField>

      <FormField label="عنوان" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="برچسب گروه" required>
        <input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="زیرعنوان (توضیح کوتاه)" required>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="توضیحات کامل" hint="متن کامل توضیح خدمت — جدا از زیرعنوان کوتاه بالا.">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="biawin-plain-textarea"
        />
      </FormField>

      <FormField label="نشان (badge)" required>
        <input value={badge} onChange={(e) => setBadge(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="آیکون (اموجی)">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <MediaPickerField
        label="تصویر اصلی خدمت"
        value={mediaAssetId}
        previewUrl={previewUrl}
        disabled={readOnly}
        onChange={(id, url) => {
          setMediaAssetId(id);
          setPreviewUrl(url);
        }}
      />

      <FormField label="گالری تصاویر (اختیاری)">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {gallery.map((item, index) => (
            <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <MediaPickerField
                label={`تصویر گالری ${index + 1}`}
                value={item.mediaAssetId}
                previewUrl={item.previewUrl}
                disabled={readOnly}
                onChange={(id, url) => {
                  setGallery((current) =>
                    current.map((g) => (g.key === item.key ? { ...g, mediaAssetId: id, previewUrl: url } : g)),
                  );
                }}
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeGallerySlot(item.key)}
                  className="biawin-plain-input"
                  style={{ cursor: "pointer" }}
                >
                  حذف
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={addGallerySlot} className="biawin-plain-input" style={{ cursor: "pointer" }}>
              افزودن تصویر به گالری
            </button>
          )}
        </div>
      </FormField>

      <FormField
        label="قیمت پایه (ریال)"
        hint="فقط جنبه نمایشی دارد — مرجع تراکنش نیست (docs/services-r5-2-pricing-and-eligibility-domain.md)."
      >
        <input
          type="number"
          value={priceFrom}
          onChange={(e) => setPriceFrom(e.target.value)}
          className="biawin-plain-input"
        />
      </FormField>

      <FormField label="برچسب قیمت (نمایشی)">
        <input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="روش‌های خرید قابل‌پشتیبانی">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {ALL_METHODS.map((m) => (
            <label key={m.value} className="biawin-plain-checkbox">
              <input
                type="checkbox"
                checked={availableMethods.includes(m.value)}
                onChange={() => toggleMethod(m.value)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </FormField>

      <FormField label="مزایا" hint="با ویرگول جدا کنید — مثال: «خرید از برندهای معتبر، بدون سود، ارسال سریع».">
        <input value={benefits} onChange={(e) => setBenefits(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="برچسب‌ها (جستجو/دسته‌بندی داخلی)" hint="با ویرگول جدا کنید.">
        <input value={tags} onChange={(e) => setTags(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="راهنمای استفاده" hint="با ویرگول جدا کنید — مثال: «خرید کارت، ورود به سایت مقصد، استفاده از اعتبار».">
        <input value={usageGuide} onChange={(e) => setUsageGuide(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="شرایط و ضوابط" hint="با ویرگول جدا کنید.">
        <input value={terms} onChange={(e) => setTerms(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="سوالات متداول">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faq.map((row, index) => (
            <div
              key={index}
              style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid #e3e3e3", borderRadius: 10, padding: 10 }}
            >
              <input
                value={row.question}
                onChange={(e) => updateFaqRow(index, "question", e.target.value)}
                placeholder="سوال"
                className="biawin-plain-input"
                disabled={readOnly}
              />
              <textarea
                value={row.answer}
                onChange={(e) => updateFaqRow(index, "answer", e.target.value)}
                placeholder="پاسخ"
                className="biawin-plain-textarea"
                disabled={readOnly}
              />
              {!readOnly && faq.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFaqRow(index)}
                  className="biawin-plain-input"
                  style={{ cursor: "pointer", alignSelf: "flex-start" }}
                >
                  حذف این سوال
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={addFaqRow} className="biawin-plain-input" style={{ cursor: "pointer" }}>
              افزودن سوال
            </button>
          )}
        </div>
      </FormField>

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>فعال</span>
      </label>

      <style>{plainFieldStyles}</style>
    </HomeFormShell>
  );
}
