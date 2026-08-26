"use client";

import { useEffect, useState, type FormEvent } from "react";
import { homeHeroApi } from "../api/home-hero-api";
import { performSave } from "../logic";
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
const ALL_KEYS: HeroCardKey[] = ["earn", "biawin", "reward"];

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

  const [takenKeys, setTakenKeys] = useState<HeroCardKey[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    homeHeroApi.list().then((result) => {
      if (cancelled) return;
      const used = result.items.map((item) => item.cardKey).filter((key) => key !== initial?.cardKey);
      setTakenKeys(used);
    }).catch(() => {
      // Non-fatal: worst case the key dropdown offers an already-used key and the backend rejects it on submit.
    });
    return () => {
      cancelled = true;
    };
  }, [initial?.cardKey]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const input: HomeHeroCardInput = { cardKey, label, title, subtitle, displayNumber, ownerLabel, colorPreset, active };
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

  const availableKeys = ALL_KEYS.filter((key) => key === cardKey || !takenKeys.includes(key));

  return (
    <HomeFormShell
      title={mode === "create" ? "کارت جدید" : "ویرایش کارت"}
      backHref={backHref}
      onSubmit={handleSubmit}
      submitting={submitting}
      errorMessage={errorMessage}
      readOnly={readOnly}
    >
      <FormField label="کلید کارت" required hint="هر کلید فقط یک‌بار قابل استفاده است.">
        <select value={cardKey} onChange={(e) => setCardKey(e.target.value as HeroCardKey)} className="biawin-plain-select">
          {availableKeys.map((key) => (
            <option key={key} value={key}>
              {CARD_KEY_LABEL[key]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="برچسب" required>
        <input value={label} onChange={(e) => setLabel(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="عنوان" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="زیرعنوان" required>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="شماره نمایشی" required hint="تزئینی است — شماره کارت واقعی نیست.">
        <input value={displayNumber} onChange={(e) => setDisplayNumber(e.target.value)} required className="biawin-plain-input" />
      </FormField>

      <FormField label="برچسب صاحب کارت" required>
        <input value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} required className="biawin-plain-input" />
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
    </HomeFormShell>
  );
}
