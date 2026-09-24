"use client";

import { useEffect, useState, type FormEvent } from "react";
import { homeHeroApi } from "../api/home-hero-api";
import { heroKeyAvailability } from "../heroKeys";
import { performSave } from "../logic";
import { HOME_LIMITS, summarizeErrors, validateHeroCard, type HeroField } from "../validation";
import { FormField } from "../components/FormField";
import { HomeFormShell } from "../components/HomeFormShell";
import { plainFieldStyles } from "../components/formStyles";
import type { HeroCardColor, HeroCardKey, HomeHeroCardAdmin, HomeHeroCardInput } from "../types";

const CARD_KEY_LABEL: Record<HeroCardKey, string> = {
  earn: "کارت درآمد (earn)",
  biawin: "کارت اصلی بیاوین (biawin)",
  reward: "کارت جایزه (reward)",
};
const COLOR_LABEL: Record<HeroCardColor, string> = { blue: "آبی", sky: "آسمانی", white: "سفید" };

export interface HeroCardFormProps {
  mode: "create" | "edit";
  initial?: HomeHeroCardAdmin;
  readOnly?: boolean;
  backHref: string;
  onSaved: () => void;
}

/**
 * `HomeHeroCard` has no `mediaAssetId` and no link/action field in the real
 * Stage 5.19 model (backend/prisma/schema.prisma) — its visual is a fixed
 * `colorPreset` gradient (`BiawinCardsCarousel.tsx`), not an uploaded
 * image, and there is no "link" concept for a hero card at all. Stage
 * 5.20's brief asks for "select/change associated MediaAsset" and
 * "configure its existing link/action fields" generically across
 * resources, but per its own explicit rule ("do not invent fields that do
 * not exist"), neither is added here — see docs/admin-home-management-ui-
 * report.md §8 for this disclosed deviation from the brief's generic list.
 */
export function HeroCardForm({ mode, initial, readOnly, backHref, onSaved }: HeroCardFormProps) {
  const [cardKey, setCardKey] = useState<HeroCardKey>(initial?.cardKey ?? "earn");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [displayNumber, setDisplayNumber] = useState(initial?.displayNumber ?? "");
  const [ownerLabel, setOwnerLabel] = useState(initial?.ownerLabel ?? "");
  const [colorPreset, setColorPreset] = useState<HeroCardColor>(initial?.colorPreset ?? "blue");
  const [active, setActive] = useState(initial?.active ?? true);

  /** Keys held by OTHER rows; `null` while loading. A failed load falls back to `[]` (the backend 409 stays the authority). */
  const [takenKeys, setTakenKeys] = useState<HeroCardKey[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<HeroField, string>>>({});

  useEffect(() => {
    let cancelled = false;
    homeHeroApi.list().then((result) => {
      if (cancelled) return;
      setTakenKeys(result.items.filter((item) => item.id !== initial?.id).map((item) => item.cardKey));
    }).catch(() => {
      // Non-fatal: worst case the key dropdown offers an already-used key and the backend rejects it on submit (409).
      if (!cancelled) setTakenKeys([]);
    });
    return () => {
      cancelled = true;
    };
  }, [initial?.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values = { label: label.trim(), title: title.trim(), subtitle: subtitle.trim(), displayNumber: displayNumber.trim(), ownerLabel: ownerLabel.trim() };
    const errors = validateHeroCard(values);
    setFieldErrors(errors);
    const summary = summarizeErrors(errors);
    if (summary) {
      setErrorMessage(summary);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const input: HomeHeroCardInput = { cardKey: effectiveKey, ...values, colorPreset, active };
    const result = await performSave<HomeHeroCardInput, HomeHeroCardAdmin>(mode, initial?.id ?? null, input, {
      create: homeHeroApi.create,
      update: homeHeroApi.update,
    });

    if (!result.success) {
      setErrorMessage(result.message);
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  // Until the list has loaded every key is shown (submit stays disabled in create mode).
  const { available: availableKeys, exhausted } =
    takenKeys === null ? { available: (Object.keys(CARD_KEY_LABEL) as HeroCardKey[]), exhausted: false } : heroKeyAvailability(mode, takenKeys, initial?.cardKey);
  const effectiveKey = availableKeys.includes(cardKey) ? cardKey : (availableKeys[0] ?? cardKey);
  const submitDisabled = mode === "create" && (takenKeys === null || exhausted);

  return (
    <HomeFormShell
      title={mode === "create" ? "کارت جدید" : "ویرایش کارت"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
      submitDisabled={submitDisabled}
    >
      {exhausted ? (
        <p role="alert" className="biawin-hero-keys-exhausted">
          هر سه کلید کارت (earn / biawin / reward) قبلاً استفاده شده‌اند و کلید دیگری وجود ندارد. برای ایجاد کارت جدید، ابتدا یکی از کارت‌های موجود را حذف کنید.
        </p>
      ) : (
        <FormField label="کلید کارت" required hint="هر کلید فقط یک‌بار قابل استفاده است.">
          <select value={effectiveKey} onChange={(e) => setCardKey(e.target.value as HeroCardKey)} className="biawin-plain-select">
            {availableKeys.map((key) => (
              <option key={key} value={key}>
                {CARD_KEY_LABEL[key]}
              </option>
            ))}
          </select>
        </FormField>
      )}

      <FormField label="برچسب" required error={fieldErrors.label}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={HOME_LIMITS.hero.label} className="biawin-plain-input" />
      </FormField>

      <FormField label="عنوان" required error={fieldErrors.title}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={HOME_LIMITS.hero.title} className="biawin-plain-input" />
      </FormField>

      <FormField label="زیرعنوان" required error={fieldErrors.subtitle}>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} required maxLength={HOME_LIMITS.hero.subtitle} className="biawin-plain-input" />
      </FormField>

      <FormField label="شماره نمایشی" required hint="تزئینی است — شماره کارت واقعی نیست." error={fieldErrors.displayNumber}>
        <input value={displayNumber} onChange={(e) => setDisplayNumber(e.target.value)} required maxLength={HOME_LIMITS.hero.displayNumber} className="biawin-plain-input" />
      </FormField>

      <FormField label="برچسب صاحب کارت" required error={fieldErrors.ownerLabel}>
        <input value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} required maxLength={HOME_LIMITS.hero.ownerLabel} className="biawin-plain-input" />
      </FormField>

      <FormField label="پیش‌فرض رنگ">
        <select value={colorPreset} onChange={(e) => setColorPreset(e.target.value as HeroCardColor)} className="biawin-plain-select">
          {(Object.keys(COLOR_LABEL) as HeroCardColor[]).map((key) => (
            <option key={key} value={key}>
              {COLOR_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <label className="biawin-plain-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>فعال</span>
      </label>

      <style>{plainFieldStyles}</style>
      <style>{`.biawin-hero-keys-exhausted{margin:0;font-size:12px;font-weight:700;color:#c0392b;background:#fdf1f0;border-radius:10px;padding:10px 14px;line-height:1.8}`}</style>
    </HomeFormShell>
  );
}
