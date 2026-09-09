"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { CategoriesListContent } from "../../../features/catalog/categories/CategoriesListContent";

export default function CategoriesPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <CategoriesListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
