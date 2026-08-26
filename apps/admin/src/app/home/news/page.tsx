"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { NewsListContent } from "../../../features/home/news/NewsListContent";

export default function NewsPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewsListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
