/**
 * Mirrors the Stage 5.19 backend response/DTO shapes exactly
 * (backend/src/modules/home/**) — these are admin-only shapes local to this
 * feature, not shared via @biawin/types, since Stage 5.19's public response
 * shapes aren't a shared contract with apps/web yet (that's Stage 5.21).
 */

export type HeroCardKey = "earn" | "biawin" | "reward";
export type HeroCardColor = "blue" | "sky" | "white";
export type BannerTheme = "auto" | "home" | "fashion" | "gold" | "travel";
export type MosaicSlot = "half" | "wide";
export type MosaicTheme = "beauty" | "insurance" | "home" | "digital";

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface ReorderEntry {
  id: string;
  sortOrder: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  active: boolean;
}

export interface HomeHeroCardAdmin {
  id: string;
  cardKey: HeroCardKey;
  label: string;
  title: string;
  subtitle: string;
  displayNumber: string;
  ownerLabel: string;
  colorPreset: HeroCardColor;
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeHeroCardInput {
  cardKey: HeroCardKey;
  label: string;
  title: string;
  subtitle: string;
  displayNumber: string;
  ownerLabel: string;
  colorPreset?: HeroCardColor;
  sortOrder?: number;
  active?: boolean;
}

export interface HomeServiceBannerAdmin {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  mediaAssetId: string | null;
  kicker: string;
  theme: BannerTheme;
  wide: boolean;
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeServiceBannerInput {
  categoryId: string;
  mediaAssetId?: string | null;
  kicker: string;
  theme?: BannerTheme;
  wide?: boolean;
  sortOrder?: number;
  active?: boolean;
}

export interface HomeServiceMosaicTileAdmin {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  mediaAssetId: string | null;
  slotType: MosaicSlot;
  kicker: string;
  title: string | null;
  lead: string | null;
  theme: MosaicTheme;
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeServiceMosaicTileInput {
  categoryId: string;
  mediaAssetId?: string | null;
  slotType: MosaicSlot;
  kicker: string;
  title?: string | null;
  lead?: string | null;
  theme?: MosaicTheme;
  sortOrder?: number;
  active?: boolean;
}

export interface HomeNewsArticleAdmin {
  id: string;
  category: string;
  image: string | null;
  mediaAssetId: string | null;
  kicker: string;
  title: string;
  lead: string;
  bodySlug: string | null;
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeNewsArticleInput {
  category: string;
  mediaAssetId?: string | null;
  kicker: string;
  title: string;
  lead: string;
  bodySlug?: string | null;
  sortOrder?: number;
  active?: boolean;
}
