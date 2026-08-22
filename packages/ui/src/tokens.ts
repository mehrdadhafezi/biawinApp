/**
 * Design tokens extracted from the Biawin prototype
 * (see /docs/01-prototype-analysis.md, section 3).
 *
 * This is the single source of truth for brand color/radius/shadow values.
 * apps/web's Tailwind config and apps/mobile's theme should both derive from this file.
 */

export const color = {
  primary: "#0879dc",
  primary2: "#0a63b8",
  deep: "#074f98",
  ink: "#0e2f4d",
  muted: "#6f8497",
  ice: "#f2f8fd",
  line: "#d9eafb",
  white: "#ffffff",
  accentOrange: "#f28a2d",
} as const;

/** Per service-category accent themes (extend as categories are finalized). */
export const categoryTheme = {
  auto: { accent: "#0879dc" },
  home: { accent: "#0a78c8" },
  fashion: { accent: "#0879dc" },
  gold: { accent: "#c9a13a" },
  travel: { accent: "#0879dc" },
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const shadow = {
  sm: "0 9px 28px rgba(4,79,152,0.10)",
  md: "0 18px 50px rgba(4,79,152,0.13)",
} as const;

export const font = {
  family: '"Vazirmatn", Tahoma, Arial, sans-serif',
  weights: [300, 400, 500, 600, 700, 800] as const,
};

/** Type scale observed across the prototype (headings, body, captions). */
export const typography = {
  h1: { size: 25, weight: 800, lineHeight: 1.2 },
  h2: { size: 22, weight: 800, lineHeight: 1.25 },
  h3: { size: 16, weight: 700, lineHeight: 1.3 },
  body: { size: 13, weight: 400, lineHeight: 1.9 },
  caption: { size: 11, weight: 700, lineHeight: 1.4 },
  micro: { size: 9, weight: 700, lineHeight: 1.35 },
} as const;

/** 4px-based spacing scale; the prototype's paddings/gaps all land on these steps. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

/** Content stays single-column up to `maxContentWidth`; these are for the surrounding chrome. */
export const breakpoint = {
  sm: 480,
  md: 768,
  lg: 1024,
} as const;

export const layout = {
  /** The prototype's single-column app shell caps out at this width on larger screens. */
  maxContentWidth: 760,
  bottomNavHeight: 76,
} as const;

export const direction = "rtl" as const;
