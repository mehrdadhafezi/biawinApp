"use client";

import { useState, type FormEvent } from "react";
import { homeServiceBannerApi } from "../api/home-service-banner-api";
import { performSave } from "../logic";
import { FormField } from "../components/FormField";
import { HomeFormShell } from "../components/HomeFormShell";
import { CategorySelect } from "../components/CategorySelect";
import { MediaPickerField } from "../components/MediaPickerField";
import { plainFieldStyles } from "../components/formStyles";
import type { BannerTheme, HomeServiceBannerAdmin, HomeServiceBannerInput } from "../types";

const THEME_LABEL: Record<BannerTheme, string> = {
  auto: "خودرو",
  home: "خانه و زندگی",
  fashion: "پوشاک",
  gold: "طلا و جواهر",
  travel: "سفر و گردشگری",
};

export interface ServiceBannerFormProps {
  mode: "create" | "edit";
  initial?: HomeServiceBannerAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

export function ServiceBannerForm({ mode, initial, readOnly, backHref, onSaved }: ServiceBannerFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [kicker, setKicker] = useState(initial?.kicker ?? "");
  const [theme, setTheme] = useState<BannerTheme>(initial?.theme ?? "auto");
  const [wide, setWide] = useState(initial?.wide ?? false);
  const [active, setActive] = useState(initial?.active ?? true);
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(initial?.mediaAssetId ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId) {
      setErrorMessage("انتخاب دسته‌بندی الزامی است.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const input: HomeServiceBannerInput = { categoryId, mediaAssetId, kicker, theme, wide, active };
    const result = await performSave<HomeServiceBannerInput, HomeServiceBannerAdmin>(mode, initial?.id ?? null, input, {
      create: homeServiceBannerApi.create,
      update: homeServiceBannerApi.update,
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
      title={mode === "create" ? "بنر خدمت جدید" : "ویرایش بنر خدمت"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="دسته‌بندی" required>
        <CategorySelect value={categoryId} onChange={setCategoryId} required disabled={readOnly} />
      </FormField>

      <FormField label="متن کوتاه (kicker)" required>
        <input value={kicker} onChange={(e) => setKicker(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="تم بصری">
        <select value={theme} onChange={(e) => setTheme(e.target.value as BannerTheme)} className="biawin-plain-select">
          {(Object.keys(THEME_LABEL) as BannerTheme[]).map((key) => (
            <option key={key} value={key}>
              {THEME_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} />
        <span>بنر عریض</span>
      </label>

      <MediaPickerField
        label="تصویر بنر"
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
