"use client";

import { useEffect, useState } from "react";
import { homeApi } from "../../lib/home-api";
import {
  mapHomeHeroCard,
  mapHomeNewsArticle,
  mapHomeServiceBanner,
  mapHomeServiceMosaicTiles,
  type HeroCardViewModel,
  type MosaicHalfViewModel,
  type MosaicWideViewModel,
  type NewsArticleViewModel,
  type ServiceBannerViewModel,
} from "./homeCmsAdapter";
import { HERO_CARDS_FALLBACK, NEWS_ARTICLES, SERVICE_BANNERS, SERVICE_MOSAIC_HALVES, SERVICE_MOSAIC_WIDE } from "./home.mock";

/**
 * Stage 5.21 migration/cutover strategy (§12): a manual kill-switch plus
 * automatic per-section resilience. `NEXT_PUBLIC_HOME_CMS_ENABLED=false`
 * forces every section straight to its static fallback (e.g. to roll back
 * instantly without a deploy if a real CMS-side problem is found in
 * production); otherwise each hook tries the live API and only falls back
 * automatically on failure or an empty/unusable result. This flag and the
 * fallback arrays it guards are migration safety, not a second permanent
 * content system — remove both, and the fallback half of `home.mock.ts`,
 * once Stage 5.22 staging QA confirms CMS parity
 * (`docs/customer-home-cms-integration-report.md` §7).
 */
const HOME_CMS_ENABLED = process.env.NEXT_PUBLIC_HOME_CMS_ENABLED !== "false";

function warnFallback(section: string, reason: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[home-cms] ${section}: falling back to static content —`, reason);
  }
}

const HERO_FALLBACK: HeroCardViewModel[] = HERO_CARDS_FALLBACK.map((c) => ({
  key: c.key,
  label: c.label,
  ariaLabel: `مشاهده ${c.title}`,
  title: c.title,
  subtitle: c.subtitle,
  number: c.number,
  owner: c.owner,
  gradient: c.gradient,
  iconChip: c.iconChip,
}));

/** `HomeHeroCard` — `BiawinCardsCarousel`. */
export function useHomeHeroCards(): { cards: HeroCardViewModel[]; usingFallback: boolean } {
  const [state, setState] = useState<{ cards: HeroCardViewModel[]; usingFallback: boolean }>({
    cards: HERO_FALLBACK,
    usingFallback: true,
  });

  useEffect(() => {
    if (!HOME_CMS_ENABLED) return;
    let cancelled = false;
    homeApi
      .listHomeHeroCards()
      .then((dtos) => {
        if (cancelled) return;
        const cards = dtos.map(mapHomeHeroCard);
        if (cards.length === 0) {
          warnFallback("hero cards", "empty result");
          return;
        }
        setState({ cards, usingFallback: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) warnFallback("hero cards", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

const BANNERS_FALLBACK: ServiceBannerViewModel[] = SERVICE_BANNERS.map((b) => ({
  id: b.categoryName,
  categoryId: null,
  categoryName: b.categoryName,
  image: b.image,
  kicker: b.kicker,
  theme: b.theme,
  wide: b.wide ?? false,
}));

/** `HomeServiceBanner` — `ServiceBannerGrid`. */
export function useHomeServiceBanners(): { banners: ServiceBannerViewModel[]; usingFallback: boolean } {
  const [state, setState] = useState<{ banners: ServiceBannerViewModel[]; usingFallback: boolean }>({
    banners: BANNERS_FALLBACK,
    usingFallback: true,
  });

  useEffect(() => {
    if (!HOME_CMS_ENABLED) return;
    let cancelled = false;
    homeApi
      .listHomeServiceBanners()
      .then((dtos) => {
        if (cancelled) return;
        const banners = dtos.map(mapHomeServiceBanner);
        if (banners.length === 0) {
          warnFallback("service banners", "empty result");
          return;
        }
        setState({ banners, usingFallback: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) warnFallback("service banners", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

const MOSAIC_HALVES_FALLBACK: MosaicHalfViewModel[] = SERVICE_MOSAIC_HALVES.map((t) => ({
  id: t.categoryName,
  categoryId: null,
  categoryName: t.categoryName,
  image: t.image,
  kicker: t.kicker,
  theme: t.theme,
}));
const MOSAIC_WIDE_FALLBACK: MosaicWideViewModel[] = SERVICE_MOSAIC_WIDE.map((s) => ({
  id: s.categoryName,
  categoryId: null,
  categoryName: s.categoryName,
  image: s.image,
  kicker: s.kicker,
  title: s.title,
  lead: s.lead,
  theme: s.theme,
}));

/** `HomeServiceMosaicTile` — `ServiceMosaic`. */
export function useHomeServiceMosaic(): { halves: MosaicHalfViewModel[]; wide: MosaicWideViewModel[]; usingFallback: boolean } {
  const [state, setState] = useState<{ halves: MosaicHalfViewModel[]; wide: MosaicWideViewModel[]; usingFallback: boolean }>({
    halves: MOSAIC_HALVES_FALLBACK,
    wide: MOSAIC_WIDE_FALLBACK,
    usingFallback: true,
  });

  useEffect(() => {
    if (!HOME_CMS_ENABLED) return;
    let cancelled = false;
    homeApi
      .listHomeServiceMosaicTiles()
      .then((dtos) => {
        if (cancelled) return;
        const { halves, wide } = mapHomeServiceMosaicTiles(dtos);
        if (halves.length === 0 && wide.length === 0) {
          warnFallback("service mosaic", "empty result");
          return;
        }
        setState({ halves, wide, usingFallback: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) warnFallback("service mosaic", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

const NEWS_FALLBACK: NewsArticleViewModel[] = NEWS_ARTICLES.map((a) => ({
  id: a.title,
  category: a.category,
  image: a.image,
  kicker: a.kicker,
  title: a.title,
  lead: a.lead,
}));

/** `HomeNewsArticle` — `NewsCarousel`. */
export function useHomeNewsArticles(): { articles: NewsArticleViewModel[]; usingFallback: boolean } {
  const [state, setState] = useState<{ articles: NewsArticleViewModel[]; usingFallback: boolean }>({
    articles: NEWS_FALLBACK,
    usingFallback: true,
  });

  useEffect(() => {
    if (!HOME_CMS_ENABLED) return;
    let cancelled = false;
    homeApi
      .listHomeNewsArticles()
      .then((dtos) => {
        if (cancelled) return;
        const articles = dtos.map(mapHomeNewsArticle);
        if (articles.length === 0) {
          warnFallback("news articles", "empty result");
          return;
        }
        setState({ articles, usingFallback: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) warnFallback("news articles", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
