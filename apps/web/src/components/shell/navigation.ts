export type NavigationStatus = "available" | "coming-soon";

export interface NavigationItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  /** Whether tapping this item navigates. All 4 are `true` now that every bottom-nav route has a real page (Home is a full dashboard, the rest are placeholders — see `status`). */
  enabled: boolean;
  /** Informational — distinguishes a real feature from a placeholder page, independent of whether it's navigable. */
  status: NavigationStatus;
}

/**
 * Single source of truth for the bottom nav (docs/navigation-route-contract.md
 * §2) — `AppShell` reads this instead of a hardcoded items array + a
 * separate "which keys are real routes" set, which is what Stage 4/5.1
 * had. Adding a new tab means editing this file, not `AppShell.tsx`.
 */
export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  { id: "home", title: "خانه", icon: "🏠", route: "/home", enabled: true, status: "available" },
  { id: "services", title: "خدمات", icon: "🛍️", route: "/services", enabled: true, status: "coming-soon" },
  { id: "rewards", title: "جایزه", icon: "🎁", route: "/rewards", enabled: true, status: "coming-soon" },
  { id: "profile", title: "پروفایل", icon: "👤", route: "/profile", enabled: true, status: "coming-soon" },
];

export type NavKey = (typeof BOTTOM_NAV_ITEMS)[number]["id"];
