"use client";

import { useCallback, useEffect, useState } from "react";
import type { MediaAsset } from "@biawin/types";
import { color, font } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { useAdminAuth } from "../../lib/auth/admin-auth-context";
import { mediaApi } from "../../lib/media/media-api";
import { MEDIA_PAGE_SIZE, clampPage, totalPages } from "../../lib/media/mediaPagination";
import { AdminShell } from "../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../components/shell/AdminRouteGuard";
import { MediaUploadForm } from "../../components/media/MediaUploadForm";
import { MediaLibraryGrid } from "../../components/media/MediaLibraryGrid";
import { MediaPager } from "../../components/media/MediaPager";
import { performMediaDelete } from "../../components/media/mediaDelete";
import { ConfirmDialog } from "../../features/home/components/ConfirmDialog";
import { canManageHomeContent } from "../../features/home/rbac";

export default function AdminMediaPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <MediaLibraryContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function MediaLibraryContent() {
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** Loads one page. If the requested page no longer exists (e.g. the last item of the last page was deleted) it loads the last existing page instead. */
  const loadPage = useCallback(async (requested: number) => {
    setErrorMessage(null);
    setBusy(true);
    try {
      let result = await mediaApi.list(requested, MEDIA_PAGE_SIZE);
      const target = clampPage(requested, result.total, MEDIA_PAGE_SIZE);
      if (target !== requested) result = await mediaApi.list(target, MEDIA_PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
      setPage(target);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "دریافت فهرست رسانه‌ها با خطا مواجه شد.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // Intentional: the initial list fetch has to happen client-side, post-
    // mount (no server-rendered data source here) — not an accidental
    // cascading update, same pattern/justification as AdminAuthProvider's
    // own mount effect (Stage 5.17).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage(1);
  }, [loadPage]);

  function handleUploaded() {
    // The newest asset is first in the list order, so show page 1 again.
    void loadPage(1);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const result = await performMediaDelete(deleteTarget.id, { remove: mediaApi.remove });
    if (result.success) {
      setDeleteTarget(null);
      setNoticeMessage("فایل حذف شد.");
      await loadPage(page);
    } else if (result.stale) {
      // Already gone elsewhere: close, say so, reconcile the list.
      setDeleteTarget(null);
      setNoticeMessage(result.message);
      await loadPage(page);
    } else {
      // 409 (still in use) and other failures: keep the dialog open with the explanation. Nothing was changed.
      setDeleteError(result.message);
    }
    setDeleteBusy(false);
  }

  const pages = totalPages(total, MEDIA_PAGE_SIZE);

  return (
    <div style={{ fontFamily: font.family }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>کتابخانه رسانه</h1>
      <p style={{ marginTop: 8, marginBottom: 24, fontSize: 13, color: color.muted }}>
        آپلود و مدیریت تصاویر. تصاویر این کتابخانه در بخش‌های مختلف (صفحه خانه، دسته‌بندی‌ها، کارت‌ها، خدمات) استفاده می‌شوند؛ تصویری که هنوز در جایی استفاده شود، حذف نمی‌شود.
      </p>

      <section style={{ marginBottom: 32 }}>
        <MediaUploadForm onUploaded={handleUploaded} />
      </section>

      <section>
        {noticeMessage && (
          <p role="status" style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "#1f9d55" }}>
            {noticeMessage}
          </p>
        )}
        {errorMessage && (
          <p role="alert" style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "#c0392b" }}>
            {errorMessage}
          </p>
        )}
        {items === null && !errorMessage ? (
          <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>
        ) : (
          <>
            <MediaLibraryGrid
              items={items ?? []}
              canManage={canManage}
              deletingId={deleteBusy ? (deleteTarget?.id ?? null) : null}
              onRequestDelete={(asset) => {
                setNoticeMessage(null);
                setDeleteError(null);
                setDeleteTarget(asset);
              }}
            />
            <MediaPager
              page={page}
              totalPages={pages}
              total={total}
              busy={busy}
              onPrev={() => void loadPage(page - 1)}
              onNext={() => void loadPage(page + 1)}
            />
          </>
        )}
      </section>

      {deleteTarget && (
        <ConfirmDialog
          open
          title="حذف تصویر"
          description={`«${deleteTarget.fileName}» از کتابخانه حذف می‌شود. اگر این تصویر هنوز در صفحه خانه، دسته‌بندی‌ها، کارت‌ها یا خدمات استفاده شود، حذف انجام نمی‌شود و ابتدا باید آن را از آن محتوا جدا کنید.`}
          busy={deleteBusy}
          errorMessage={deleteError}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
