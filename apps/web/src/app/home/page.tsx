"use client";

import { SkeletonStyles } from "../../components/common/SkeletonBlock";
import { AppShell } from "../../components/shell/AppShell";
import { HomeStories } from "../../components/home/HomeStories";
import { BiawinCardsCarousel } from "../../components/home/BiawinCardsCarousel";
import { QuickActions } from "../../components/home/QuickActions";
import { BrandIntroduction } from "../../components/home/BrandIntroduction";
import { CategoriesSection } from "../../components/home/CategoriesSection";
import { ServiceBannerGrid } from "../../components/home/ServiceBannerGrid";
import { MembershipStoryStrip } from "../../components/home/MembershipStoryStrip";
import { ServiceMosaic } from "../../components/home/ServiceMosaic";
import { NewsCarousel } from "../../components/home/NewsCarousel";
import { useCategories } from "../../components/home/useCategories";
import { useMembershipSummary } from "../../components/home/useMembershipSummary";

/**
 * Home Dashboard — Biawin Home Screen Pixel Perfect Migration. Rebuilt to
 * reproduce `#view-home` in `biawin_single_file_app_requested_edits_v15.html`
 * exactly (structure, copy, spacing, colors), superseding Stage 4.1–4.4's
 * "Home Dashboard v1: FROZEN" design system version. Section order matches
 * the prototype's own document order:
 *
 *   AppHeader (AppShell) → HomeStories → BiawinCardsCarousel →
 *   QuickActions → BrandIntroduction → CategoriesSection →
 *   ServiceBannerGrid + MembershipStoryStrip + ServiceMosaic + NewsCarousel
 *   (AdditionalHomeSections) → BottomNavigation (AppShell)
 *
 * See docs/home-pixel-perfect-migration-report.md for the section-by-section
 * mapping, what stayed real-API-backed vs. mock, and responsive verification.
 */
export default function HomePage() {
  const membershipSummary = useMembershipSummary();
  const categoriesSummary = useCategories();

  return (
    <AppShell activeNavKey="home">
      <SkeletonStyles />

      <HomeStories />
      <BiawinCardsCarousel />
      <QuickActions />
      <BrandIntroduction />
      <CategoriesSection />
      <ServiceBannerGrid {...categoriesSummary} />
      <MembershipStoryStrip {...membershipSummary} />
      <ServiceMosaic {...categoriesSummary} />
      <NewsCarousel />

      <footer style={{ padding: "26px 20px 34px", background: "#063e75", color: "#fff", textAlign: "center" }}>
        <strong style={{ fontSize: 17 }}>بیاوین</strong>
        <p style={{ margin: "8px auto 0", fontSize: 10, opacity: 0.68, maxWidth: 420, lineHeight: 1.9 }}>
          باشگاه هوشمند خریدهای بزرگ اقساطی؛ یک عضویت برای دسترسی به اعتبار، خدمات و فرصت‌های بیشتر.
        </p>
      </footer>
    </AppShell>
  );
}
