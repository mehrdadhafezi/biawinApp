"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { ServicesListContent } from "../../../features/catalog/services/ServicesListContent";

export default function ServicesPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <ServicesListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
