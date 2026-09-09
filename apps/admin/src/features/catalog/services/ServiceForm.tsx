"use client";

import { useState, type FormEvent } from "react";
import { servicesAdminApi } from "../api/services-admin-api";
import { performSave } from "../../home/logic";
import { FormField } from "../../home/components/FormField";
import { HomeFormShell } from "../../home/components/HomeFormShell";
import { CategorySelect } from "../../home/components/CategorySelect";
import { plainFieldStyles } from "../../home/components/formStyles";
import type { PurchaseMethod, ServiceAdmin, ServiceInput } from "../types";

const ALL_METHODS: { value: PurchaseMethod; label: string }[] = [
  { value: "cash", label: "پرداخت کامل" },
  { value: "credit", label: "اعتباری" },
  { value: "installment", label: "اقساطی" },
  { value: "free", label: "رایگان" },
];

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
 */
export function ServiceForm({ mode, initial, readOnly, backHref, onSaved }: ServiceFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [groupLabel, setGroupLabel] = useState(initial?.groupLabel ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [imageKey, setImageKey] = useState(initial?.imageKey ?? "");
  const [priceFrom, setPriceFrom] = useState(initial?.priceFrom?.toString() ?? "");
  const [priceLabel, setPriceLabel] = useState(initial?.priceLabel ?? "");
  const [availableMethods, setAvailableMethods] = useState<PurchaseMethod[]>(initial?.availableMethods ?? []);
  const [active, setActive] = useState(initial?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleMethod(method: PurchaseMethod) {
    setAvailableMethods((current) =>
      current.includes(method) ? current.filter((m) => m !== method) : [...current, method],
    );
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
      imageKey: imageKey || null,
      priceFrom: priceFrom ? Number(priceFrom) : null,
      priceLabel: priceLabel || null,
      availableMethods,
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

      <FormField label="نشان (badge)" required>
        <input value={badge} onChange={(e) => setBadge(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="آیکون (اموجی)">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="کلید تصویر (Storage)">
        <input value={imageKey} onChange={(e) => setImageKey(e.target.value)} className="biawin-plain-input" />
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

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>فعال</span>
      </label>

      <style>{plainFieldStyles}</style>
    </HomeFormShell>
  );
}
