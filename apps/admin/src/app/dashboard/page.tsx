"use client";

import { color, font } from "@biawin/ui";
import { AdminShell } from "../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../lib/auth/admin-auth-context";

/**
 * Foundation placeholder only — no business features (explicitly out of
 * scope for Stage 5.17). Confirms the shell/auth/route-protection loop
 * works end to end; real dashboard content is a later stage's work.
 */
export default function AdminDashboardPage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <DashboardContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function DashboardContent() {
  const { profile } = useAdminAuth();

  return (
    <div style={{ fontFamily: font.family }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>داشبورد</h1>
      <p style={{ marginTop: 8, fontSize: 13, color: color.muted }}>
        {profile ? `خوش آمدید، ${profile.fullName}.` : "در حال بارگذاری…"}
      </p>
    </div>
  );
}
