/**
 * The floating category bubbles on the Orbit Landing — data-driven, not
 * hardcoded markup. `useOrbitItems()` is the seam this is meant to be
 * fetched through: today it returns the mock list below (filtered/sorted
 * exactly the way a real API response would need to be consumed); once an
 * Admin-managed Orbit endpoint exists, only this file's hook body needs to
 * change to a real fetch — OrbitStage/OrbitBubble consume the same
 * `OrbitItem[]` contract either way.
 *
 * FROZEN 12-item production catalog (Stage 1.9) — ids/titles match
 * docs/13-production-orbit-asset-spec.md exactly. Superseded the original
 * 13-item prototype list: `stationery` removed (no asset was ever produced
 * for it), `grocery`+`meat` merged into one `food` item (the generated
 * "food" basket asset matched `grocery`'s slot/title far better than
 * `meat`'s — see docs/15-orbit-asset-qa-report-batch2.md), `sports` added.
 * `id`s that changed from the original prototype list to match the frozen
 * spec: car -> vehicle, jewelry -> gold-jewelry, appliances ->
 * home-appliance, cosmetics -> beauty, grocery -> food.
 *
 * Position/animation values are still the prototype's original resolved
 * cascade (biawin_single_file_app_requested_edits_v16_clean.html,
 * <style id="biawin-orbit-motion-bubbles-css">) for the 10 items that keep
 * their original ring slot. The two structural changes reuse existing
 * slots rather than inventing new geometry: `food` keeps the former
 * `grocery` slot, and `sports` takes over the freed `meat` slot (removed
 * `stationery`'s slot is simply dropped — the ring now renders 12 bubbles,
 * not 13). No animation/layout/responsive code changed for this — only
 * this data array.
 *
 * `image`: 10 of 12 items have a real, QA'd asset (see
 * docs/14-orbit-asset-qa-report.md and
 * docs/15-orbit-asset-qa-report-batch2.md for the full pass/fail record).
 * `insurance` still keeps OrbitBubble's placeholder — its regenerated
 * asset still shows two distinct objects (a notebook + a shield) rather
 * than one; needs another regeneration pass, not a code change.
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
  { id: "food", title: "خرید روزمره", image: "/orbit/orbit_11_food.webp", order: 1, active: true, position: { leftPercent: 29.2, topPercent: 29.0 }, animation: { variant: "a", delaySeconds: -0.0 } },
  { id: "clothing", title: "پوشاک", image: "/orbit/orbit_01_clothing.webp", order: 2, active: true, position: { leftPercent: 50.0, topPercent: 25.4 }, animation: { variant: "b", delaySeconds: -0.47 } },
  { id: "motorcycle", title: "موتورسیکلت", image: "/orbit/orbit_09_motorcycle.webp", order: 3, active: true, position: { leftPercent: 69.1, topPercent: 29.9 }, animation: { variant: "c", delaySeconds: -0.94 } },
  { id: "vehicle", title: "خودرو", image: "/orbit/orbit_02_vehicle.webp", order: 4, active: true, position: { leftPercent: 84.5, topPercent: 37.7 }, animation: { variant: "d", delaySeconds: -1.41 } },
  { id: "gold-jewelry", title: "طلا و جواهر", image: "/orbit/orbit_03_gold-jewelry.webp", order: 5, active: true, position: { leftPercent: 86.6, topPercent: 47.8 }, animation: { variant: "b", delaySeconds: -1.88 } },
  { id: "tourism", title: "گردشگری", image: "/orbit/orbit_04_tourism.webp", order: 6, active: true, position: { leftPercent: 84.5, topPercent: 58.0 }, animation: { variant: "a", delaySeconds: -2.35 } },
  { id: "home-appliance", title: "لوازم خانگی", image: "/orbit/orbit_05_home-appliance.webp", order: 7, active: true, position: { leftPercent: 75.5, topPercent: 67.9 }, animation: { variant: "c", delaySeconds: -2.82 } },
  { id: "carpet", title: "فرش", image: "/orbit/orbit_10_carpet.webp", order: 8, active: true, position: { leftPercent: 54.7, topPercent: 73.3 }, animation: { variant: "d", delaySeconds: -0.0 } },
  { id: "beauty", title: "زیبایی", image: "/orbit/orbit_06_beauty.webp", order: 9, active: true, position: { leftPercent: 37.2, topPercent: 74.0 }, animation: { variant: "a", delaySeconds: -0.47 } },
  { id: "digital", title: "دیجیتال", image: "/orbit/orbit_07_digital.webp", order: 10, active: true, position: { leftPercent: 19.1, topPercent: 68.2 }, animation: { variant: "b", delaySeconds: -0.94 } },
  { id: "insurance", title: "بیمه", order: 11, active: true, position: { leftPercent: 11.2, topPercent: 58.0 }, animation: { variant: "c", delaySeconds: -1.41 } },
  { id: "sports", title: "باشگاه و ورزش", image: "/orbit/orbit_12_sports.webp", order: 12, active: true, position: { leftPercent: 15.4, topPercent: 38.9 }, animation: { variant: "a", delaySeconds: -2.35 } },
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
