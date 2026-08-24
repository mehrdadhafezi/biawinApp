"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Profile } from "@biawin/types";
import { BottomNavigation, color, layout } from "@biawin/ui";
import { useAuth } from "../../lib/auth/auth-context";
import { getFirstName } from "../../lib/format";
import { usersApi } from "../../lib/users-api";
import { AuthGuard } from "./AuthGuard";
import { BOTTOM_NAV_ITEMS, type NavKey } from "./navigation";
import { PageContainer } from "./PageContainer";
import { PageHeader } from "./PageHeader";

export interface AppShellProps {
  /** Which bottom-nav tab to highlight. Wallet/Credit/Installments (not tabs themselves) pass "home", since they're reached from Home's Quick Actions. */
  activeNavKey: NavKey;
  /** The header's page-context line — see docs/navigation-route-contract.md §4. */
  pageLabel: string;
  /** Home only: "سلام {firstName}" instead of just "{firstName}". */
  greeting?: boolean;
  /** GlobalHeader's `end` slot — e.g. `<NotificationButton />`. Most pages omit it. */
  headerEnd?: ReactNode;
  children: ReactNode;
}

/**
 * The shared authenticated-app frame (docs/app-shell-contract.md,
 * docs/navigation-route-contract.md). Composes AuthGuard + PageHeader
 * (built on GlobalHeader) + PageContainer + BottomNavigation. Not used by
 * Landing — Orbit's full-bleed hero and the pre-auth flow stay exactly as
 * they are, outside this shell.
 *
 * Owns fetching the current user's profile once, so no individual page
 * has to duplicate that fetch just to show a name in its header (Stage
 * 5.1 had Home doing this itself; every other page would've repeated it).
 *
 * `BottomNavigation` is reused from `packages/ui` completely unmodified —
 * its own `position: fixed` normally spans the real viewport, but the
 * approved decision (Stage 5.1) is "BottomNavigation belongs inside the
 * 760px mobile-app shell," including on desktop. Rather than editing the
 * shared component, the capped column below establishes a new CSS
 * containing block (`transform: translateZ(0)`) so the nav's `fixed`
 * positioning resolves against this 760px column instead of the window.
 */
export function AppShell({ activeNavKey, pageLabel, greeting, headerEnd, children }: AppShellProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    usersApi
      .getCurrentProfile()
      .then(setProfile)
      .catch(() => {
        // A failed profile fetch just keeps the header's skeleton up —
        // it shouldn't block the rest of the shell from rendering.
      });
  }, [isAuthenticated]);

  function handleNavChange(key: string) {
    if (key === activeNavKey) return;
    const item = BOTTOM_NAV_ITEMS.find((navItem) => navItem.id === key);
    if (item?.enabled) router.push(item.route);
  }

  return (
    <AuthGuard mode="require-auth" redirectTo="/">
      <div style={{ minHeight: "100dvh", background: color.ice, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "100%",
            maxWidth: layout.maxContentWidth,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            minHeight: "100dvh",
            position: "relative",
            transform: "translateZ(0)",
          }}
        >
          <PageHeader firstName={getFirstName(profile?.fullName ?? null)} pageLabel={pageLabel} greeting={greeting} end={headerEnd} />
          <PageContainer>{children}</PageContainer>
          <BottomNavigation
            items={BOTTOM_NAV_ITEMS.map((item) => ({ key: item.id, label: item.title, icon: item.icon }))}
            activeKey={activeNavKey}
            onChange={handleNavChange}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
