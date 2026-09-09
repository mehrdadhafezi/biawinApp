"use client";

import { useState, type FormEvent } from "react";
import { cardProductsAdminApi } from "../api/card-products-admin-api";
import { performSave } from "../../home/logic";
import { FormField } from "../../home/components/FormField";
import { HomeFormShell } from "../../home/components/HomeFormShell";
import { ServiceSelect } from "../components/ServiceSelect";
import { plainFieldStyles } from "../../home/components/formStyles";
import type {
  CardProductAdmin,
  CardProductInput,
  CardProductStatus,
  CardType,
  CardValueDisplayType,
  JourneyType,
} from "../types";

const VALUE_DISPLAY_TYPE_LABEL: Record<CardValueDisplayType, string> = {
  FIXED: "مقدار ثابت",
  UP_TO: "سقف اعتبار (تا سقف)",
};

const CARD_TYPE_LABEL: Record<CardType, string> = {
  CREDIT_CARD: "کارت اعتباری",
  DISCOUNT_CARD: "کارت تخفیفی",
  SUBSCRIPTION: "اشتراک",
  VOUCHER: "ووچر",
  INSTALLMENT_CARD: "کارت اقساطی",
};

const JOURNEY_TYPE_LABEL: Record<JourneyType, string> = {
  PURCHASE: "خرید مستقیم",
  CREDIT_REQUEST: "درخواست اعتبار",
  LEAD: "ثبت سرنخ",
  EXTERNAL_REDIRECT: "ارجاع بیرونی",
  QUOTE_REQUEST: "درخواست استعلام قیمت",
  FREE_SERVICE: "خدمت رایگان",
};

const STATUS_LABEL: Record<CardProductStatus, string> = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  EXPIRED: "منقضی",
};

export interface CardProductFormProps {
  mode: "create" | "edit";
  initial?: CardProductAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

/**
 * `priceAmount` is stored and managed by Admin directly here — no payment/
 * gateway/wallet/installment/discount logic exists or is implied by this
 * form (SERVICES-R5.17 scope; see docs/services-r5-17-admin-catalog-cms.md).
 *
 * SERVICES-R5.19 adds `valueAmount`/`valueDisplayType` — the card's
 * displayed commercial value/credit ceiling, deliberately separate from
 * `priceAmount` (what the customer pays Biawin). See
 * docs/services-r5-19-card-product-purchase-order-foundation.md §6.
 */
export function CardProductForm({ mode, initial, readOnly, backHref, onSaved }: CardProductFormProps) {
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [imageKey, setImageKey] = useState(initial?.imageKey ?? "");
  const [cardType, setCardType] = useState<CardType>(initial?.cardType ?? "CREDIT_CARD");
  const [journeyType, setJourneyType] = useState<JourneyType>(initial?.journeyType ?? "PURCHASE");
  const [priceAmount, setPriceAmount] = useState(initial?.priceAmount?.toString() ?? "");
  const [priceLabel, setPriceLabel] = useState(initial?.priceLabel ?? "");
  const [valueAmount, setValueAmount] = useState(initial?.valueAmount?.toString() ?? "");
  const [valueDisplayType, setValueDisplayType] = useState<CardValueDisplayType | "">(
    initial?.valueDisplayType ?? "",
  );
  const [validityDays, setValidityDays] = useState(initial?.validityDays?.toString() ?? "");
  const [status, setStatus] = useState<CardProductStatus>(initial?.status ?? "DRAFT");
  const [benefits, setBenefits] = useState((initial?.benefits ?? []).join("، "));

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!serviceId) {
      setErrorMessage("انتخاب خدمت الزامی است.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const input: CardProductInput = {
      serviceId,
      title,
      subtitle: subtitle || null,
      description: description || null,
      badge: badge || null,
      imageKey: imageKey || null,
      cardType,
      journeyType,
      priceAmount: priceAmount ? Number(priceAmount) : null,
      priceLabel: priceLabel || null,
      valueAmount: valueAmount ? Number(valueAmount) : null,
      valueDisplayType: valueDisplayType || null,
      validityDays: validityDays ? Number(validityDays) : null,
      status,
      benefits: benefits
        .split(/[،,]/)
        .map((b) => b.trim())
        .filter(Boolean),
    };
    const result = await performSave<CardProductInput, CardProductAdmin>(mode, initial?.id ?? null, input, {
      create: cardProductsAdminApi.create,
      update: cardProductsAdminApi.update,
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
      title={mode === "create" ? "کارت محصول جدید" : "ویرایش کارت محصول"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="خدمت" required>
        <ServiceSelect value={serviceId} onChange={setServiceId} required disabled={readOnly} />
      </FormField>

      <FormField label="عنوان" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="زیرعنوان">
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="توضیحات">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="biawin-plain-textarea"
        />
      </FormField>

      <FormField label="نشان (badge)">
        <input value={badge} onChange={(e) => setBadge(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="کلید تصویر (Storage)">
        <input value={imageKey} onChange={(e) => setImageKey(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="نوع کارت" required>
        <select value={cardType} onChange={(e) => setCardType(e.target.value as CardType)} className="biawin-plain-select">
          {(Object.keys(CARD_TYPE_LABEL) as CardType[]).map((key) => (
            <option key={key} value={key}>
              {CARD_TYPE_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="نوع مسیر کاربر (Journey)" required>
        <select
          value={journeyType}
          onChange={(e) => setJourneyType(e.target.value as JourneyType)}
          className="biawin-plain-select"
        >
          {(Object.keys(JOURNEY_TYPE_LABEL) as JourneyType[]).map((key) => (
            <option key={key} value={key}>
              {JOURNEY_TYPE_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="مبلغ (ریال)" hint="توسط ادمین ثبت می‌شود — بدون اتصال به درگاه پرداخت.">
        <input
          type="number"
          value={priceAmount}
          onChange={(e) => setPriceAmount(e.target.value)}
          className="biawin-plain-input"
        />
      </FormField>

      <FormField label="برچسب قیمت (نمایشی)">
        <input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="ارزش/سقف کارت (ریال)" hint="ارزش نمایشی کارت برای مشتری — با «مبلغ» بالا (که مشتری به بیاوین پرداخت می‌کند) اشتباه گرفته نشود.">
        <input
          type="number"
          value={valueAmount}
          onChange={(e) => setValueAmount(e.target.value)}
          className="biawin-plain-input"
        />
      </FormField>

      <FormField label="نوع نمایش ارزش کارت">
        <select
          value={valueDisplayType}
          onChange={(e) => setValueDisplayType(e.target.value as CardValueDisplayType | "")}
          className="biawin-plain-select"
        >
          <option value="">—</option>
          {(Object.keys(VALUE_DISPLAY_TYPE_LABEL) as CardValueDisplayType[]).map((key) => (
            <option key={key} value={key}>
              {VALUE_DISPLAY_TYPE_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="مدت اعتبار (روز)">
        <input
          type="number"
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          className="biawin-plain-input"
        />
      </FormField>

      <FormField label="مزایا" hint="با ویرگول جدا کنید.">
        <input value={benefits} onChange={(e) => setBenefits(e.target.value)} className="biawin-plain-input" />
      </FormField>

      <FormField label="وضعیت" required>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CardProductStatus)}
          className="biawin-plain-select"
        >
          {(Object.keys(STATUS_LABEL) as CardProductStatus[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <style>{plainFieldStyles}</style>
    </HomeFormShell>
  );
}
