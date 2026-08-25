"use client";

import { useState } from "react";
import type { MediaAsset } from "@biawin/types";
import { color, font } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { mediaApi } from "../../lib/media/media-api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export interface MediaLibraryGridProps {
  items: MediaAsset[];
  onRemoved: (id: string) => void;
}

/**
 * Foundation-level grid only — no filtering/search/folders (out of scope
 * this stage). Preview images use `asset.url`'s static-bridge path
 * (`/media/{filename}`) resolved against the *backend* origin — that
 * reverse-proxy serving step isn't built yet (see
 * `media-storage.service.ts`'s own doc comment; the same gap Orbit's
 * `/orbit/{filename}` bridge has), so a broken-image fallback is expected
 * and handled, not a bug to chase in this stage.
 */
export function MediaLibraryGrid({ items, onRemoved }: MediaLibraryGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setErrorMessage(null);
    try {
      await mediaApi.remove(id);
      onRemoved(id);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "حذف فایل با خطا مواجه شد.");
    } finally {
      setDeletingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="biawin-media-empty">هنوز فایلی آپلود نشده است.</p>;
  }

  return (
    <div>
      {errorMessage && (
        <p role="alert" className="biawin-media-grid-error">
          {errorMessage}
        </p>
      )}
      <ul className="biawin-media-grid">
        {items.map((asset) => (
          <li key={asset.id} className="biawin-media-card">
            <div className="biawin-media-card-preview">
              <img
                src={asset.url}
                alt={asset.altText ?? asset.fileName}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="biawin-media-card-body">
              <strong className="biawin-media-card-name" title={asset.fileName}>
                {asset.fileName}
              </strong>
              <span className="biawin-media-card-meta">
                {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                {formatSize(asset.sizeBytes)} · {asset.mimeType}
              </span>
              <button
                type="button"
                disabled={deletingId === asset.id}
                onClick={() => handleDelete(asset.id)}
                className="biawin-media-card-delete"
              >
                {deletingId === asset.id ? "در حال حذف…" : "حذف"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        .biawin-media-empty{font-family:${font.family};font-size:13px;color:${color.muted}}
        .biawin-media-grid-error{font-family:${font.family};font-size:12px;font-weight:700;color:#c0392b;margin:0 0 12px}
        .biawin-media-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;font-family:${font.family}}
        .biawin-media-card{border:1px solid ${color.line};border-radius:14px;overflow:hidden;background:${color.white}}
        .biawin-media-card-preview{aspect-ratio:1;background:${color.ice};display:flex;align-items:center;justify-content:center}
        .biawin-media-card-preview img{width:100%;height:100%;object-fit:cover}
        .biawin-media-card-body{padding:10px;display:flex;flex-direction:column;gap:6px}
        .biawin-media-card-name{font-size:12px;color:${color.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .biawin-media-card-meta{font-size:10px;color:${color.muted}}
        .biawin-media-card-delete{border:1px solid ${color.line};background:${color.white};color:#c0392b;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;align-self:flex-start}
        .biawin-media-card-delete:hover{background:#fdf1f0}
      `}</style>
    </div>
  );
}
