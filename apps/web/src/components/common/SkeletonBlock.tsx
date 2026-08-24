import type { CSSProperties } from "react";
import { color, radius } from "@biawin/ui";

export interface SkeletonBlockProps {
  /** Omit when `style` already drives sizing (e.g. `aspectRatio`). */
  height?: number;
  width?: number | string;
  radiusPx?: number;
  style?: CSSProperties;
}

/**
 * One shared loading placeholder — used everywhere a screen shows a
 * "data not resolved yet" state, so every section pulses the same way
 * instead of some places using a skeleton block and others plain "…" text
 * (Stage 4.2 QA finding: inconsistent loading treatment). Originally
 * Home-only; relocated here in Stage 5.2 once a second page needed it
 * (docs/app-shell-contract.md flagged this move in advance).
 */
export function SkeletonBlock({ height, width = "100%", radiusPx = radius.lg, style }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className="biawin-skeleton"
      style={{ ...(height !== undefined ? { height } : {}), width, borderRadius: radiusPx, background: color.ice, ...style }}
    />
  );
}

/** Mounted once per page — the shared shimmer keyframes every SkeletonBlock uses. */
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes biawinSkeletonPulse{0%,100%{opacity:1}50%{opacity:.55}}
      .biawin-skeleton{animation:biawinSkeletonPulse 1.4s ease-in-out infinite;}
      @media (prefers-reduced-motion:reduce){
        .biawin-skeleton{animation:none;}
      }
    `}</style>
  );
}
