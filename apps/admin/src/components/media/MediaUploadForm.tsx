"use client";

import { useState, type FormEvent } from "react";
import type { MediaAsset } from "@biawin/types";
import { Button, color, font } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { mediaApi } from "../../lib/media/media-api";

export type MediaUploadResult = { success: true; asset: MediaAsset } | { success: false; message: string };

export interface PerformMediaUploadDeps {
  upload: (file: File, altText?: string) => Promise<MediaAsset>;
  onUploaded: (asset: MediaAsset) => void;
}

/**
 * The actual submit-handler logic, factored out as a plain async function —
 * same reasoning as Stage 5.17's `performAdminLogin`: directly unit-
 * testable without simulating a real file input/form (the npm registry was
 * unreachable for `@testing-library/*` across this stage too). Backend
 * validation errors (bad format, oversized, spoofed content) all arrive as
 * `ApiError` with the real Persian message from `MediaService.upload()` —
 * this never re-implements that validation client-side, just surfaces it.
 */
export async function performMediaUpload(
  file: File | null,
  altText: string,
  deps: PerformMediaUploadDeps,
): Promise<MediaUploadResult> {
  if (!file) {
    return { success: false, message: "لطفاً یک فایل انتخاب کنید." };
  }
  try {
    const asset = await deps.upload(file, altText || undefined);
    deps.onUploaded(asset);
    return { success: true, asset };
  } catch (error) {
    return {
      success: false,
      message: error instanceof ApiError ? error.message : "خطای غیرمنتظره‌ای در آپلود رخ داد.",
    };
  }
}

export interface MediaUploadFormProps {
  onUploaded: (asset: MediaAsset) => void;
}

export function MediaUploadForm({ onUploaded }: MediaUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Stage 5.20 reuses this form inside the Home CMS Media Picker, which
    // portals into `document.body` to avoid nesting inside a Home resource
    // form's own `<form>`. A portal only moves the DOM node — React's
    // synthetic `onSubmit` still bubbles through the *React tree*, so
    // without this it would also fire the outer form's submit handler.
    // Harmless on the standalone /media page, which has no ancestor form.
    event.stopPropagation();
    setSubmitting(true);
    setErrorMessage(null);

    const result = await performMediaUpload(file, altText, { upload: mediaApi.upload, onUploaded });

    if (!result.success) {
      setErrorMessage(result.message);
    } else {
      setFile(null);
      setAltText("");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="biawin-media-upload-form">
      <label className="biawin-media-upload-field">
        <span>فایل تصویر</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <label className="biawin-media-upload-field">
        <span>متن جایگزین (اختیاری)</span>
        <input
          type="text"
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          className="biawin-media-upload-alt-input"
        />
      </label>

      {errorMessage && (
        <p role="alert" className="biawin-media-upload-error">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "در حال آپلود…" : "آپلود"}
      </Button>

      <style>{`
        .biawin-media-upload-form{display:flex;flex-direction:column;gap:14px;font-family:${font.family};max-width:360px}
        .biawin-media-upload-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-media-upload-alt-input{height:42px;border:1px solid ${color.line};background:${color.ice};border-radius:10px;padding:0 12px;font-size:14px;color:${color.ink}}
        .biawin-media-upload-error{margin:0;font-size:12px;font-weight:700;color:#c0392b}
      `}</style>
    </form>
  );
}
