"use client";

import { NotificationButton } from "../../components/common/NotificationButton";
import { SkeletonStyles } from "../../components/common/SkeletonBlock";
import { AccountFinancialCards } from "../../components/home/AccountFinancialCards";
import { BenefitsSection } from "../../components/home/BenefitsSection";
import { FeaturedServiceBanner } from "../../components/home/FeaturedServiceBanner";
import { HeroCardCarousel } from "../../components/home/HeroCardCarousel";
import { HomeStories } from "../../components/home/HomeStories";
import { MembershipStories } from "../../components/home/MembershipStories";
import { QuickActionsGrid } from "../../components/home/QuickActionsGrid";
import { ServiceTicker } from "../../components/home/ServiceTicker";
import { useCategories } from "../../components/home/useCategories";
import { useMembershipSummary } from "../../components/home/useMembershipSummary";
import { AppShell } from "../../components/shell/AppShell";

/**
 * Home Dashboard — Stage 5.2 moves identity-fetching and header
 * composition into `AppShell` itself (docs/navigation-route-contract.md
 * §4: "سلام {firstName} / خلاصه حساب"), replacing Stage 5.1's Home-only
 * `HomeHeader`. Dashboard content (stories, cards, quick actions, ...) is
 * unchanged from Stage 4.3.
 */
export default function HomePage() {
  const membershipSummary = useMembershipSummary();
  const categoriesSummary = useCategories();

  return (
    <AppShell activeNavKey="home" pageLabel="خلاصه حساب" greeting headerEnd={<NotificationButton />}>
      <SkeletonStyles />

      <HomeStories />
      <HeroCardCarousel {...membershipSummary} />
      <QuickActionsGrid />
      <ServiceTicker {...categoriesSummary} />
      <FeaturedServiceBanner {...categoriesSummary} />
      <MembershipStories {...membershipSummary} />
      <AccountFinancialCards />
      <BenefitsSection {...membershipSummary} />
    </AppShell>
  );
}
