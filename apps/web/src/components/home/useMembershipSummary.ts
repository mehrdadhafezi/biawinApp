import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { homeApi, type MembershipDto, type MembershipPlanDto } from "../../lib/home-api";

export interface MembershipSummary {
  /** Unfiltered catalog — `tier: null` are the 3 core cards, everything else is a subscription tier. */
  plans: MembershipPlanDto[] | null;
  memberships: MembershipDto[];
  error: string | null;
}

/**
 * Shared by `HeroCardCarousel`, `MembershipStories`, and `BenefitsSection` —
 * all three need the same plan catalog + activation data, fetched once per
 * Home mount rather than duplicated per component.
 */
export function useMembershipSummary(): MembershipSummary {
  const [plans, setPlans] = useState<MembershipPlanDto[] | null>(null);
  const [memberships, setMemberships] = useState<MembershipDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([homeApi.listSubscriptionPlans(), homeApi.listMyMemberships()])
      .then(([plansResult, membershipsResult]) => {
        if (cancelled) return;
        setPlans(plansResult.items);
        setMemberships(membershipsResult.items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "خطا در دریافت کارت‌های عضویت.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, memberships, error };
}
