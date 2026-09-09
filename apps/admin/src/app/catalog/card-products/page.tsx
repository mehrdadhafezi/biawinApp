"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { CardProductsListContent } from "../../../features/catalog/card-products/CardProductsListContent";

export default function CardProductsPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <CardProductsListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
