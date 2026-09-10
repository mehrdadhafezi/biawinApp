"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { CategoryCardsListContent } from "../../../features/catalog/category-cards/CategoryCardsListContent";

export default function CategoryCardsPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <CategoryCardsListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
