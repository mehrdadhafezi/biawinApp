"use client";

import type { MediaAsset } from "@biawin/types";
import { color, font } from "@biawin/ui";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export interface MediaLibraryGridProps {
  items: MediaAsset[];
  /** SUPER_ADMIN / CONTENT_EDITOR only (the backend enforces the same roles). Read-only roles see no delete control. */
  canManage: boolean;
  /** Opens the page's confirmation dialog — the grid itself never calls the API. */
  onRequestDelete: (asset: MediaAsset) => void;
  /** An asset whose delete request is in flight (disables its button). */
  deletingId?: string | null;
}

/**
 * Presentational grid — no filtering/search/folders. Preview images use the
 * backend-resolved `asset.url`, which points at the public
 * `GET /api/v1/media/:filename` route (`MediaFilesController`, built in
 * Stage 5.21); a broken-image fallback (`onError`) still hides an image that
 * fails to load. Deleting is requested through `onRequestDelete` and
 * confirmed/handled by the Media page.
 */
export function MediaLibraryGrid({ items, canManage, onRequestDelete, deletingId }: MediaLibraryGridProps) {
  if (items.length === 0) {
    return <p className="biawin-media-empty">هنوز فایلی آپلود نشده است.</p>;
  }

  return (
    <div>
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
              {canManage && (
                <button
                  type="button"
                  disabled={deletingId === asset.id}
                  onClick={() => onRequestDelete(asset)}
                  className="biawin-media-card-delete"
                >
                  {deletingId === asset.id ? "در حال حذف…" : "حذف"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        .biawin-media-empty{font-family:${font.family};font-size:13px;color:${color.muted}}
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
