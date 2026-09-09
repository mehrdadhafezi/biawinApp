"use client";

import { useState, type FormEvent } from "react";
import { categoriesAdminApi } from "../api/categories-admin-api";
import { performSave } from "../../home/logic";
import { FormField } from "../../home/components/FormField";
import { HomeFormShell } from "../../home/components/HomeFormShell";
import { plainFieldStyles } from "../../home/components/formStyles";
import type { CategoryAdmin, CategoryInput } from "../types";

export interface CategoryFormProps {
  mode: "create" | "edit";
  initial?: CategoryAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

export function CategoryForm({ mode, initial, readOnly, backHref, onSaved }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageKey, setImageKey] = useState(initial?.imageKey ?? "");
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join("، "));
  const [active, setActive] = useState(initial?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const input: CategoryInput = {
      name,
      description,
      imageKey: imageKey || null,
      keywords: keywords
        .split(/[،,]/)
        .map((k) => k.trim())
        .filter(Boolean),
      active,
    };
    const result = await performSave<CategoryInput, CategoryAdmin>(mode, initial?.id ?? null, input, {
      create: categoriesAdminApi.create,
      update: categoriesAdminApi.update,
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
      title={mode === "create" ? "دسته‌بندی جدید" : "ویرایش دسته‌بندی"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="نام" required>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="توضیحات" required>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="biawin-plain-textarea"
        />
      </FormField>

      <FormField label="کلید تصویر (Storage)" hint="کلید فایل آپلودشده در کتابخانه رسانه، در صورت وجود.">
        <input value={imageKey} onChange={(e) => setImageKey(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="کلیدواژه‌ها" hint="با ویرگول جدا کنید.">
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>فعال</span>
      </label>

      <style>{plainFieldStyles}</style>
    </HomeFormShell>
  );
}
