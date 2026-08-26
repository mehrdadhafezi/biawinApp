/**
 * The typed transformation layer between the Stage 5.19 public Home CMS API
 * DTOs (`lib/home-api.ts`) and this app's existing Home view models — the
 * exact shapes `BiawinCardsCarousel`/`ServiceBannerGrid`/`ServiceMosaic`/
 * `NewsCarousel` already render (previously fed by the hardcoded arrays in
 * `home.mock.ts`). No CMS field (`categoryId`, `colorPreset`, `slotType`,
 * `active`, ...) is ever read directly by a presentation component —
 * everything below produces presentation-ready values instead (Stage 5.21
 * §4).
 *
 * Pure, side-effect-free, plain functions — directly unit-testable without
 * a DOM or network (see `homeCmsAdapter.test.ts`), same pattern this
 * engagement has used since Stage 5.17 (`performAdminLogin` etc.) for
 * exactly this reason.
 */
import type {
  HeroCardColor,
  HomeBannerTheme,
  HomeHeroCardDto,
  HomeMosaicTheme,
  HomeNewsArticleDto,
  HomeServiceBannerDto,
  HomeServiceMosaicTileDto,
} from "../../lib/home-api";

// --- Hero cards --------------------------------------------------------

export type HeroIconChip = "trend" | "card" | "gift";

export interface HeroCardViewModel {
  key: "earn" | "biawin" | "reward";
  label: string;
  ariaLabel: string;
  title: string;
  subtitle: string;
  number: string;
  owner: string;
  gradient: string;
  iconChip: HeroIconChip;
}

/**
 * `colorPreset` is a closed 3-value enum that the original Home Admin
 * Contract (`docs/home-admin-contract.md` §4.6) always intended to map to
 * these 3 hand-tuned gradient/icon pairs — "free-form color/SVG input from
 * Admin would bypass that tuning". The seeded data's `colorPreset` values
 * (blue=earn, sky=biawin, white=reward) already correspond 1:1 to today's
 * exact approved gradients in that order, so this mapping reproduces the
 * current visual output exactly while still making `colorPreset` a real,
 * live-editable control for Admin (Stage 5.20's `HeroCardForm` already
 * exposes it) rather than an inert stored value.
 */
const HERO_VISUAL_BY_COLOR: Record<HeroCardColor, { gradient: string; iconChip: HeroIconChip }> = {
  blue: { gradient: "linear-gradient(135deg,#27384a 0%,#173957 52%,#0d608b 100%)", iconChip: "trend" },
  sky: { gradient: "linear-gradient(135deg,#0f94ec 0%,#0879dc 54%,#064e91 100%)", iconChip: "card" },
  white: { gradient: "linear-gradient(135deg,#29a5a6 0%,#137e98 52%,#0b587d 100%)", iconChip: "gift" },
};

export function mapHomeHeroCard(dto: HomeHeroCardDto): HeroCardViewModel {
  const visual = HERO_VISUAL_BY_COLOR[dto.colorPreset] ?? HERO_VISUAL_BY_COLOR.blue;
  return {
    key: dto.cardKey,
    label: dto.label,
    ariaLabel: `مشاهده ${dto.title}`,
    title: dto.title,
    subtitle: dto.subtitle,
    number: dto.displayNumber,
    owner: dto.ownerLabel,
    gradient: visual.gradient,
    iconChip: visual.iconChip,
  };
}

// --- Service banners -----------------------------------------------------

export interface ServiceBannerViewModel {
  id: string;
  /**
   * Real relational identity (Stage 5.21 §15) — never resolved by matching
   * `categoryName` against a separately-fetched category list when this
   * came from the CMS. Only `null` for the static fallback content
   * (`useHomeCms.ts`, used solely if the CMS is unreachable) — a fallback
   * tile is still shown with full visual fidelity but isn't clickable,
   * rather than resurrecting the pre-Stage-5.19 name-matching lookup for a
   * temporary safety net.
   */
  categoryId: string | null;
  categoryName: string;
  image: string | null;
  kicker: string;
  theme: HomeBannerTheme;
  wide: boolean;
}

export function mapHomeServiceBanner(dto: HomeServiceBannerDto): ServiceBannerViewModel {
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    image: dto.image,
    kicker: dto.kicker,
    theme: dto.theme,
    wide: dto.wide,
  };
}

// --- Service mosaic --------------------------------------------------------

export interface MosaicHalfViewModel {
  id: string;
  /** `null` only for static fallback content — see `ServiceBannerViewModel.categoryId`'s doc comment. */
  categoryId: string | null;
  categoryName: string;
  image: string | null;
  kicker: string;
  theme: HomeMosaicTheme;
}

export interface MosaicWideViewModel {
  id: string;
  /** `null` only for static fallback content — see `ServiceBannerViewModel.categoryId`'s doc comment. */
  categoryId: string | null;
  categoryName: string;
  image: string | null;
  kicker: string;
  title: string;
  lead: string;
  theme: HomeMosaicTheme;
}

/**
 * The backend models `half`/`wide` mosaic tiles as one ordered collection
 * discriminated by `slotType` (Stage 5.19) — `ServiceMosaic.tsx` still
 * renders them as two independent groups (2-up grid + auto-rotating wide
 * slider), matching its pre-CMS shape exactly, so the split happens here,
 * once, rather than duplicated in the component. A `wide` row missing
 * `title`/`lead` can't render as a wide slide (the component requires both)
 * — skipped rather than crashing the section, logged in development so a
 * real data bug stays visible instead of silently disappearing.
 */
export function mapHomeServiceMosaicTiles(
  dtos: HomeServiceMosaicTileDto[],
): { halves: MosaicHalfViewModel[]; wide: MosaicWideViewModel[] } {
  const halves = dtos
    .filter((d) => d.slotType === "half")
    .map((d) => ({ id: d.id, categoryId: d.categoryId, categoryName: d.categoryName, image: d.image, kicker: d.kicker, theme: d.theme }));

  const wide: MosaicWideViewModel[] = [];
  for (const d of dtos) {
    if (d.slotType !== "wide") continue;
    if (!d.title || !d.lead) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[home-cms] mosaic tile ${d.id} is "wide" but missing title/lead — skipped`);
      }
      continue;
    }
    wide.push({ id: d.id, categoryId: d.categoryId, categoryName: d.categoryName, image: d.image, kicker: d.kicker, title: d.title, lead: d.lead, theme: d.theme });
  }

  return { halves, wide };
}

// --- News articles -----------------------------------------------------

export interface NewsArticleViewModel {
  id: string;
  category: string;
  image: string | null;
  kicker: string;
  title: string;
  lead: string;
}

export function mapHomeNewsArticle(dto: HomeNewsArticleDto): NewsArticleViewModel {
  return {
    id: dto.id,
    category: dto.category,
    image: dto.image,
    kicker: dto.kicker,
    title: dto.title,
    lead: dto.lead,
  };
}
