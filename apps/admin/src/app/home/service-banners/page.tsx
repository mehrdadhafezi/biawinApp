"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { ServiceBannersListContent } from "../../../features/home/service-banners/ServiceBannersListContent";

export default function ServiceBannersPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <ServiceBannersListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
