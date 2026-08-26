"use client";

import { useState, type FormEvent } from "react";
import { homeServiceMosaicApi } from "../api/home-service-mosaic-api";
import { performSave } from "../logic";
import { FormField } from "../components/FormField";
import { HomeFormShell } from "../components/HomeFormShell";
import { CategorySelect } from "../components/CategorySelect";
import { MediaPickerField } from "../components/MediaPickerField";
import { plainFieldStyles } from "../components/formStyles";
import type { HomeServiceMosaicTileAdmin, HomeServiceMosaicTileInput, MosaicSlot, MosaicTheme } from "../types";

const SLOT_LABEL: Record<MosaicSlot, string> = { half: "نیمه (کوچک)", wide: "عریض (بزرگ)" };
const THEME_LABEL: Record<MosaicTheme, string> = {
  beauty: "زیبایی",
  insurance: "بیمه",
  home: "خانه و زندگی",
  digital: "دیجیتال",
};

export interface ServiceMosaicFormProps {
  mode: "create" | "edit";
  initial?: HomeServiceMosaicTileAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

/** `title`/`lead` are only rendered by the customer app for `wide` tiles (backend/src/modules/home/home-service-mosaic-tiles.service.ts's own doc comment) — kept optional here to match, not required regardless of `slotType`. */
export function ServiceMosaicForm({ mode, initial, readOnly, backHref, onSaved }: ServiceMosaicFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [slotType, setSlotType] = useState<MosaicSlot>(initial?.slotType ?? "half");
  const [kicker, setKicker] = useState(initial?.kicker ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lead, setLead] = useState(initial?.lead ?? "");
  const [theme, setTheme] = useState<MosaicTheme>(initial?.theme ?? "home");
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

    const input: HomeServiceMosaicTileInput = {
      categoryId,
      mediaAssetId,
      slotType,
      kicker,
      title: title || null,
      lead: lead || null,
      theme,
      active,
    };
    const result = await performSave<HomeServiceMosaicTileInput, HomeServiceMosaicTileAdmin>(mode, initial?.id ?? null, input, {
      create: homeServiceMosaicApi.create,
      update: homeServiceMosaicApi.update,
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
      title={mode === "create" ? "کاشی موزاییک جدید" : "ویرایش کاشی موزاییک"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="دسته‌بندی" required>
        <CategorySelect value={categoryId} onChange={setCategoryId} required disabled={readOnly} />
      </FormField>

      <FormField label="نوع جایگاه" required>
        <select value={slotType} onChange={(e) => setSlotType(e.target.value as MosaicSlot)} className="biawin-plain-select">
          {(Object.keys(SLOT_LABEL) as MosaicSlot[]).map((key) => (
            <option key={key} value={key}>
              {SLOT_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="متن کوتاه (kicker)" required>
        <input value={kicker} onChange={(e) => setKicker(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="عنوان" hint="فقط برای کاشی‌های «عریض» استفاده می‌شود.">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="توضیح" hint="فقط برای کاشی‌های «عریض» استفاده می‌شود.">
        <textarea value={lead} onChange={(e) => setLead(e.target.value)} className="biawin-plain-textarea" />
      </FormField>

      <FormField label="تم بصری">
        <select value={theme} onChange={(e) => setTheme(e.target.value as MosaicTheme)} className="biawin-plain-select">
          {(Object.keys(THEME_LABEL) as MosaicTheme[]).map((key) => (
            <option key={key} value={key}>
              {THEME_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <MediaPickerField
        label="تصویر کاشی"
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
