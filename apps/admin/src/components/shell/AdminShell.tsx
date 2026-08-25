import type { ReactNode } from "react";
import { color } from "@biawin/ui";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

export interface AdminShellProps {
  children: ReactNode;
}

/**
 * The authenticated-admin frame: sidebar + header + content column.
 * Composed the same way `apps/web`'s `AppShell` composes `GlobalHeader` +
 * `PageContainer` + `BottomNavigation`, but as a real desktop layout, not a
 * 760px-capped mobile shell (docs/admin-architecture-decision-record.md §1).
 * Pages wrap themselves in `<AdminRouteGuard mode="require-auth">` around
 * this, mirroring how every `apps/web` authenticated page wraps `AppShell`
 * in its own `AuthGuard`.
 */
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="biawin-admin-shell">
      <AdminSidebar />
      <div className="biawin-admin-shell-main">
        <AdminHeader />
        <main className="biawin-admin-shell-content">{children}</main>
      </div>

      <style>{`
        .biawin-admin-shell{display:flex;min-height:100dvh}
        .biawin-admin-shell-main{flex:1;min-width:0;display:flex;flex-direction:column}
        .biawin-admin-shell-content{flex:1;padding:28px;background:${color.ice}}
      `}</style>
    </div>
  );
}
