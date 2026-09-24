/**
 * Stage 5.17-B — pagination helpers for the Media Library (`GET /admin/media`
 * returns `{ items, total, skip, take }`; input is `page`/`limit`, `skip` is
 * derived server-side and rejected as input). The UI now uses `total`
 * instead of silently showing only the first page.
 */
export const MEDIA_PAGE_SIZE = 50;

export function totalPages(total: number, pageSize: number = MEDIA_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** 1-based page kept within `1..totalPages`. */
export function clampPage(page: number, total: number, pageSize: number = MEDIA_PAGE_SIZE): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), totalPages(total, pageSize));
}
