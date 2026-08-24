"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNavigation, color, layout } from "@biawin/ui";
import { AuthGuard } from "./AuthGuard";
import { GlobalHeader } from "./GlobalHeader";
import { BOTTOM_NAV_ITEMS, type NavKey } from "./navigation";
import { PageContainer } from "./PageContainer";

export interface AppShellProps {
  /** Which bottom-nav tab to highlight. Wallet/Credit/Installments (not tabs themselves) pass "home", since they're reached from Home's Quick Actions. */
  activeNavKey: NavKey;
  children: ReactNode;
}

/**
 * The shared authenticated-app frame (docs/app-shell-contract.md,
 * docs/navigation-route-contract.md). Composes AuthGuard + GlobalHeader +
 * PageContainer + BottomNavigation. Not used by Landing — Orbit's
 * full-bleed hero and the pre-auth flow stay exactly as they are, outside
 * this shell.
 *
 * `GlobalHeader` and `BottomNavigation` are now fixed, pixel-matched
 * chrome (Biawin Home Screen Pixel Perfect Migration) reproduced from
 * `<header class="header">` / `<nav class="app-bottom-nav">` in
 * `biawin_single_file_app_requested_edits_v15.html` — the prototype
 * frames both as shell-level ("same across screens"), so this dropped
 * Stage 5.2's per-page "سلام {firstName} / {pageLabel}" header
 * (`PageHeader.tsx`, no longer used) in favor of the one fixed header
 * every prototype view actually shares. `AppShell` no longer fetches the
 * current user's profile itself for that reason — no page needs it here
 * anymore; a page that still needs the profile (e.g. Profile itself,
 * once built) fetches it directly.
 *
 * `BottomNavigation` is reused from `packages/ui` completely unmodified —
 * its own `position: fixed` normally spans the real viewport, but the
 * approved decision (Stage 5.1) is "BottomNavigation belongs inside the
 * 760px mobile-app shell," including on desktop. Rather than editing the
 * shared component, the capped column below establishes a new CSS
 * containing block (`transform: translateZ(0)`) so the nav's `fixed`
 * positioning resolves against this 760px column instead of the window.
 */
export function AppShell({ activeNavKey, children }: AppShellProps) {
  const router = useRouter();

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
          <GlobalHeader />
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
