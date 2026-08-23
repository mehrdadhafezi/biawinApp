/**
 * The floating category bubbles on the Orbit Landing — data-driven, not
 * hardcoded markup. `useOrbitItems()` is the seam this is meant to be
 * fetched through: today it returns the mock list below (filtered/sorted
 * exactly the way a real API response would need to be consumed); once an
 * Admin-managed Orbit endpoint exists, only this file's hook body needs to
 * change to a real fetch — OrbitStage/OrbitBubble consume the same
 * `OrbitItem[]` contract either way.
 *
 * Initial positions/delays/variants below are taken directly from the
 * prototype's final resolved cascade
 * (biawin_single_file_app_requested_edits_v16_clean.html,
 * <style id="biawin-orbit-motion-bubbles-css">) — not re-derived or guessed.
 *
 * `image`: 10 of 13 items now have a real asset wired in, served from
 * apps/web/public/orbit/ (the interim static path documented in
 * assets/orbit/README.md, pending the real Media Library/API). Every
 * asset was visually inspected against the frozen contract
 * (docs/13-production-orbit-asset-spec.md) before being connected — see
 * docs/14-orbit-asset-qa-report.md and docs/15-orbit-asset-qa-report-batch2.md
 * for the full per-item pass/fail record across both generation batches.
 * `insurance`, `stationery`, and `meat` keep OrbitBubble's placeholder:
 * `insurance`'s regenerated asset still shows two distinct objects (a
 * notebook + a shield) rather than one; no asset was ever generated
 * specifically for `stationery` or `meat` (the generated "food" asset was
 * used for `grocery` instead, since its basket imagery matches that
 * item's title far better). A `sports` asset also exists
 * (apps/web/public/orbit/orbit_12_sports.webp) and passed QA, but has no
 * corresponding item in this 13-item list — wiring it in requires the
 * 13-to-12-item catalog restructuring documented in
 * docs/12-orbit-item-catalog.md / docs/13-production-orbit-asset-spec.md,
 * which is a separate, not-yet-applied change.
 */

import { useMemo } from "react";

export type OrbitBubbleVariant = "a" | "b" | "c" | "d";

export interface OrbitItemPosition {
  leftPercent: number;
  topPercent: number;
}

export interface OrbitItemAnimation {
  /** Selects which float keyframe/duration pair this bubble uses. */
  variant: OrbitBubbleVariant;
  delaySeconds: number;
}

/** The Admin-Panel-shaped contract for one orbit bubble. */
export interface OrbitItem {
  id: string;
  title: string;
  /** Transparent PNG/WebP, no background — see Asset Preparation Contract. Unset until real art exists. */
  image?: string;
  /** Explicit sort key — do not rely on array order once this is API-backed. */
  order: number;
  active: boolean;
  position: OrbitItemPosition;
  animation: OrbitItemAnimation;
}

const MOCK_ORBIT_ITEMS: OrbitItem[] = [
  { id: "grocery", title: "سبد مواد غذایی", image: "/orbit/orbit_11_food.webp", order: 1, active: true, position: { leftPercent: 29.2, topPercent: 29.0 }, animation: { variant: "a", delaySeconds: -0.0 } },
  { id: "clothing", title: "پوشاک", image: "/orbit/orbit_01_clothing.webp", order: 2, active: true, position: { leftPercent: 50.0, topPercent: 25.4 }, animation: { variant: "b", delaySeconds: -0.47 } },
  { id: "motorcycle", title: "موتورسیکلت", image: "/orbit/orbit_09_motorcycle.webp", order: 3, active: true, position: { leftPercent: 69.1, topPercent: 29.9 }, animation: { variant: "c", delaySeconds: -0.94 } },
  { id: "car", title: "خودرو", image: "/orbit/orbit_02_vehicle.webp", order: 4, active: true, position: { leftPercent: 84.5, topPercent: 37.7 }, animation: { variant: "d", delaySeconds: -1.41 } },
  { id: "jewelry", title: "طلا و جواهر", image: "/orbit/orbit_03_gold-jewelry.webp", order: 5, active: true, position: { leftPercent: 86.6, topPercent: 47.8 }, animation: { variant: "b", delaySeconds: -1.88 } },
  { id: "tourism", title: "گردشگری", image: "/orbit/orbit_04_tourism.webp", order: 6, active: true, position: { leftPercent: 84.5, topPercent: 58.0 }, animation: { variant: "a", delaySeconds: -2.35 } },
  { id: "appliances", title: "لوازم خانگی", image: "/orbit/orbit_05_home-appliance.webp", order: 7, active: true, position: { leftPercent: 75.5, topPercent: 67.9 }, animation: { variant: "c", delaySeconds: -2.82 } },
  { id: "carpet", title: "فرش", image: "/orbit/orbit_10_carpet.webp", order: 8, active: true, position: { leftPercent: 54.7, topPercent: 73.3 }, animation: { variant: "d", delaySeconds: -0.0 } },
  { id: "cosmetics", title: "آرایشی", image: "/orbit/orbit_06_beauty.webp", order: 9, active: true, position: { leftPercent: 37.2, topPercent: 74.0 }, animation: { variant: "a", delaySeconds: -0.47 } },
  { id: "digital", title: "دیجیتال", image: "/orbit/orbit_07_digital.webp", order: 10, active: true, position: { leftPercent: 19.1, topPercent: 68.2 }, animation: { variant: "b", delaySeconds: -0.94 } },
  { id: "insurance", title: "بیمه", order: 11, active: true, position: { leftPercent: 11.2, topPercent: 58.0 }, animation: { variant: "c", delaySeconds: -1.41 } },
  { id: "stationery", title: "لوازم تحریر", order: 12, active: true, position: { leftPercent: 11.2, topPercent: 48.1 }, animation: { variant: "d", delaySeconds: -1.88 } },
  { id: "meat", title: "مرغ، گوشت و ماهی", order: 13, active: true, position: { leftPercent: 15.4, topPercent: 38.9 }, animation: { variant: "a", delaySeconds: -2.35 } },
];

/**
 * The data-layer seam for Orbit items. Swap the body for a real fetch
 * (e.g. `useSWR('/api/v1/orbit-items', ...)`) once the Admin-managed
 * endpoint exists; callers already only ever see a sorted, active-only list.
 */
export function useOrbitItems(): OrbitItem[] {
  return useMemo(
    () => MOCK_ORBIT_ITEMS.filter((item) => item.active).sort((a, b) => a.order - b.order),
    [],
  );
}

/** Animation-in-place variants; each gets its own subtle drift keyframe + duration. */
export const ORBIT_FLOAT_DURATION_SECONDS: Record<OrbitBubbleVariant, number> = {
  a: 5.7,
  b: 6.4,
  c: 7.1,
  d: 6.8,
};

/** Concentric decorative rings (r1 = innermost). Widths are % of the stage container. */
export const ORBIT_RINGS = [
  { widthPercent: 52, borderAlpha: 0.16 },
  { widthPercent: 67, borderAlpha: 0.18 },
  { widthPercent: 82, borderAlpha: 0.21 },
  { widthPercent: 96, borderAlpha: 0.28 },
  { widthPercent: 110, borderAlpha: 0.09 },
  { widthPercent: 122, borderAlpha: 0.06 },
] as const;

/** Small decorative dots marking the outer ring's octagon points. */
export const ORBIT_NODES = [
  { leftPercent: 50, topPercent: 18.2 },
  { leftPercent: 79, topPercent: 29.2 },
  { leftPercent: 95, topPercent: 48.3 },
  { leftPercent: 83, topPercent: 69.1 },
  { leftPercent: 50, topPercent: 78.0 },
  { leftPercent: 18, topPercent: 69.2 },
  { leftPercent: 2, topPercent: 48.3 },
  { leftPercent: 18, topPercent: 29.0 },
] as const;
