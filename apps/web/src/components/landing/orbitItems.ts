/**
 * The 13 floating category bubbles on the Orbit Landing.
 * Positions/delays/variants are taken directly from the prototype's final
 * resolved cascade (biawin_single_file_app_requested_edits_v16_clean.html,
 * <style id="biawin-orbit-motion-bubbles-css">) — not re-derived or guessed.
 *
 * `imageSrc` is intentionally omitted for every item: the prototype itself
 * ships these with an empty `src=""` (confirmed — not a truncation artifact
 * of the analysis copy), so there is no real asset to carry over yet.
 * OrbitBubble renders a neutral placeholder whenever `imageSrc` is absent;
 * populate it here per item once real category art exists, with no layout
 * changes required.
 */

export type OrbitBubbleVariant = "a" | "b" | "c" | "d";

export interface OrbitItem {
  id: string;
  label: string;
  leftPercent: number;
  topPercent: number;
  variant: OrbitBubbleVariant;
  delaySeconds: number;
  imageSrc?: string;
}

export const ORBIT_ITEMS: OrbitItem[] = [
  { id: "grocery", label: "سبد مواد غذایی", leftPercent: 29.2, topPercent: 29.0, variant: "a", delaySeconds: -0.0 },
  { id: "clothing", label: "پوشاک", leftPercent: 50.0, topPercent: 25.4, variant: "b", delaySeconds: -0.47 },
  { id: "motorcycle", label: "موتورسیکلت", leftPercent: 69.1, topPercent: 29.9, variant: "c", delaySeconds: -0.94 },
  { id: "car", label: "خودرو", leftPercent: 84.5, topPercent: 37.7, variant: "d", delaySeconds: -1.41 },
  { id: "jewelry", label: "طلا و جواهر", leftPercent: 86.6, topPercent: 47.8, variant: "b", delaySeconds: -1.88 },
  { id: "tourism", label: "گردشگری", leftPercent: 84.5, topPercent: 58.0, variant: "a", delaySeconds: -2.35 },
  { id: "appliances", label: "لوازم خانگی", leftPercent: 75.5, topPercent: 67.9, variant: "c", delaySeconds: -2.82 },
  { id: "carpet", label: "فرش", leftPercent: 54.7, topPercent: 73.3, variant: "d", delaySeconds: -0.0 },
  { id: "cosmetics", label: "آرایشی", leftPercent: 37.2, topPercent: 74.0, variant: "a", delaySeconds: -0.47 },
  { id: "digital", label: "دیجیتال", leftPercent: 19.1, topPercent: 68.2, variant: "b", delaySeconds: -0.94 },
  { id: "insurance", label: "بیمه", leftPercent: 11.2, topPercent: 58.0, variant: "c", delaySeconds: -1.41 },
  { id: "stationery", label: "لوازم تحریر", leftPercent: 11.2, topPercent: 48.1, variant: "d", delaySeconds: -1.88 },
  { id: "meat", label: "مرغ، گوشت و ماهی", leftPercent: 15.4, topPercent: 38.9, variant: "a", delaySeconds: -2.35 },
];

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
