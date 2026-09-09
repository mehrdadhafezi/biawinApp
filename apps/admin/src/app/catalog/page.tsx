"use client";

import { AdminShell } from "../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../components/shell/AdminRouteGuard";
import { CatalogOverview } from "../../features/catalog/overview/CatalogOverview";

export default function CatalogOverviewPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <CatalogOverview />
      </AdminShell>
    </AdminRouteGuard>
  );
}
