"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { MediaAsset } from "@biawin/types";
import { Modal, color, font } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { mediaApi } from "../../../lib/media/media-api";
import { MediaUploadForm } from "../../../components/media/MediaUploadForm";

export interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}

/**
 * Consumes the existing Stage 5.18 Media Library API only
 * (`mediaApi`/`MediaUploadForm`) — no second upload/storage subsystem.
 * `mediaApi.list()` already filters to `active: true` on the backend, so
 * this only ever offers active assets, matching Stage 5.20's brief. Upload
 * still goes through `POST /admin/media/upload` → `MediaService` →
 * `MediaStorageService`, unchanged.
 */
export function MediaPickerModal({ open, onClose, onSelect }: MediaPickerModalProps) {
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const result = await mediaApi.list();
      setItems(result.items);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "دریافت رسانه‌ها با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Intentional: reset the upload sub-view whenever the modal reopens —
    // same pattern/justification as AdminMediaPage's own mount effect
    // (Stage 5.18).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowUpload(false);
    void load();
  }, [open, load]);

  function handleUploaded(asset: MediaAsset) {
    onSelect(asset);
    onClose();
  }

  // Bail out before ever touching `document` (undefined during the Next.js
  // static-prerender pass) — `open` is always false at that point, same as
  // `Modal`'s own internal early return. Only once a real browser click
  // sets `open` to true does the portal below ever run.
  if (!open) return null;

  return createPortal(
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: font.family }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: color.deep }}>انتخاب تصویر</h2>
          <button type="button" onClick={() => setShowUpload((v) => !v)} className="biawin-media-picker-toggle">
            {showUpload ? "بازگشت به فهرست" : "آپلود تصویر جدید"}
          </button>
        </div>

        {showUpload ? (
          <MediaUploadForm onUploaded={handleUploaded} />
        ) : (
          <>
            {errorMessage && (
              <p role="alert" className="biawin-media-picker-error">
                {errorMessage}
              </p>
            )}
            {items === null ? (
              <p className="biawin-media-picker-status">در حال بارگذاری…</p>
            ) : items.length === 0 ? (
              <p className="biawin-media-picker-status">هیچ رسانه‌ای در کتابخانه موجود نیست.</p>
            ) : (
              <ul className="biawin-media-picker-grid">
                {items.map((asset) => (
                  <li key={asset.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(asset);
                        onClose();
                      }}
                      className="biawin-media-picker-item"
                    >
                      <span className="biawin-media-picker-item-preview">
                        <img
                          src={asset.url}
                          alt={asset.altText ?? asset.fileName}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      </span>
                      <span className="biawin-media-picker-item-name">{asset.fileName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <style>{`
        .biawin-media-picker-toggle{border:1px solid ${color.line};background:${color.white};color:${color.primary};border-radius:10px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:${font.family}}
        .biawin-media-picker-error{font-size:12px;font-weight:700;color:#c0392b;margin:0 0 12px}
        .biawin-media-picker-status{font-size:13px;color:${color.muted};margin:0}
        .biawin-media-picker-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;max-height:360px;overflow-y:auto}
        .biawin-media-picker-item{display:flex;flex-direction:column;gap:6px;border:1px solid ${color.line};border-radius:12px;padding:6px;background:${color.white};cursor:pointer;width:100%;text-align:center}
        .biawin-media-picker-item:hover{background:${color.ice}}
        .biawin-media-picker-item-preview{aspect-ratio:1;background:${color.ice};border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center}
        .biawin-media-picker-item-preview img{width:100%;height:100%;object-fit:cover}
        .biawin-media-picker-item-name{font-size:10px;color:${color.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      `}</style>
    </Modal>,
    document.body,
  );
}
