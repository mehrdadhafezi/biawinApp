"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { ServiceMosaicListContent } from "../../../features/home/service-mosaic/ServiceMosaicListContent";

export default function ServiceMosaicPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <ServiceMosaicListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
