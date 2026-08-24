import type { ReactNode } from "react";
import { createElement } from "react";

export type NavigationStatus = "available" | "coming-soon";

export interface NavigationItem {
  id: string;
  title: string;
  icon: ReactNode;
  route: string;
  /** Whether tapping this item navigates. All 4 are `true` now that every bottom-nav route has a real page (Home is a full dashboard, the rest are placeholders — see `status`). */
  enabled: boolean;
  /** Informational — distinguishes a real feature from a placeholder page, independent of whether it's navigable. */
  status: NavigationStatus;
}

const navIconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 22,
  height: 22,
};

/** Exact `.app-bottom-nav .app-nav-item svg` markup from the prototype (`<nav class="app-bottom-nav">`). */
const NAV_ICONS: Record<string, ReactNode> = {
  home: createElement(
    "svg",
    navIconProps,
    createElement("path", { d: "M3 10.5 12 3l9 7.5" }),
    createElement("path", { d: "M5 9.5V21h14V9.5" }),
  ),
  services: createElement(
    "svg",
    navIconProps,
    createElement("rect", { x: 3, y: 4, width: 8, height: 7, rx: 2 }),
    createElement("rect", { x: 13, y: 4, width: 8, height: 7, rx: 2 }),
    createElement("rect", { x: 3, y: 13, width: 8, height: 7, rx: 2 }),
    createElement("rect", { x: 13, y: 13, width: 8, height: 7, rx: 2 }),
  ),
  rewards: createElement(
    "svg",
    navIconProps,
    createElement("path", {
      d: "M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5V7Z",
    }),
  ),
  profile: createElement(
    "svg",
    navIconProps,
    createElement("path", { d: "M20 21a8 8 0 1 0-16 0" }),
    createElement("circle", { cx: 12, cy: 8, r: 4 }),
  ),
};

/**
 * Single source of truth for the bottom nav (docs/navigation-route-contract.md
 * §2) — `AppShell` reads this instead of a hardcoded items array + a
 * separate "which keys are real routes" set, which is what Stage 4/5.1
 * had. Adding a new tab means editing this file, not `AppShell.tsx`.
 *
 * Icons/labels match `<nav class="app-bottom-nav">` in
 * `biawin_single_file_app_requested_edits_v15.html` exactly (pixel-perfect
 * migration) — line-icon SVGs, not emoji, and the first tab is labeled
 * "بیاوین", not "خانه". `services` is `"available"` now that Stage 9.1
 * shipped a real browse experience — this was still `"coming-soon"` from
 * Stage 5.2, before Services existed.
 */
export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  { id: "home", title: "بیاوین", icon: NAV_ICONS.home, route: "/home", enabled: true, status: "available" },
  { id: "services", title: "خدمات", icon: NAV_ICONS.services, route: "/services", enabled: true, status: "available" },
  { id: "rewards", title: "جایزه", icon: NAV_ICONS.rewards, route: "/rewards", enabled: true, status: "coming-soon" },
  { id: "profile", title: "پروفایل", icon: NAV_ICONS.profile, route: "/profile", enabled: true, status: "coming-soon" },
];

export type NavKey = (typeof BOTTOM_NAV_ITEMS)[number]["id"];
