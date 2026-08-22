import type { ID, Timestamps } from "./common";

/**
 * No email/password fields — phone is the sole login identifier (see
 * docs/03-api.md). Profile fields (name, email, birth date, ...) live on
 * `Profile`, not here.
 */
export interface User extends Timestamps {
  id: ID;
  /** Local format, e.g. 09121234567. Primary login identifier. */
  phone: string;
  phoneVerifiedAt: string | null;
  /** The invite code this user owns and can share with others. */
  inviteCode: string;
  /** The invite code this user signed up with, if any. */
  referredByCode: string | null;
  twoFactorEnabled: boolean;
  status: "active" | "suspended" | "deleted";
}

export interface Profile extends Timestamps {
  id: ID;
  userId: ID;
  fullName: string;
  email: string | null;
  nationalId: string | null;
  birthDate: string | null;
  /** Object storage key, not a public URL — see docs/01-architecture.md (StorageService). */
  avatarKey: string | null;
}

export interface Address extends Timestamps {
  id: ID;
  userId: ID;
  label: string;
  fullAddress: string;
  recipientName: string;
  recipientPhone: string;
  isDefault: boolean;
}

export interface NotificationSettings {
  userId: ID;
  orderStatusUpdates: boolean;
  promotions: boolean;
  twoFactorEnabled: boolean;
}
