import type { ID, Rial, Timestamps } from "./common";

/** The 3 cards shown in the home hero carousel (earn / core club / reward). */
export type MembershipCardKind = "earn" | "core" | "reward";

/** The 8 subscription tiers shown as membership story-cards on the home page. */
export type SubscriptionTier =
  | "start"
  | "plus"
  | "family"
  | "prime"
  | "gift"
  | "travel"
  | "lifestyle"
  | "organizational";

export interface MembershipBenefit {
  title: string;
  description: string;
}

/** Catalog definition of a membership card (admin-managed content, not per-user). */
export interface MembershipCardDefinition extends Timestamps {
  id: ID;
  kind: MembershipCardKind;
  title: string;
  kicker: string;
  shortDescription: string;
  description: string;
  level: string;
  creditLabel: string;
  durationLabel: string;
  priceLabel: string;
  accentColor: string;
  deepColor: string;
  activationActionLabel: string;
  benefits: MembershipBenefit[];
  /** Names/ids of service categories this card grants access or bonus rates on. */
  accessibleCategories: string[];
  terms: string[];
}

export type UserMembershipStatus = "active" | "pending" | "special" | "expired";

/** A user's activation of a membership/subscription card. */
export interface UserMembership extends Timestamps {
  id: ID;
  userId: ID;
  cardDefinitionId: ID;
  tier: SubscriptionTier | null;
  status: UserMembershipStatus;
  activatedAt: string | null;
  expiresAt: string | null;
}

/**
 * A functional payment card shown in the profile ("کارت‌های فعال من"): distinct from
 * membership tier — represents which purchase modes are enabled for the user.
 */
export type PaymentCardType = "installment" | "credit" | "discount" | "mixed";

export interface UserPaymentCard extends Timestamps {
  id: ID;
  userId: ID;
  type: PaymentCardType;
  last4: string;
  creditLimit: Rial | null;
  status: "active" | "pending" | "expired";
}
