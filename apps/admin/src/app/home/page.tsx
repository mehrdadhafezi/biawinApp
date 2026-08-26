"use client";

import { AdminShell } from "../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../components/shell/AdminRouteGuard";
import { HomeOverview } from "../../features/home/overview/HomeOverview";

export default function HomeOverviewPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <HomeOverview />
      </AdminShell>
    </AdminRouteGuard>
  );
}
