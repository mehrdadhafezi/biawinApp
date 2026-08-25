"use client";

import { useCallback, useEffect, useState } from "react";
import type { MediaAsset } from "@biawin/types";
import { color, font } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { mediaApi } from "../../lib/media/media-api";
import { AdminShell } from "../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../components/shell/AdminRouteGuard";
import { MediaUploadForm } from "../../components/media/MediaUploadForm";
import { MediaLibraryGrid } from "../../components/media/MediaLibraryGrid";

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
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setErrorMessage(null);
    try {
      const result = await mediaApi.list();
      setItems(result.items);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "دریافت فهرست رسانه‌ها با خطا مواجه شد.");
    }
  }, []);

  useEffect(() => {
    // Intentional: the initial list fetch has to happen client-side, post-
    // mount (no server-rendered data source here) — not an accidental
    // cascading update, same pattern/justification as AdminAuthProvider's
    // own mount effect (Stage 5.17).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadList();
  }, [loadList]);

  function handleUploaded(asset: MediaAsset) {
    setItems((current) => [asset, ...(current ?? [])]);
  }

  function handleRemoved(id: string) {
    setItems((current) => current?.filter((item) => item.id !== id) ?? null);
  }

  return (
    <div style={{ fontFamily: font.family }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>کتابخانه رسانه</h1>
      <p style={{ marginTop: 8, marginBottom: 24, fontSize: 13, color: color.muted }}>
        آپلود و مدیریت تصاویر — هنوز به هیچ محتوایی (خانه، اخبار) متصل نشده است.
      </p>

      <section style={{ marginBottom: 32 }}>
        <MediaUploadForm onUploaded={handleUploaded} />
      </section>

      <section>
        {errorMessage && (
          <p role="alert" style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: "#c0392b" }}>
            {errorMessage}
          </p>
        )}
        {items === null && !errorMessage ? (
          <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>
        ) : (
          <MediaLibraryGrid items={items ?? []} onRemoved={handleRemoved} />
        )}
      </section>
    </div>
  );
}
