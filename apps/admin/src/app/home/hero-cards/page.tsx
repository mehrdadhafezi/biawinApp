"use client";

import { AdminShell } from "../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../components/shell/AdminRouteGuard";
import { HeroCardsListContent } from "../../../features/home/hero/HeroCardsListContent";

export default function HeroCardsPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <HeroCardsListContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}
