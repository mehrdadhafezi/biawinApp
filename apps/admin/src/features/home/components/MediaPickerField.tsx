"use client";

import { useState } from "react";
import { color, font } from "@biawin/ui";
import { MediaPickerModal } from "./MediaPickerModal";

export interface MediaPickerFieldProps {
  label: string;
  /** Current `mediaAssetId`, or `null` if unset. */
  value: string | null;
  /** Resolved preview URL for `value` (already backend-resolved — see `resolveMediaUrl` on the backend), or `null`. */
  previewUrl: string | null;
  onChange: (mediaAssetId: string | null, previewUrl: string | null) => void;
  disabled?: boolean;
  hint?: string;
  /** The ORIGINAL reference points to an asset that no longer exists/is deleted (Stage 5.17-B) — shown explicitly instead of a silent "no image". */
  unavailable?: boolean;
}

/**
 * The reusable field used by every Home resource form that has a
 * `mediaAssetId` relation (banners, mosaic tiles, news — NOT hero cards,
 * which have no such field in the real Stage 5.19 model; see
 * `HeroCardForm.tsx`'s own comment). Shows "تصویری انتخاب نشده است" rather
 * than silently substituting a placeholder image — required by Stage
 * 5.20's brief §18, since real static assets haven't been migrated into
 * MediaAsset yet for the seeded content.
 */
export function MediaPickerField({ label, value, previewUrl, onChange, disabled, hint, unavailable }: MediaPickerFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="biawin-media-picker-field">
      <span className="biawin-media-picker-field-label">{label}</span>
      <div className="biawin-media-picker-field-preview">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : unavailable ? (
          <span className="biawin-media-picker-field-empty" role="alert">
            تصویر قبلی در دسترس نیست
          </span>
        ) : (
          <span className="biawin-media-picker-field-empty">تصویری انتخاب نشده است</span>
        )}
      </div>
      {unavailable && (
        <span role="alert" className="biawin-media-picker-field-warning">
          تصویر قبلی این مورد حذف شده است و در سایت نمایش داده نمی‌شود. تا زمانی که تصویر جایگزین انتخاب نکنید یا مرجع را پاک نکنید، مرجع قبلی بدون تغییر می‌ماند و با ذخیره تغییر نمی‌کند.
        </span>
      )}
      <div className="biawin-media-picker-field-actions">
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="biawin-media-picker-field-btn">
          {unavailable ? "انتخاب تصویر جایگزین" : value ? "تغییر تصویر" : "انتخاب تصویر"}
        </button>
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null, null)}
            className="biawin-media-picker-field-btn biawin-media-picker-field-btn--ghost"
          >
            {unavailable ? "پاک‌کردن مرجع تصویر" : "حذف انتخاب"}
          </button>
        )}
      </div>
      {hint && <span className="biawin-media-picker-field-hint">{hint}</span>}

      <MediaPickerModal open={open} onClose={() => setOpen(false)} onSelect={(asset) => onChange(asset.id, asset.url)} />

      <style>{`
        .biawin-media-picker-field{display:flex;flex-direction:column;gap:8px;font-family:${font.family};font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-media-picker-field-label{}
        .biawin-media-picker-field-preview{
          width:140px;height:140px;border-radius:14px;border:1px dashed ${color.line};background:${color.ice};
          display:flex;align-items:center;justify-content:center;overflow:hidden;
        }
        .biawin-media-picker-field-preview img{width:100%;height:100%;object-fit:cover}
        .biawin-media-picker-field-empty{font-size:11px;font-weight:400;color:${color.muted};text-align:center;padding:0 10px}
        .biawin-media-picker-field-actions{display:flex;gap:8px}
        .biawin-media-picker-field-btn{border:1px solid ${color.line};background:${color.white};color:${color.primary};border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:${font.family}}
        .biawin-media-picker-field-btn:disabled{opacity:.5;cursor:not-allowed}
        .biawin-media-picker-field-btn--ghost{color:#c0392b}
        .biawin-media-picker-field-warning{font-size:11px;font-weight:700;color:#c0392b;line-height:1.7}
        .biawin-media-picker-field-hint{font-size:11px;font-weight:400;color:${color.muted}}
      `}</style>
    </div>
  );
}
