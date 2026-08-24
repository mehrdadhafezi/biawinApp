import type { ReactNode } from "react";
import { color, spacing } from "@biawin/ui";

export interface GlobalHeaderProps {
  /** Renders on the right in RTL — the primary slot (e.g. a greeting, or a back button + title). */
  start?: ReactNode;
  /** Renders on the left in RTL — the secondary slot (e.g. a notification button). */
  end?: ReactNode;
}

/**
 * Shared sticky/blurred header shell (docs/app-shell-contract.md §3) —
 * generalized from `HomeHeader`, which now composes this instead of
 * owning its own chrome. Content is a two-slot API rather than one opaque
 * `children` blob, since different pages need different arrangements
 * (Home: greeting + notification button; a future page: back button +
 * title + action icon) without each one re-implementing the sticky/blur
 * positioning.
 */
export function GlobalHeader({ start, end }: GlobalHeaderProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing.md}px ${spacing.xl}px`,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${color.line}`,
      }}
    >
      <div>{start}</div>
      <div>{end}</div>
    </header>
  );
}
