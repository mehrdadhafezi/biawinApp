"use client";

import { color, font } from "@biawin/ui";

export interface MediaPagerProps {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  busy?: boolean;
}

/** Previous/next + "page X of Y (N files)" — renders nothing when everything fits on one page. */
export function MediaPager({ page, totalPages, total, onPrev, onNext, busy }: MediaPagerProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="biawin-media-pager" aria-label="صفحه‌بندی رسانه">
      <button type="button" onClick={onPrev} disabled={busy || page <= 1}>
        قبلی
      </button>
      <span>
        صفحه {page} از {totalPages} ({total} فایل)
      </span>
      <button type="button" onClick={onNext} disabled={busy || page >= totalPages}>
        بعدی
      </button>
      <style>{`
        .biawin-media-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;font-family:${font.family};font-size:12px;color:${color.muted}}
        .biawin-media-pager button{border:1px solid ${color.line};background:${color.white};color:${color.primary};border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:${font.family}}
        .biawin-media-pager button:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
    </nav>
  );
}
