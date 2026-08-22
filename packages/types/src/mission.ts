import type { ID, Timestamps } from "./common";

export interface MissionDefinition {
  id: ID;
  title: string;
  points: number;
  /** e.g. "profile_completion", "first_credit_purchase", "invite_friends:2" */
  triggerKey: string;
  targetCount: number;
}

export interface UserMission extends Timestamps {
  id: ID;
  userId: ID;
  missionId: ID;
  progressCount: number;
  completedAt: string | null;
}

export interface LoyaltyPointsLedgerEntry extends Timestamps {
  id: ID;
  userId: ID;
  points: number;
  reason: string;
  relatedMissionId: ID | null;
  relatedReferralUserId: ID | null;
}
